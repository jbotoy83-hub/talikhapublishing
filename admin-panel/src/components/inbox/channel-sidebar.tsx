import { AlertTriangle, CheckCircle2, Clock3, FolderOpen, Inbox, Send, Star } from "@/components/icons";
import type { InboxConnection, InboxFilter } from "./types";

const filters: Array<{ id: InboxFilter; label: string; Icon: typeof Inbox }> = [
  { id: "inbox", label: "Inbox", Icon: Inbox },
  { id: "submission", label: "Submission mail", Icon: FolderOpen },
  { id: "automated", label: "Automated", Icon: Clock3 },
  { id: "admin", label: "Admin sent", Icon: Send },
  { id: "starred", label: "Starred", Icon: Star },
  { id: "attention", label: "Needs attention", Icon: AlertTriangle }
];

export function ChannelSidebar({ connection, active, onChange }: { connection: InboxConnection | null; active: InboxFilter; onChange: (value: InboxFilter) => void }) {
  const connected = Boolean(connection?.outboundEnabled);
  const syncing = Boolean(connection?.syncEnabled);
  return <aside className="mail-rail">
    <div className="mail-brand"><span><Inbox size={19} /></span><div><small>Editorial correspondence</small><strong>Talikha Inbox</strong></div></div>
    <div className="mail-connection" data-ready={connected}>
      {connected ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <div><strong>{connected ? "Gmail sending ready" : "Gmail setup required"}</strong><span>{connection?.account || "talikhapublishing@gmail.com"}</span></div>
    </div>
    <nav aria-label="Inbox folders">{filters.map(({ id, label, Icon }) => <button key={id} type="button" data-active={active === id} onClick={() => onChange(id)}><Icon size={17} /><span>{label}</span></button>)}</nav>
    <div className="mail-sync-card"><small>Mailbox synchronization</small><strong>{syncing ? connection?.sync?.phase || "Ready" : "Awaiting Google approval"}</strong><p>{syncing ? `${connection?.sync?.imported_threads || 0} Gmail threads imported.` : "Sending works independently. Full Inbox history remains safely disabled until read access is approved."}</p>{connection?.sync?.last_error && <em>{connection.sync.last_error}</em>}</div>
  </aside>;
}
