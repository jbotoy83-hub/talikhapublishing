import { AlertTriangle, ChevronLeft, Plus, Search, Star } from "@/components/icons";
import { relativeTime } from "./format";
import type { InboxFilter, InboxThreadSummary } from "./types";

const mobileFilters: Array<{ id: InboxFilter; label: string }> = [{ id: "inbox", label: "Inbox" }, { id: "submission", label: "Submission mail" }, { id: "automated", label: "Automated" }, { id: "admin", label: "Admin sent" }, { id: "starred", label: "Starred" }, { id: "attention", label: "Needs attention" }];

const filterTitles: Record<InboxFilter, string> = {
  inbox: "Inbox",
  submission: "Submission mail",
  automated: "Automated",
  admin: "Admin sent",
  starred: "Starred",
  attention: "Needs attention"
};

export function ConversationList({ threads, selectedId, search, loading, total, page, pageSize, filter, onFilter, onSearch, onSelect, onCompose, onPage }: { threads: InboxThreadSummary[]; selectedId: string | null; search: string; loading: boolean; total: number; page: number; pageSize: number; filter: InboxFilter; onFilter: (value: InboxFilter) => void; onSearch: (value: string) => void; onSelect: (id: string) => void; onCompose: () => void; onPage: (page: number) => void }) {
  return <section className="mail-list">
    <header><div><h2>{filterTitles[filter]}</h2><span>{loading ? "Updating…" : `${total} conversation${total === 1 ? "" : "s"}`}</span></div><button className="mail-compose-button" type="button" onClick={onCompose}><Plus size={15} /> New email</button></header>
    <div className="mail-list-tools"><label className="mail-search"><Search size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search mail" aria-label="Search sender, subject, reference or work title" /></label></div>
    <label className="mail-mobile-filter"><span>Folder</span><select value={filter} onChange={(event) => onFilter(event.target.value as InboxFilter)}>{mobileFilters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div className="mail-list-meta"><span>Newest first</span><span>{page > 1 ? `Page ${page}` : "All current mail"}</span></div>
    <div className="mail-rows">
      {loading && Array.from({ length: 5 }, (_, index) => <div className="mail-row-skeleton" key={index}><span /><div><i /><i /><i /></div></div>)}
      {!loading && threads.length === 0 && <div className="mail-empty"><span><Search size={20} /></span><h3>No correspondence here yet</h3><p>Submission confirmations and administrator email will appear here.</p></div>}
      {!loading && threads.map((thread) => <button key={thread.id} type="button" className="mail-row" data-active={selectedId === thread.id} data-unread={thread.unread} aria-pressed={selectedId === thread.id} onClick={() => onSelect(thread.id)}><span className="mail-avatar">{(thread.participant_name || thread.participant_email || "E").slice(0, 2).toUpperCase()}</span><span className="mail-row-copy"><span className="mail-row-top"><strong>{thread.participant_name || thread.participant_email || "Unknown correspondent"}</strong><time>{relativeTime(thread.last_message_at)}</time></span><b>{thread.subject}</b><span>{thread.snippet}</span><span className="mail-tags">{thread.submission && <em>{thread.submission.reference}</em>}<em data-source={thread.source}>{thread.source === "gmail" ? "Gmail" : thread.source}</em>{thread.needs_attention && <em className="attention"><AlertTriangle size={11} /> Attention</em>}</span></span>{thread.starred && <Star className="mail-star" size={14} />}</button>)}
    </div>
    {total > pageSize && <footer className="mail-pagination"><button type="button" disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /> Previous</button><span>Page {page} of {Math.ceil(total / pageSize)}</span><button type="button" disabled={page * pageSize >= total} onClick={() => onPage(page + 1)}>Next <ChevronLeft className="rotate-180" size={15} /></button></footer>}
  </section>;
}
