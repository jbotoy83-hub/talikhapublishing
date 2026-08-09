import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gmailOutboundEnabled, sendGmailMessage } from "./gmail";
import { renderAdminEmail, renderSubmissionReceivedEmail } from "./templates";
import { normalizeEmail, resolveSubmissionRecipients } from "./recipients";
import type { DeliveryStatus, SubmissionEmailContext } from "./types";

export { normalizeEmail, resolveSubmissionRecipients } from "./recipients";

type AdminClient = SupabaseClient;

type SubmissionRow = {
  id: string;
  reference: string;
  title: string;
  author_name: string;
  author_email: string;
  author_details: unknown;
  journal_title_snapshot: string;
  volume_snapshot: string;
  issue_snapshot: string;
  submitted_at: string | null;
};

function deterministicKey(parts: string[]) {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}

async function getSubmission(admin: AdminClient, submissionId: string) {
  const { data, error } = await admin.from("submissions").select("id, reference, title, author_name, author_email, author_details, journal_title_snapshot, volume_snapshot, issue_snapshot, submitted_at").eq("id", submissionId).single();
  if (error || !data) throw new Error("Submission correspondence could not be prepared.");
  return data as SubmissionRow;
}

export async function ensureSubmissionConfirmations(admin: AdminClient, submissionId: string) {
  const submission = await getSubmission(admin, submissionId);
  const recipients = resolveSubmissionRecipients(submission);
  const context: SubmissionEmailContext = {
    submissionId,
    reference: submission.reference,
    title: submission.title,
    journal: submission.journal_title_snapshot,
    volume: submission.volume_snapshot,
    issue: submission.issue_snapshot,
    submittedAt: submission.submitted_at || new Date().toISOString(),
    recipients
  };
  const messageIds: string[] = [];
  for (const recipient of recipients) {
    const idempotencyKey = deterministicKey([submissionId, "submission-received-v1", recipient.email]);
    const { data: existing } = await admin.from("email_messages").select("id").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing?.id) {
      messageIds.push(existing.id);
      continue;
    }
    const rendered = renderSubmissionReceivedEmail(context, recipient);
    const { data: thread, error: threadError } = await admin.from("email_threads").insert({
      submission_id: submissionId,
      subject: rendered.subject,
      participant_name: recipient.name,
      participant_email: recipient.email,
      snippet: rendered.text.replace(/\s+/g, " ").slice(0, 220),
      source: "automated",
      needs_attention: !gmailOutboundEnabled(),
      last_message_at: new Date().toISOString()
    }).select("id").single();
    if (threadError || !thread) throw new Error("Could not create the submission email thread.");
    const { data: message, error: messageError } = await admin.from("email_messages").insert({
      thread_id: thread.id,
      submission_id: submissionId,
      idempotency_key: idempotencyKey,
      direction: "outbound",
      source: "automated",
      sender_name: "Talikha Publishing",
      sender_email: "talikhapublishing@gmail.com",
      recipients: [recipient],
      subject: rendered.subject,
      body_text: rendered.text,
      body_html: rendered.html,
      status: "queued",
      provider_error: gmailOutboundEnabled() ? null : "Gmail sending is awaiting OAuth configuration."
    }).select("id").single();
    if (messageError || !message) throw new Error("Could not queue the submission email.");
    messageIds.push(message.id);
  }
  return { recipientCount: recipients.length, messageIds, status: "queued" as const };
}

function deliveryFailure(error: unknown): { status: DeliveryStatus; detail: string; retryable: boolean } {
  const detail = error instanceof Error ? error.message : "Gmail delivery failed.";
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  const preSend = Boolean(typeof error === "object" && error && "preSend" in error && (error as { preSend?: boolean }).preSend);
  if (preSend) return { status: "failed", detail, retryable: !/invalid_grant|expired|revoked/i.test(detail) };
  if (!status || /abort|timeout|network|fetch/i.test(detail)) return { status: "unknown", detail, retryable: false };
  if (status === 408 || status === 429 || status >= 500) return { status: "failed", detail, retryable: true };
  return { status: "failed", detail, retryable: false };
}

export async function deliverEmailMessage(admin: AdminClient, messageId: string) {
  const { data: message, error } = await admin.from("email_messages").select("id, thread_id, recipients, subject, body_text, body_html, status, attempt_count, gmail_message_id, email_threads(gmail_thread_id)").eq("id", messageId).single();
  if (error || !message) throw new Error("Queued email was not found.");
  if (message.status === "sent" || message.gmail_message_id) return { status: "sent" as const };
  if (message.status === "unknown") return { status: "unknown" as const };
  if (!gmailOutboundEnabled()) return { status: "queued" as const };
  const recipients = Array.isArray(message.recipients) ? message.recipients as Array<{ email?: string }> : [];
  const to = recipients[0]?.email;
  if (!to) throw new Error("The queued email has no recipient.");
  await admin.from("email_messages").update({ status: "sending", attempt_count: Number(message.attempt_count || 0) + 1, last_attempt_at: new Date().toISOString(), provider_error: null }).eq("id", messageId).in("status", ["queued", "failed"]);
  try {
    const relation = Array.isArray(message.email_threads) ? message.email_threads[0] : message.email_threads;
    const { data: previous } = await admin.from("email_messages").select("rfc_message_id").eq("thread_id", message.thread_id).neq("id", messageId).not("rfc_message_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const sent = await sendGmailMessage({ to, message: { subject: message.subject, text: message.body_text, html: message.body_html }, threadId: relation?.gmail_thread_id || null, inReplyTo: previous?.rfc_message_id || undefined });
    const now = new Date().toISOString();
    await admin.from("email_messages").update({ status: "sent", gmail_message_id: sent.id, gmail_thread_id: sent.threadId, gmail_history_id: sent.historyId, rfc_message_id: sent.rfcMessageId, sent_at: now, provider_error: null }).eq("id", messageId);
    await admin.from("email_threads").update({ gmail_thread_id: sent.threadId, needs_attention: false, last_message_at: now }).eq("id", message.thread_id);
    return { status: "sent" as const };
  } catch (cause) {
    const failure = deliveryFailure(cause);
    await admin.from("email_messages").update({ status: failure.status, provider_error: failure.detail, retryable: failure.retryable }).eq("id", messageId);
    await admin.from("email_threads").update({ needs_attention: true }).eq("id", message.thread_id);
    await admin.from("audit_events").insert({ action: /invalid_grant|expired|revoked/i.test(failure.detail) ? "gmail_oauth_failure" : "email_delivery_failed", entity_type: "email_message", entity_id: messageId, details: { status: failure.status, retryable: failure.retryable, error: failure.detail } });
    return { status: failure.status };
  }
}

export async function deliverQueuedMessages(admin: AdminClient, messageIds?: string[], limit = 20) {
  let query = admin.from("email_messages").select("id").eq("direction", "outbound").or("status.eq.queued,and(status.eq.failed,retryable.eq.true)").order("created_at").limit(limit);
  if (messageIds?.length) query = query.in("id", messageIds);
  const { data } = await query;
  const results = [];
  for (const row of data || []) results.push(await deliverEmailMessage(admin, row.id));
  return results;
}

export async function createAdminMessage(admin: AdminClient, input: { actorId: string; idempotencyKey: string; submissionId?: string; threadId?: string; recipientEmail?: string; subject: string; body: string }) {
  const { data: existing } = await admin.from("email_messages").select("id, thread_id, status").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing) return existing;
  let recipientEmail = normalizeEmail(input.recipientEmail || "");
  let recipientName = "Correspondent";
  let threadId = input.threadId || "";
  let gmailThreadId: string | null = null;
  let submissionId = input.submissionId || null;
  if (threadId) {
    const { data: thread } = await admin.from("email_threads").select("id, submission_id, participant_email, participant_name, gmail_thread_id").eq("id", threadId).single();
    if (!thread?.participant_email) throw new Error("The selected thread has no reply address.");
    recipientEmail = normalizeEmail(thread.participant_email);
    recipientName = thread.participant_name || recipientName;
    submissionId = thread.submission_id || submissionId;
    gmailThreadId = thread.gmail_thread_id;
  } else {
    if (!submissionId || !recipientEmail) throw new Error("Choose a submission and one linked author.");
    const submission = await getSubmission(admin, submissionId);
    const linked = resolveSubmissionRecipients(submission).find((recipient) => recipient.email === recipientEmail);
    if (!linked) throw new Error("That recipient is not linked to the selected submission.");
    recipientName = linked.name;
    const { data: created, error } = await admin.from("email_threads").insert({ submission_id: submissionId, subject: input.subject, participant_email: recipientEmail, participant_name: recipientName, snippet: input.body.replace(/\s+/g, " ").slice(0, 220), source: "admin", needs_attention: !gmailOutboundEnabled() }).select("id").single();
    if (error || !created) throw new Error("Could not create the email thread.");
    threadId = created.id;
  }
  const rendered = renderAdminEmail(input.subject, input.body);
  const { data: message, error } = await admin.from("email_messages").insert({
    thread_id: threadId,
    submission_id: submissionId,
    gmail_thread_id: gmailThreadId,
    idempotency_key: input.idempotencyKey,
    direction: "outbound",
    source: "admin",
    sender_name: "Talikha Publishing",
    sender_email: "talikhapublishing@gmail.com",
    recipients: [{ email: recipientEmail, name: recipientName }],
    subject: rendered.subject,
    body_text: rendered.text,
    body_html: rendered.html,
    status: "queued",
    actor_id: input.actorId,
    provider_error: gmailOutboundEnabled() ? null : "Gmail sending is awaiting OAuth configuration."
  }).select("id, thread_id, status").single();
  if (error || !message) throw new Error("Could not queue the email.");
  await admin.from("audit_events").insert({ actor_id: input.actorId, action: input.threadId ? "email_reply_queued" : "email_send_queued", entity_type: "email_message", entity_id: message.id, details: { threadId, submissionId, recipientEmail } });
  return message;
}

export async function retryMessage(admin: AdminClient, messageId: string, actorId: string) {
  const { data: message } = await admin.from("email_messages").select("id, status").eq("id", messageId).single();
  if (!message) throw new Error("Email was not found.");
  if (message.status === "unknown") throw new Error("Check Gmail Sent before retrying an unknown delivery.");
  if (message.status !== "failed" && message.status !== "queued") throw new Error("Only queued or definitely failed email can be retried.");
  await admin.from("audit_events").insert({ actor_id: actorId, action: "email_retry_requested", entity_type: "email_message", entity_id: messageId, details: {} });
  return deliverEmailMessage(admin, messageId);
}
