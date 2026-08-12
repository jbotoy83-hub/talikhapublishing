import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Award, BookOpenCheck, CheckCircle2, Clock3, FileText, RefreshCw, Search } from "@/components/icons";
import { manuscriptApi } from "./api";
import type { ManuscriptSubmissionSummary } from "./types";

function relativeTime(value: string | null) {
  if (!value) return "Not saved yet";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function importLabel(status: ManuscriptSubmissionSummary["importStatus"]) {
  if (status === "ready") return "Import verified";
  if (status === "warning") return "Needs comparison";
  if (status === "unsupported") return "Replacement required";
  return "Ready to import";
}

export function EditorsHub({ onOpenManuscript }: { onOpenManuscript: (submissionId: string) => void }) {
  const [items, setItems] = useState<ManuscriptSubmissionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try { setItems((await manuscriptApi.eligible()).submissions); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Accepted manuscripts could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.title, item.author, item.reference, item.journal, item.stageLabel].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [items, query]);
  const recent = [...items].filter((item) => item.lastSavedAt).sort((a, b) => new Date(b.lastSavedAt || 0).getTime() - new Date(a.lastSavedAt || 0).getTime()).slice(0, 3);

  return <div className="me-hub">
    <header className="me-hub-header"><div><span className="me-eyebrow">Production tools</span><h1>Editors</h1><p>Prepare publication-ready manuscripts and certificates without leaving Talikha.</p></div><button type="button" className="me-secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={17} />Refresh</button></header>
    <section className="me-editor-entries" aria-label="Available editors">
      <button type="button" className="me-editor-entry is-primary" onClick={() => document.getElementById("accepted-manuscripts")?.scrollIntoView({ behavior: "smooth" })}>
        <span className="me-entry-icon"><BookOpenCheck size={26} /></span><span className="me-entry-copy"><small>Publication workspace</small><strong>Manuscript Editor</strong><span>Import Word or searchable PDF, compare the conversion, edit on an A4 canvas, and attach final DOCX and PDF versions.</span></span><span className="me-entry-action">Open queue <ArrowUpRight size={17} /></span>
      </button>
      <button type="button" className="me-editor-entry" onClick={() => window.location.assign("/admin?view=certificates")}>
        <span className="me-entry-icon"><Award size={26} /></span><span className="me-entry-copy"><small>Existing workspace</small><strong>Certificate Editor</strong><span>Create and export linked publication certificates using the current isolated editor.</span></span><span className="me-entry-action">Open editor <ArrowUpRight size={17} /></span>
      </button>
    </section>
    {recent.length ? <section className="me-recent-section"><div className="me-section-heading"><div><span className="me-eyebrow">Continue working</span><h2>Recent drafts</h2></div></div><div className="me-recent-grid">{recent.map((item) => <button type="button" key={item.id} className="me-recent-card" onClick={() => onOpenManuscript(item.id)}><span className="me-document-mark"><FileText size={18} /></span><strong>{item.title}</strong><span>{item.reference} · {item.author}</span><small><Clock3 size={14} />{relativeTime(item.lastSavedAt)}{item.lastEditor ? ` by ${item.lastEditor}` : ""}</small></button>)}</div></section> : null}
    <section className="me-queue-section" id="accepted-manuscripts">
      <div className="me-section-heading"><div><span className="me-eyebrow">Accepted and production</span><h2>Manuscript queue</h2></div><label className="me-hub-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, author, reference, journal, or status" aria-label="Search manuscript queue" /></label></div>
      {error ? <div className="me-hub-error">{error}<button type="button" onClick={() => void load()}>Try again</button></div> : null}
      {loading ? <div className="me-queue-loading"><RefreshCw size={20} />Loading eligible manuscripts…</div> : null}
      {!loading && !error ? <div className="me-queue-table-wrap"><table className="me-queue-table"><thead><tr><th>Manuscript</th><th>Journal</th><th>Production stage</th><th>Import</th><th>Last activity</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><span>{item.reference} · {item.author}</span></td><td>{item.journal}</td><td><span className="me-stage-pill">{item.stageLabel}</span></td><td><span className={`me-import-pill is-${item.importStatus}`}>{item.importStatus === "ready" ? <CheckCircle2 size={14} /> : null}{importLabel(item.importStatus)}</span></td><td><span>{item.lastEditor || "No editor yet"}</span><small>{relativeTime(item.lastSavedAt)}</small></td><td><button type="button" className="me-open-button" onClick={() => onOpenManuscript(item.id)}>{item.documentId ? "Continue" : "Start"}<ArrowUpRight size={15} /></button></td></tr>)}</tbody></table>{!filtered.length ? <div className="me-empty-queue"><FileText size={24} /><strong>No manuscripts match this search</strong><span>Try a title, author, reference, journal, or production status.</span></div> : null}</div> : null}
    </section>
  </div>;
}
