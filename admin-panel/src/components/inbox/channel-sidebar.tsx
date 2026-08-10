import { AlertTriangle, CheckCircle2, Clock3, FolderOpen, Inbox, RefreshCw, Send, Star } from "@/components/icons";
import type { InboxConnection, InboxFilter } from "./types";

const filters: Array<{ id: InboxFilter; label: string; Icon: typeof Inbox }> = [
  { id: "inbox", label: "Inbox", Icon: Inbox },
  { id: "submission", label: "Submission mail", Icon: FolderOpen },
  { id: "automated", label: "Automated", Icon: Clock3 },
  { id: "admin", label: "Admin sent", Icon: Send },
  { id: "starred", label: "Starred", Icon: Star },
  { id: "attention", label: "Needs attention", Icon: AlertTriangle }
];

export function ChannelSidebar({ connection, active, syncStarting, onSync, onChange }: { connection: InboxConnection | null; active: InboxFilter; syncStarting: boolean; onSync: () => void; onChange: (value: InboxFilter) => void }) {
  const connected = Boolean(connection?.outboundEnabled);
  const syncing = Boolean(connection?.syncEnabled);

  return <aside className="mail-rail">
    <header className="mail-brand"><span><Inbox size={18} /></span><div><strong>Inbox</strong><small>Editorial correspondence</small></div></header>
    <div className="mail-connection" data-ready={connected}>
      {connected ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      <div><strong>{connected ? "Gmail connected" : "Gmail setup required"}</strong><span>{connection?.account || "talikhapublishing@gmail.com"}</span></div>
    </div>
    <div className="mail-rail-section">
      <span className="mail-rail-label">Mailboxes</span>
      <nav aria-label="Inbox folders">{filters.map(({ id, label, Icon }) => <button key={id} type="button" data-active={active === id} aria-current={active === id ? "page" : undefined} onClick={() => onChange(id)}><Icon size={16} /><span>{label}</span></button>)}</nav>
    </div>
    <div className="mail-sync-card"><small>Mailbox sync</small><strong>{syncing ? connection?.sync?.phase || "Ready" : "Read access pending"}</strong><p>{syncing ? `${connection?.sync?.imported_threads || 0} Gmail threads imported.` : "Sending remains available while Inbox reading is disabled."}</p>{connection?.sync?.last_error && <em>{connection.sync.last_error}</em>}{syncing && <button type="button" onClick={onSync} disabled={syncStarting}><RefreshCw size={13} />{syncStarting ? "Starting…" : connection?.sync?.backfill_complete ? "Sync now" : "Start Inbox import"}</button>}</div>
  </aside>;
}
