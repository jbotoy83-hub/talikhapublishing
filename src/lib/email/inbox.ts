import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gmailAccountEmail, gmailJson, gmailSyncEnabled } from "./gmail";
import { sanitizeImportedEmailHtml } from "./sanitize";
import sanitizeHtml from "sanitize-html";

type AdminClient = SupabaseClient;
type GmailSyncResult = { enabled: boolean; imported: number; complete?: boolean };

type GmailHeader = { name?: string; value?: string };
type GmailPart = { mimeType?: string; filename?: string; headers?: GmailHeader[]; body?: { data?: string; attachmentId?: string; size?: number }; parts?: GmailPart[] };
type GmailMessage = { id: string; threadId: string; historyId?: string; internalDate?: string; labelIds?: string[]; snippet?: string; payload?: GmailPart };

function decodeBase64Url(value?: string) {
  if (!value) return "";
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function header(part: GmailPart | undefined, name: string) {
  return part?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function parseAddress(value: string) {
  const match = value.match(/^(.*?)\s*<([^>]+)>$/);
  return { name: (match?.[1] || value.split("@")[0] || "Correspondent").replace(/^"|"$/g, "").trim(), email: (match?.[2] || value).trim().toLowerCase() };
}

function collectParts(part: GmailPart | undefined, output: { text: string[]; html: string[]; attachments: Array<{ id: string; filename: string; mimeType: string; size: number }> }) {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) output.attachments.push({ id: part.body.attachmentId, filename: part.filename, mimeType: part.mimeType || "application/octet-stream", size: Number(part.body.size || 0) });
  else if (part.mimeType === "text/plain" && part.body?.data) output.text.push(decodeBase64Url(part.body.data));
  else if (part.mimeType === "text/html" && part.body?.data) output.html.push(decodeBase64Url(part.body.data));
  for (const child of part.parts || []) collectParts(child, output);
}

function plainFromHtml(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

async function upsertGmailMessage(admin: AdminClient, message: GmailMessage) {
  const from = parseAddress(header(message.payload, "From"));
  const to = parseAddress(header(message.payload, "To"));
  const subject = header(message.payload, "Subject") || "(No subject)";
  const rfcMessageId = header(message.payload, "Message-ID") || null;
  const parts = { text: [] as string[], html: [] as string[], attachments: [] as Array<{ id: string; filename: string; mimeType: string; size: number }> };
  collectParts(message.payload, parts);
  const bodyHtml = sanitizeImportedEmailHtml(parts.html.join("\n"));
  const bodyText = parts.text.join("\n").trim() || plainFromHtml(bodyHtml);
  const outbound = from.email === gmailAccountEmail();
  const participant = outbound ? to : from;
  const timestamp = new Date(Number(message.internalDate || Date.now())).toISOString();
  const { data: existingThread } = await admin.from("email_threads").select("id, submission_id").eq("gmail_thread_id", message.threadId).maybeSingle();
  let threadId = existingThread?.id;
  if (!threadId) {
    const { data: thread, error } = await admin.from("email_threads").insert({ gmail_thread_id: message.threadId, subject, participant_name: participant.name, participant_email: participant.email, snippet: message.snippet || bodyText.slice(0, 220), source: "gmail", unread: !outbound && Boolean(message.labelIds?.includes("UNREAD")), starred: Boolean(message.labelIds?.includes("STARRED")), last_message_at: timestamp }).select("id").single();
    if (error || !thread) throw new Error("Could not store an imported Gmail thread.");
    threadId = thread.id;
  } else {
    await admin.from("email_threads").update({ subject, participant_name: participant.name, participant_email: participant.email, snippet: message.snippet || bodyText.slice(0, 220), unread: !outbound && Boolean(message.labelIds?.includes("UNREAD")), starred: Boolean(message.labelIds?.includes("STARRED")), last_message_at: timestamp }).eq("id", threadId);
  }
  const { data: existingMessage } = await admin.from("email_messages").select("id, source").eq("gmail_message_id", message.id).maybeSingle();
  if (existingMessage) {
    await admin.from("email_messages").update({ gmail_history_id: message.historyId || null, gmail_thread_id: message.threadId, rfc_message_id: rfcMessageId, status: outbound ? "sent" : "received", sent_at: outbound ? timestamp : null, received_at: outbound ? null : timestamp }).eq("id", existingMessage.id);
  }
  const idempotencyKey = createHash("sha256").update(`gmail:${message.id}`).digest("hex");
  const result = existingMessage
    ? { data: existingMessage, error: null }
    : await admin.from("email_messages").insert({ thread_id: threadId, submission_id: existingThread?.submission_id || null, gmail_message_id: message.id, gmail_thread_id: message.threadId, gmail_history_id: message.historyId || null, rfc_message_id: rfcMessageId, idempotency_key: idempotencyKey, direction: outbound ? "outbound" : "inbound", source: "gmail", sender_name: from.name, sender_email: from.email, recipients: [to], subject, body_text: bodyText, body_html: bodyHtml, status: outbound ? "sent" : "received", sent_at: outbound ? timestamp : null, received_at: outbound ? null : timestamp, created_at: timestamp }).select("id").single();
  const { data: stored, error } = result;
  if (error || !stored) throw new Error("Could not store an imported Gmail message.");
  if (parts.attachments.length) await admin.from("email_attachments").upsert(parts.attachments.map((attachment) => ({ message_id: stored.id, gmail_message_id: message.id, provider_attachment_id: attachment.id, filename: attachment.filename, mime_type: attachment.mimeType, size_bytes: attachment.size })), { onConflict: "gmail_message_id,provider_attachment_id" });
  return message.historyId || null;
}

async function importGmailThread(admin: AdminClient, threadId: string) {
  const thread = await gmailJson<{ messages?: GmailMessage[] }>(`/threads/${encodeURIComponent(threadId)}?format=full`);
  let historyId: string | null = null;
  for (const message of thread.messages || []) historyId = await upsertGmailMessage(admin, message) || historyId;
  return historyId;
}

export async function renewGmailWatch(admin: AdminClient) {
  if (!gmailSyncEnabled()) return { enabled: false };
  const topicName = process.env.GMAIL_PUBSUB_TOPIC?.trim();
  if (!topicName) throw new Error("GMAIL_PUBSUB_TOPIC is not configured.");
  const result = await gmailJson<{ historyId: string; expiration: string }>("/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "include" }) });
  const expiration = new Date(Number(result.expiration)).toISOString();
  await admin.from("gmail_sync_state").upsert({ account_email: gmailAccountEmail(), phase: "watching", history_id: result.historyId, watch_expiration: expiration, last_error: null }, { onConflict: "account_email" });
  return { enabled: true, historyId: result.historyId, expiration };
}

export async function runGmailBackfillBatch(admin: AdminClient, batchSize = 25): Promise<GmailSyncResult> {
  if (!gmailSyncEnabled()) return { enabled: false, complete: false, imported: 0 };
  const account = gmailAccountEmail();
  const { data: state } = await admin.from("gmail_sync_state").select("history_id, backfill_page_token, imported_threads, backfill_complete").eq("account_email", account).maybeSingle();
  if (state?.backfill_complete) return { enabled: true, complete: true, imported: 0 };
  await admin.from("gmail_sync_state").upsert({ account_email: account, phase: "importing", last_error: null }, { onConflict: "account_email" });
  const params = new URLSearchParams({ labelIds: "INBOX", maxResults: String(Math.min(Math.max(batchSize, 1), 100)) });
  if (state?.backfill_page_token) params.set("pageToken", state.backfill_page_token);
  const page = await gmailJson<{ threads?: Array<{ id: string }>; nextPageToken?: string }>(`/threads?${params}`);
  for (const thread of page.threads || []) await importGmailThread(admin, thread.id);
  const imported = (page.threads || []).length;
  const complete = !page.nextPageToken;
  await admin.from("gmail_sync_state").upsert({ account_email: account, phase: complete ? "watching" : "importing", backfill_page_token: page.nextPageToken || null, backfill_complete: complete, imported_threads: Number(state?.imported_threads || 0) + imported, last_synced_at: new Date().toISOString(), last_error: null }, { onConflict: "account_email" });
  const replay: GmailSyncResult | null = complete && state?.history_id ? await replayGmailHistory(admin, state.history_id) : null;
  return { enabled: true, complete, imported: imported + (replay && "imported" in replay ? Number(replay.imported || 0) : 0) };
}

export async function replayGmailHistory(admin: AdminClient, startHistoryId?: string): Promise<GmailSyncResult> {
  if (!gmailSyncEnabled()) return { enabled: false, imported: 0 };
  const account = gmailAccountEmail();
  const { data: state } = await admin.from("gmail_sync_state").select("history_id").eq("account_email", account).maybeSingle();
  const cursor = startHistoryId || state?.history_id;
  if (!cursor) return runGmailBackfillBatch(admin);
  let pageToken = "";
  let imported = 0;
  let latest = cursor;
  do {
    const params = new URLSearchParams({ startHistoryId: cursor, historyTypes: "messageAdded", labelId: "INBOX", maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    try {
      params.delete("historyTypes");
      const page = await gmailJson<{ history?: Array<{ id: string; messagesAdded?: Array<{ message: { id: string; labelIds?: string[] } }>; messagesDeleted?: Array<{ message: { id: string } }>; labelsAdded?: Array<{ message: { id: string; labelIds?: string[] } }>; labelsRemoved?: Array<{ message: { id: string; labelIds?: string[] } }> }>; nextPageToken?: string; historyId?: string }>(`/history?${params}`);
      for (const item of page.history || []) {
        latest = item.id || latest;
        for (const added of item.messagesAdded || []) {
          if (!added.message.labelIds?.includes("INBOX")) continue;
          const message = await gmailJson<GmailMessage>(`/messages/${encodeURIComponent(added.message.id)}?format=full`);
          await upsertGmailMessage(admin, message);
          imported++;
        }
        for (const deleted of item.messagesDeleted || []) {
          const { data: stored } = await admin.from("email_messages").select("id, source").eq("gmail_message_id", deleted.message.id).maybeSingle();
          if (stored?.source === "gmail") await admin.from("email_messages").update({ body_text: "", body_html: "", provider_error: "Message content was removed after Gmail reported deletion." }).eq("id", stored.id);
        }
        const labelChanges = [...(item.labelsAdded || []), ...(item.labelsRemoved || [])];
        for (const changed of labelChanges) {
          const { data: stored } = await admin.from("email_messages").select("thread_id").eq("gmail_message_id", changed.message.id).maybeSingle();
          if (!stored?.thread_id) continue;
          await admin.from("email_threads").update({ unread: Boolean(changed.message.labelIds?.includes("UNREAD")), starred: Boolean(changed.message.labelIds?.includes("STARRED")) }).eq("id", stored.thread_id);
        }
      }
      latest = page.historyId || latest;
      pageToken = page.nextPageToken || "";
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
      if (status === 404 || /history/i.test(error instanceof Error ? error.message : "")) {
        await admin.from("gmail_sync_state").update({ phase: "importing", history_id: null, backfill_page_token: null, backfill_complete: false, last_error: "Gmail history cursor expired; a full Inbox reconciliation was started." }).eq("account_email", account);
        return runGmailBackfillBatch(admin);
      }
      throw error;
    }
  } while (pageToken);
  await admin.from("gmail_sync_state").update({ history_id: latest, phase: "watching", last_synced_at: new Date().toISOString(), last_error: null }).eq("account_email", account);
  return { enabled: true, imported };
}

export async function listInboxThreads(admin: AdminClient, input: { page: number; pageSize: number; filter: string; query: string }) {
  const from = (input.page - 1) * input.pageSize;
  let query = admin.from("email_threads").select("id, submission_id, gmail_thread_id, subject, participant_name, participant_email, snippet, source, starred, unread, needs_attention, last_message_at", { count: "exact" }).order("last_message_at", { ascending: false }).range(from, from + input.pageSize - 1);
  if (input.filter === "submission") query = query.not("submission_id", "is", null);
  if (input.filter === "automated") query = query.eq("source", "automated");
  if (input.filter === "admin") query = query.eq("source", "admin");
  if (input.filter === "starred") query = query.eq("starred", true);
  if (input.filter === "attention") query = query.eq("needs_attention", true);
  if (input.query) {
    const safe = input.query.replace(/[%_,()]/g, "");
    const [{ data: messageMatches }, { data: submissionMatches }] = await Promise.all([
      admin.from("email_messages").select("thread_id").or(`subject.ilike.%${safe}%,sender_email.ilike.%${safe}%,body_text.ilike.%${safe}%`).limit(500),
      admin.from("submissions").select("id").or(`reference.ilike.%${safe}%,title.ilike.%${safe}%`).limit(500)
    ]);
    const threadIds = [...new Set((messageMatches || []).map((item) => item.thread_id))];
    const submissionIds = [...new Set((submissionMatches || []).map((item) => item.id))];
    const clauses = [`subject.ilike.%${safe}%`, `participant_email.ilike.%${safe}%`, `participant_name.ilike.%${safe}%`, `snippet.ilike.%${safe}%`];
    if (threadIds.length) clauses.push(`id.in.(${threadIds.join(",")})`);
    if (submissionIds.length) clauses.push(`submission_id.in.(${submissionIds.join(",")})`);
    query = query.or(clauses.join(","));
  }
  const { data, error, count } = await query;
  if (error) throw new Error("Could not load correspondence.");
  const submissionIds = [...new Set((data || []).map((thread) => thread.submission_id).filter(Boolean))];
  const { data: submissions } = submissionIds.length ? await admin.from("submissions").select("id, reference, title, journal_title_snapshot, author_details, author_email, author_name").in("id", submissionIds) : { data: [] };
  const byId = new Map((submissions || []).map((submission) => [submission.id, submission]));
  return { threads: (data || []).map((thread) => ({ ...thread, submission: thread.submission_id ? byId.get(thread.submission_id) || null : null })), total: count || 0 };
}

export async function getInboxThread(admin: AdminClient, threadId: string) {
  const { data: thread, error } = await admin.from("email_threads").select("*").eq("id", threadId).single();
  if (error || !thread) throw new Error("Correspondence thread was not found.");
  const [{ data: messages }, { data: submission }] = await Promise.all([
    admin.from("email_messages").select("id, direction, source, sender_name, sender_email, recipients, subject, body_text, body_html, status, provider_error, attempt_count, sent_at, received_at, created_at, email_attachments(id, filename, mime_type, size_bytes)").eq("thread_id", threadId).order("created_at"),
    thread.submission_id ? admin.from("submissions").select("id, reference, title, journal_title_snapshot, author_details, author_email, author_name").eq("id", thread.submission_id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  return { thread, messages: messages || [], submission };
}

export async function getGmailAttachment(admin: AdminClient, attachmentId: string, actorId: string) {
  const { data: attachment } = await admin.from("email_attachments").select("id, gmail_message_id, provider_attachment_id, filename, mime_type, size_bytes").eq("id", attachmentId).single();
  if (!attachment) throw new Error("Attachment was not found.");
  const payload = await gmailJson<{ data?: string; size?: number }>(`/messages/${encodeURIComponent(attachment.gmail_message_id)}/attachments/${encodeURIComponent(attachment.provider_attachment_id)}`);
  if (!payload.data) throw new Error("Gmail did not return the attachment.");
  await admin.from("audit_events").insert({ actor_id: actorId, action: "email_attachment_accessed", entity_type: "email_attachment", entity_id: attachmentId, details: { filename: attachment.filename } });
  return { ...attachment, bytes: Buffer.from(payload.data.replace(/-/g, "+").replace(/_/g, "/"), "base64") };
}
