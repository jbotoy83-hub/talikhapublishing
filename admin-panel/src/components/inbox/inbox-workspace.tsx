import { useCallback, useEffect, useState } from "react";
import { X } from "@/components/icons";
import { ChannelSidebar } from "./channel-sidebar";
import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";
import type { InboxConnection, InboxFilter, InboxThreadDetail, InboxThreadSummary, LinkedSubmission } from "./types";
import "./inbox.css";

const PAGE_SIZE = 25;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "The Inbox request failed.");
  return payload;
}

export function InboxWorkspace() {
  const [filter, setFilter] = useState<InboxFilter>("inbox");
  const [threads, setThreads] = useState<InboxThreadSummary[]>([]);
  const [connection, setConnection] = useState<InboxConnection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxThreadDetail | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncStarting, setSyncStarting] = useState(false);
  const [error, setError] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  const loadThreads = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ filter, page: String(page), pageSize: String(PAGE_SIZE), q: query });
      const payload = await api<{ threads: InboxThreadSummary[]; total: number; connection: InboxConnection }>(`/api/admin/inbox?${params}`);
      setThreads(Array.isArray(payload.threads) ? payload.threads : []);
      setTotal(Number(payload.total || 0));
      setConnection(payload.connection || null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the Inbox.");
    } finally {
      setLoading(false);
    }
  }, [filter, page, query]);

  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { setPage(1); }, [filter, query]);
  useEffect(() => { void loadThreads(); }, [loadThreads]);
  useEffect(() => { const refresh = () => void loadThreads(true); window.addEventListener("focus", refresh); const timer = window.setInterval(refresh, 45_000); return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); }; }, [loadThreads]);

  async function openThread(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      setDetail(await api<InboxThreadDetail>(`/api/admin/inbox/${id}`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the conversation.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function send(input: { threadId?: string; submissionId?: string; recipientEmail?: string; subject: string; body: string }) {
    setSending(true);
    try {
      const result = await api<{ message: { thread_id: string } }>("/api/admin/inbox", { method: "POST", body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }) });
      setComposeOpen(false);
      await loadThreads(true);
      await openThread(result.message.thread_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the email.");
      throw cause;
    } finally {
      setSending(false);
    }
  }

  async function retry(messageId: string) {
    try {
      await api(`/api/admin/inbox/messages/${messageId}/retry`, { method: "POST" });
      if (selectedId) await openThread(selectedId);
      await loadThreads(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not retry the email.");
    }
  }

  async function startSync() {
    setSyncStarting(true);
    try {
      await api("/api/admin/inbox/sync", { method: "POST" });
      await loadThreads(true);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start Gmail synchronization.");
    } finally {
      setSyncStarting(false);
    }
  }

  function changeFilter(value: InboxFilter) {
    setFilter(value);
    setSelectedId(null);
    setDetail(null);
  }

  return <div className="mail-workspace" data-thread-open={Boolean(selectedId || detailLoading)}>
    <ChannelSidebar connection={connection} active={filter} syncStarting={syncStarting} onSync={() => void startSync()} onChange={changeFilter} />
    <ConversationList threads={threads} selectedId={selectedId} search={search} loading={loading} total={total} page={page} pageSize={PAGE_SIZE} filter={filter} onFilter={changeFilter} onSearch={setSearch} onSelect={(id) => void openThread(id)} onCompose={() => setComposeOpen(true)} onPage={setPage} />
    <ConversationThread detail={detail} loading={detailLoading} sending={sending} onBack={() => { setSelectedId(null); setDetail(null); }} onReply={(body) => send({ threadId: detail?.thread.id, subject: detail?.thread.subject || "Talikha Publishing", body })} onRetry={retry} />
    {error && <div className="mail-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></div>}
    {composeOpen && <ComposeDialog sending={sending} onClose={() => setComposeOpen(false)} onSend={send} />}
  </div>;
}

function ComposeDialog({ sending, onClose, onSend }: { sending: boolean; onClose: () => void; onSend: (input: { submissionId: string; recipientEmail: string; subject: string; body: string }) => Promise<void> }) {
  const [submissions, setSubmissions] = useState<LinkedSubmission[]>([]);
  const [submissionId, setSubmissionId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => { void api<{ submissions: LinkedSubmission[] }>("/api/admin/inbox?kind=submissions").then((result) => setSubmissions(Array.isArray(result.submissions) ? result.submissions : [])).catch(() => setSubmissions([])); }, []);
  const selected = submissions.find((submission) => submission.id === submissionId);

  return <div className="mail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="mail-modal" role="dialog" aria-modal="true" aria-labelledby="composeTitle">
    <header><div><h2 id="composeTitle">New author email</h2><small>Linked correspondence</small></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
    <p>Select a submission and one of its listed authors. This keeps the email in the correct editorial record.</p>
    <label>Submission<select value={submissionId} onChange={(event) => { setSubmissionId(event.target.value); setRecipientEmail(""); }}><option value="">Choose a submitted work</option>{submissions.map((submission) => <option key={submission.id} value={submission.id}>{submission.reference} — {submission.title}</option>)}</select></label>
    <label>Author<select value={recipientEmail} disabled={!selected} onChange={(event) => setRecipientEmail(event.target.value)}><option value="">Choose a linked author</option>{selected?.recipients?.map((recipient) => <option key={recipient.email} value={recipient.email}>{recipient.name} — {recipient.email}</option>)}</select></label>
    <label>Subject<input value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value.replace(/[\r\n]/g, ""))} /></label>
    <label>Message<textarea value={body} maxLength={20000} rows={9} onChange={(event) => setBody(event.target.value)} placeholder="Write plain text. Talikha branding is applied when the email is sent." /></label>
    <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={!submissionId || !recipientEmail || !subject.trim() || !body.trim() || sending} onClick={() => { void onSend({ submissionId, recipientEmail, subject: subject.trim(), body: body.trim() }).catch(() => undefined); }}>{sending ? "Queueing…" : "Queue email"}</button></footer>
  </section></div>;
}
