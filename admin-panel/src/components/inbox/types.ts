export type InboxFilter = "inbox" | "submission" | "automated" | "admin" | "starred" | "attention";
export type DeliveryStatus = "queued" | "sending" | "sent" | "failed" | "unknown" | "received";

export interface LinkedRecipient { email: string; name: string }
export interface LinkedSubmission { id: string; reference: string; title: string; journal: string; recipients?: LinkedRecipient[] }

export interface InboxThreadSummary {
  id: string;
  submission_id: string | null;
  gmail_thread_id: string | null;
  subject: string;
  participant_name: string | null;
  participant_email: string | null;
  snippet: string;
  source: "automated" | "admin" | "gmail";
  starred: boolean;
  unread: boolean;
  needs_attention: boolean;
  last_message_at: string;
  submission: LinkedSubmission | null;
}

export interface InboxAttachment { id: string; filename: string; mime_type: string; size_bytes: number }
export interface InboxMessage {
  id: string;
  direction: "inbound" | "outbound";
  source: "automated" | "admin" | "gmail";
  sender_name: string | null;
  sender_email: string;
  recipients: LinkedRecipient[];
  subject: string;
  body_text: string;
  body_html: string;
  status: DeliveryStatus;
  provider_error: string | null;
  attempt_count: number;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  email_attachments: InboxAttachment[];
}

export interface InboxThreadDetail { thread: InboxThreadSummary; messages: InboxMessage[]; submission: LinkedSubmission | null }
export interface InboxConnection {
  account: string;
  outboundEnabled: boolean;
  syncEnabled: boolean;
  sync: null | { phase: string; backfill_complete: boolean; imported_threads: number; watch_expiration: string | null; last_synced_at: string | null; last_error: string | null };
}
