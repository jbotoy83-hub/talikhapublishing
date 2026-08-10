import { useState } from "react";
import { FileText } from "lucide-react";
import { AlertTriangle, ArrowUpRight, ChevronLeft, Download, RefreshCw } from "@/components/icons";
import { EmailHtmlFrame } from "./email-html-frame";
import { MessageComposer } from "./message-composer";
import { clockTime, dayLabel } from "./format";
import type { InboxMessage, InboxThreadDetail } from "./types";
import type { RichEmailValue } from "./rich-email-editor";

function statusLabel(status: string) {
  return status === "unknown" ? "Delivery unknown — check Gmail Sent" : status.charAt(0).toUpperCase() + status.slice(1);
}

function senderInitials(message: InboxMessage) {
  const name = message.direction === "outbound" ? "Talikha Publishing" : message.sender_name || message.sender_email;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] || ""}` : name.slice(0, 2)).toUpperCase();
}

function EmailMessage({ message, onRetry }: { message: InboxMessage; onRetry: (messageId: string) => Promise<void> }) {
  const [plainText, setPlainText] = useState(false);
  const hasHtml = Boolean(message.body_html?.trim());
  const downloads = message.email_attachments?.filter((attachment) => !attachment.is_inline) || [];
  const sender = message.direction === "outbound" ? "Talikha Publishing" : message.sender_name || message.sender_email;

  return <article className="mail-message" data-direction={message.direction}>
    <header className="mail-message-header"><span className="mail-sender-avatar" aria-hidden="true">{senderInitials(message)}</span><div className="mail-message-meta"><strong>{sender}</strong><span>{message.direction === "outbound" ? `To ${message.recipients.map((item) => item.email).join(", ")}` : `<${message.sender_email}> · to Talikha Publishing`}</span></div><time title={new Date(message.created_at).toLocaleString()}>{dayLabel(message.created_at)} · {clockTime(message.created_at)}</time></header>
    <div className="mail-message-body">{hasHtml && !plainText ? <EmailHtmlFrame html={message.body_html} attachments={message.email_attachments || []} title={`Email from ${sender}`} /> : message.body_text}</div>
    <footer className="mail-message-actions"><span className="mail-delivery" data-status={message.status}>{message.status === "failed" || message.status === "unknown" ? <AlertTriangle size={12} /> : null}{statusLabel(message.status)}</span>{message.attempt_count > 0 && <span>{message.attempt_count} delivery attempt{message.attempt_count === 1 ? "" : "s"}</span>}{hasHtml && <button type="button" onClick={() => setPlainText((current) => !current)}><FileText size={12} />{plainText ? "View formatted" : "Plain text"}</button>}{(message.status === "failed" || message.status === "queued") && <button type="button" onClick={() => void onRetry(message.id)}><RefreshCw size={12} /> Retry</button>}</footer>
    {message.provider_error && <p className="mail-provider-error">{message.provider_error}</p>}
    {downloads.length > 0 && <div className="mail-attachments">{downloads.map((attachment) => <a key={attachment.id} href={`/api/admin/inbox/attachments/${attachment.id}`}><Download size={14} /><span><strong>{attachment.filename}</strong><small>{attachment.mime_type} · {Math.max(1, Math.round(attachment.size_bytes / 1024))} KB</small></span></a>)}</div>}
  </article>;
}

export function ConversationThread({ detail, loading, sending, refreshing, onBack, onReply, onRetry, onRefresh }: { detail: InboxThreadDetail | null; loading: boolean; sending: boolean; refreshing: boolean; onBack: () => void; onReply: (value: RichEmailValue) => Promise<void>; onRetry: (messageId: string) => Promise<void>; onRefresh: () => Promise<void> }) {
  if (loading) return <section className="mail-thread"><div className="mail-thread-loading"><header><i /><div><span /><span /></div></header><main><span /><span /><span /><span /></main></div></section>;
  if (!detail) return <section className="mail-thread"><div className="mail-empty mail-empty-thread"><span>TK</span><h3>Select a conversation</h3><p>Read the original email layout, delivery status, attachments, and linked submission.</p></div></section>;

  const initials = (detail.thread.participant_name || detail.thread.participant_email || "E").slice(0, 2).toUpperCase();

  return <section className="mail-thread">
    <header className="mail-thread-head"><button type="button" className="mail-back" onClick={onBack} aria-label="Back to conversations"><ChevronLeft size={18} /></button><span className="mail-thread-avatar">{initials}</span><div><h2>{detail.thread.subject}</h2><small>{detail.thread.participant_name || detail.thread.participant_email} <span>·</span> {detail.thread.participant_email}</small></div>{detail.thread.gmail_thread_id && <button type="button" className="mail-thread-refresh" disabled={refreshing} onClick={() => void onRefresh()} aria-label={refreshing ? "Refreshing Gmail" : "Refresh Gmail"} title="Fetch the latest message layout and images from Gmail"><RefreshCw size={14} /><span>{refreshing ? "Refreshing…" : "Refresh Gmail"}</span></button>}</header>
    {detail.submission && <aside className="mail-submission-card"><div className="mail-submission-reference"><small>Linked submission</small><strong>{detail.submission.reference}</strong></div><div className="mail-submission-copy"><h3>{detail.submission.title}</h3><p>{detail.submission.journal}</p></div><a href={`/admin?view=submissions&submission=${encodeURIComponent(detail.submission.id)}`}>Open submission <ArrowUpRight size={14} /></a></aside>}
    <div className="mail-stream">{detail.messages.map((message) => <EmailMessage key={message.id} message={message} onRetry={onRetry} />)}</div>
    <MessageComposer sending={sending} onSend={onReply} />
  </section>;
}
