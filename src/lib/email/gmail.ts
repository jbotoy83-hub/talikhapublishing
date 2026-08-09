import "server-only";

import type { RenderedEmail } from "./types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function gmailOutboundEnabled() {
  return process.env.GMAIL_OUTBOUND_ENABLED === "true";
}

export function gmailSyncEnabled() {
  return process.env.GMAIL_SYNC_ENABLED === "true";
}

export function gmailAccountEmail() {
  return (process.env.GMAIL_ACCOUNT_EMAIL || "talikhapublishing@gmail.com").trim().toLowerCase();
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Gmail OAuth configuration is incomplete (${name}).`);
  return value;
}

export async function getGmailAccessToken() {
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required("GMAIL_CLIENT_ID"),
        client_secret: required("GMAIL_CLIENT_SECRET"),
        refresh_token: required("GMAIL_REFRESH_TOKEN"),
        grant_type: "refresh_token"
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
  } catch (cause) {
    const error = new Error(cause instanceof Error ? cause.message : "Could not reach Google OAuth.") as Error & { preSend?: boolean };
    error.preSend = true;
    throw error;
  }
  const payload = await response.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    const error = new Error(payload.error_description || payload.error || "Could not refresh Gmail authorization.") as Error & { status?: number; preSend?: boolean };
    error.status = response.status;
    error.preSend = true;
    throw error;
  }
  return payload.access_token;
}

function base64Url(value: string | Uint8Array) {
  const buffer = typeof value === "string" ? Buffer.from(value) : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function mimeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

function buildMime(to: string, message: RenderedEmail, messageId: string, inReplyTo?: string) {
  const boundary = `talikha_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `From: Talikha Publishing <${gmailAccountEmail()}>`,
    `To: ${to}`,
    `Subject: ${mimeHeader(message.subject)}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : [])
  ];
  return `${headers.join("\r\n")}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(message.text).toString("base64")}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(message.html).toString("base64")}\r\n--${boundary}--`;
}

export async function sendGmailMessage(input: { to: string; message: RenderedEmail; threadId?: string | null; inReplyTo?: string }) {
  const token = await getGmailAccessToken();
  const rfcMessageId = `<${crypto.randomUUID()}@talikhapublishing.vercel.app>`;
  const response = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(buildMime(input.to, input.message, rfcMessageId, input.inReplyTo)), ...(input.threadId ? { threadId: input.threadId } : {}) }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; threadId?: string; historyId?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) {
    const error = new Error(payload.error?.message || `Gmail send failed with status ${response.status}.`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return { id: payload.id, threadId: payload.threadId || null, historyId: payload.historyId || null, rfcMessageId };
}

export async function gmailJson<T>(path: string, init?: RequestInit) {
  const token = await getGmailAccessToken();
  const response = await fetch(`${GMAIL_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Gmail request failed with status ${response.status}.`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload;
}
