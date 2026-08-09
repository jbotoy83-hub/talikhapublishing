import { AlertTriangle, ArrowUpRight, ChevronLeft, Download, RefreshCw } from "@/components/icons";
import { MessageComposer } from "./message-composer";
import { clockTime, dayLabel } from "./format";
import type { InboxThreadDetail } from "./types";

function statusLabel(status: string) {
  return status === "unknown" ? "Delivery unknown — check Gmail Sent" : status.charAt(0).toUpperCase() + status.slice(1);
}

export function ConversationThread({ detail, loading, sending, onBack, onReply, onRetry }: { detail: InboxThreadDetail | null; loading: boolean; sending: boolean; onBack: () => void; onReply: (body: string) => Promise<void>; onRetry: (messageId: string) => Promise<void> }) {
  if (loading) return <section className="mail-thread"><div className="mail-empty"><span className="mail-spinner" /><h3>Opening correspondence</h3><p>Loading the protected delivery record.</p></div></section>;
  if (!detail) return <section className="mail-thread"><div className="mail-empty mail-empty-thread"><span>TK</span><h3>Select a conversation</h3><p>Read the exact message history, delivery state, attachments, and linked submission in one place.</p></div></section>;
  return <section className="mail-thread">
    <header className="mail-thread-head"><button type="button" className="mail-back" onClick={onBack} aria-label="Back to conversations"><ChevronLeft size={19} /></button><div><small>{detail.thread.participant_email}</small><h2>{detail.thread.subject}</h2></div></header>
    {detail.submission && <aside className="mail-submission-card"><div><small>Linked submission</small><strong>{detail.submission.reference}</strong><h3>{detail.submission.title}</h3><p>{detail.submission.journal}</p></div><a href={`/admin?view=submissions&submission=${encodeURIComponent(detail.submission.id)}`}>Open submission <ArrowUpRight size={15} /></a></aside>}
    <div className="mail-stream">{detail.messages.map((message) => <article key={message.id} className="mail-message" data-direction={message.direction}><header><div><strong>{message.direction === "outbound" ? "Talikha Publishing" : message.sender_name || message.sender_email}</strong><span>{message.direction === "outbound" ? `To ${message.recipients.map((item) => item.email).join(", ")}` : message.sender_email}</span></div><time>{dayLabel(message.created_at)} · {clockTime(message.created_at)}</time></header><div className="mail-message-body">{message.body_text}</div><footer><span className="mail-delivery" data-status={message.status}>{message.status === "failed" || message.status === "unknown" ? <AlertTriangle size={13} /> : null}{statusLabel(message.status)}</span>{message.attempt_count > 0 && <span>{message.attempt_count} delivery attempt{message.attempt_count === 1 ? "" : "s"}</span>}{(message.status === "failed" || message.status === "queued") && <button type="button" onClick={() => void onRetry(message.id)}><RefreshCw size={13} /> Retry</button>}</footer>{message.provider_error && <p className="mail-provider-error">{message.provider_error}</p>}{message.email_attachments?.length > 0 && <div className="mail-attachments">{message.email_attachments.map((attachment) => <a key={attachment.id} href={`/api/admin/inbox/attachments/${attachment.id}`}><Download size={14} /><span><strong>{attachment.filename}</strong><small>{attachment.mime_type} · {Math.max(1, Math.round(attachment.size_bytes / 1024))} KB</small></span></a>)}</div>}</article>)}</div>
    <MessageComposer sending={sending} onSend={onReply} />
  </section>;
}
