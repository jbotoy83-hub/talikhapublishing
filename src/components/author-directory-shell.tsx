"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { authorInitials, portraitColor } from "@/lib/author-display";

type DirJournal = { id: string; slug: string; title: string; count: number };
type DirAuthor = {
  id: string;
  slug: string;
  name: string;
  affiliation?: string;
  credentials?: string;
  imageUrl?: string;
  publicationCount: number;
  journals: { id: string; title: string; slug: string }[];
  latest: { title: string; slug: string; dateLabel: string; dateKey: string } | null;
  globalRank: number;
};
type DirInitial = {
  q: string;
  journal: string;
  works: string;
  sort: string;
  view: "list" | "card";
  mode: "directory" | "rankings";
  page: number;
  perPage: number;
};

const WORK_BUCKETS: { value: string; label: string; test: (n: number) => boolean }[] = [
  { value: "any", label: "Any number of works", test: () => true },
  { value: "1-5", label: "1 – 5 works", test: (n) => n >= 1 && n <= 5 },
  { value: "6-10", label: "6 – 10 works", test: (n) => n >= 6 && n <= 10 },
  { value: "11-20", label: "11 – 20 works", test: (n) => n >= 11 && n <= 20 },
  { value: "20+", label: "20 + works", test: (n) => n >= 20 }
];

const CHIP_TONES = [
  { bg: "#e7efe9", fg: "#1f5238", bd: "#cfe0d4" },
  { bg: "#fbe9e1", fg: "#9f4b2c", bd: "#f0cdbd" },
  { bg: "#efe9f4", fg: "#6b4a78", bd: "#ddcfe6" },
  { bg: "#fbf2dd", fg: "#8a5c2a", bd: "#ecdcb4" }
];

function chipTone(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return CHIP_TONES[hash % CHIP_TONES.length];
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.4" />
      <rect x="14" y="3" width="7" height="7" rx="1.4" />
      <rect x="3" y="14" width="7" height="7" rx="1.4" />
      <rect x="14" y="14" width="7" height="7" rx="1.4" />
    </svg>
  );
}
function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7Z" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 19v-1a4 4 0 0 0-3-3.85M16 3.6a4 4 0 0 1 0 6.8" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 18h6M10 14v4M14 14v4M8 21h8" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Avatar({ author, size }: { author: DirAuthor; size: number }) {
  if (author.imageUrl) {
    return (
      <span className="ad-avatar" style={{ width: size, height: size }}>
        <Image src={author.imageUrl} alt={`Portrait of ${author.name}`} fill sizes={`${size}px`} />
      </span>
    );
  }
  return (
    <span className="ad-avatar ad-avatar-fallback" style={{ width: size, height: size, backgroundColor: portraitColor(author.name), fontSize: Math.round(size * 0.34) }} aria-hidden="true">
      {authorInitials(author.name)}
    </span>
  );
}

function Chips({ journals }: { journals: DirAuthor["journals"] }) {
  if (!journals.length) return <span className="ad-muted">—</span>;
  return (
    <span className="ad-chips">
      {journals.map((journal) => {
        const tone = chipTone(journal.slug);
        return (
          <span key={journal.id} className="ad-chip" style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}>
            {journal.title}
          </span>
        );
      })}
    </span>
  );
}

export function AuthorDirectoryShell({
  authors,
  journals,
  totals,
  initial
}: {
  authors: DirAuthor[];
  journals: DirJournal[];
  totals: { authors: number; journals: number };
  initial: DirInitial;
}) {
  const [q, setQ] = useState(initial.q);
  const [journalSet, setJournalSet] = useState<string[]>(initial.journal ? [initial.journal] : []);
  const [works, setWorks] = useState(initial.works);
  const [sort, setSort] = useState(initial.sort);
  const [view, setView] = useState<"list" | "card">(initial.view);
  const [mode, setMode] = useState<"directory" | "rankings">(initial.mode);
  const [page, setPage] = useState(initial.page);
  const [perPage, setPerPage] = useState(initial.perPage);
  const [journalsOpen, setJournalsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (journalSet.length === 1) params.set("journal", journalSet[0]);
    if (works !== "any") params.set("works", works);
    if (sort !== "name") params.set("sort", sort);
    if (view !== "list") params.set("view", view);
    if (mode !== "directory") params.set("mode", mode);
    if (page > 1) params.set("page", String(page));
    if (perPage !== 10) params.set("perPage", String(perPage));
    const next = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [q, journalSet, works, sort, view, mode, page, perPage]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    const bucket = WORK_BUCKETS.find((item) => item.value === works) || WORK_BUCKETS[0];
    return authors.filter((author) => {
      if (needle) {
        const haystack = [author.name, author.affiliation || "", author.credentials || "", author.journals.map((journal) => journal.title).join(" ")].join(" ").toLocaleLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (journalSet.length && !author.journals.some((journal) => journalSet.includes(journal.slug))) return false;
      if (!bucket.test(author.publicationCount)) return false;
      return true;
    });
  }, [authors, q, journalSet, works]);

  const byRank = useMemo(() => [...filtered].sort((a, b) => a.globalRank - b.globalRank), [filtered]);
  const highlight = useMemo(() => (mode === "directory" ? byRank.slice(0, Math.min(3, byRank.length)) : []), [mode, byRank]);
  const highlightIds = useMemo(() => new Set(highlight.map((author) => author.id)), [highlight]);

  const rows = useMemo(() => {
    if (mode === "rankings") return byRank;
    const listed = filtered.filter((author) => !highlightIds.has(author.id));
    if (sort === "publications") return [...listed].sort((a, b) => a.globalRank - b.globalRank);
    if (sort === "recent") {
      return [...listed].sort((a, b) => (b.latest?.dateKey || "").localeCompare(a.latest?.dateKey || "") || a.name.localeCompare(b.name));
    }
    return [...listed].sort((a, b) => a.name.localeCompare(b.name));
  }, [mode, byRank, filtered, highlightIds, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, pageCount);
  if (safePage !== page) setPage(safePage);
  const start = (safePage - 1) * perPage;
  const paged = rows.slice(start, start + perPage);
  const showFrom = rows.length ? start + 1 : 0;
  const showTo = Math.min(start + perPage, rows.length);

  const journalVisible = journalsOpen ? journals : journals.slice(0, 5);
  const journalToolbarValue = journalSet.length === 1 ? journalSet[0] : "";
  const hasFilters = Boolean(q.trim() || journalSet.length || works !== "any" || sort !== "name");

  const resetPage = () => setPage(1);
  const toggleJournal = (slug: string) => {
    setJournalSet((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]));
    resetPage();
  };
  const goTopContributors = () => {
    if (mode !== "directory") setMode("directory");
    window.requestAnimationFrame(() => document.getElementById("ad-top")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const goRecent = () => {
    if (mode !== "directory") setMode("directory");
    setSort("recent");
    resetPage();
  };

  const pageNumbers = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1) as (number | "gap")[];
    const set = new Set<number>([1, pageCount, safePage, safePage - 1, safePage + 1]);
    const sorted = [...set].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
    const out: (number | "gap")[] = [];
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) out.push("gap");
      out.push(p);
      prev = p;
    }
    return out;
  }, [pageCount, safePage]);

  return (
    <div className="ad-wrap">
      <div className="ad-toolbar section-shell">
        <label className="ad-search">
          <span aria-hidden="true"><SearchIcon /></span>
          <input
            type="search"
            value={q}
            onChange={(event) => { setQ(event.target.value); resetPage(); }}
            placeholder="Search by name, affiliation, or publication…"
            aria-label="Search contributors by name, affiliation, or publication"
          />
        </label>
        <select
          className="ad-select"
          value={journalToolbarValue}
          onChange={(event) => { setJournalSet(event.target.value ? [event.target.value] : []); resetPage(); }}
          aria-label="Filter by journal"
        >
          <option value="">All journals</option>
          {journals.map((journal) => <option key={journal.slug} value={journal.slug}>{journal.title}</option>)}
        </select>
        {mode === "directory" && (
          <select
            className="ad-select"
            value={sort}
            onChange={(event) => { setSort(event.target.value); resetPage(); }}
            aria-label="Sort contributors"
          >
            <option value="name">Sort: Name A–Z</option>
            <option value="publications">Sort: Most published</option>
            <option value="recent">Sort: Recently published</option>
          </select>
        )}
        <span className="ad-count"><strong>{filtered.length}</strong> results</span>
        <div className="ad-seg" role="group" aria-label="Directory view mode">
          <button type="button" aria-pressed={mode === "directory"} className={mode === "directory" ? "is-active" : ""} onClick={() => { setMode("directory"); resetPage(); }}>
            <ListIcon /><span>Directory</span>
          </button>
          <button type="button" aria-pressed={mode === "rankings"} className={mode === "rankings" ? "is-active" : ""} onClick={() => { setMode("rankings"); resetPage(); }}>
            <CrownIcon /><span>Rankings</span>
          </button>
        </div>
      </div>

      <div className="ad-body section-shell">
        <aside className="ad-rail" aria-label="Refine contributors">
          <section className="ad-rail-group">
            <div className="ad-rail-head"><h3>Filter by journal</h3>{journalSet.length > 0 && <button type="button" className="ad-rail-clear" onClick={() => { setJournalSet([]); resetPage(); }}>Clear</button>}</div>
            <div className="ad-check-list">
              {journalVisible.map((journal) => (
                <label key={journal.slug} className="ad-check">
                  <input type="checkbox" checked={journalSet.includes(journal.slug)} onChange={() => toggleJournal(journal.slug)} />
                  <span className="ad-check-box" aria-hidden="true" />
                  <span className="ad-check-label">{journal.title}</span>
                  <b>{journal.count}</b>
                </label>
              ))}
            </div>
            {journals.length > 5 && (
              <button type="button" className="ad-rail-more" onClick={() => setJournalsOpen((open) => !open)} aria-expanded={journalsOpen}>
                {journalsOpen ? "Show less" : "Show more"}
              </button>
            )}
          </section>

          <section className="ad-rail-group">
            <div className="ad-rail-head"><h3>Published works</h3>{works !== "any" && <button type="button" className="ad-rail-clear" onClick={() => { setWorks("any"); resetPage(); }}>Clear</button>}</div>
            <div className="ad-check-list">
              {WORK_BUCKETS.map((bucket) => (
                <label key={bucket.value} className="ad-check ad-check-radio">
                  <input type="radio" name="ad-works" checked={works === bucket.value} onChange={() => { setWorks(bucket.value); resetPage(); }} />
                  <span className="ad-radio-box" aria-hidden="true" />
                  <span className="ad-check-label">{bucket.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="ad-rail-group">
            <div className="ad-rail-head"><h3>Quick links</h3></div>
            <div className="ad-quick">
              <button type="button" onClick={goTopContributors}><TrophyIcon /><span>Top contributors</span><ArrowIcon /></button>
              <button type="button" onClick={goRecent}><ClockIcon /><span>Recently published</span><ArrowIcon /></button>
            </div>
          </section>
        </aside>

        <div className="ad-main">
          {mode === "directory" && filtered.length > 0 && (
            <section className="ad-top" id="ad-top" aria-label="Top contributors">
              <div className="ad-top-head"><h2>Top contributors</h2></div>
              <div className="ad-top-grid">
                {highlight.map((author, index) => (
                  <Link href={`/authors/${author.slug}`} key={author.id} className="ad-top-card">
                    <span className="ad-top-rank">{String(index + 1).padStart(2, "0")}</span>
                    <Avatar author={author} size={52} />
                    <div className="ad-top-id">
                      <strong>{author.name}</strong>
                      <small>{author.affiliation || author.credentials || "Contributor"}</small>
                      {author.journals.length > 0 && <span className="ad-top-journals">{author.journals.slice(0, 2).map((journal) => { const tone = chipTone(journal.slug); return <span key={journal.id} style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}>{journal.title}</span>; })}</span>}
                    </div>
                    <div className="ad-top-stats">
                      <div><b>{author.publicationCount}</b><small>{author.publicationCount === 1 ? "Published work" : "Published works"}</small></div>
                      <div><b>{author.journals.length}</b><small>{author.journals.length === 1 ? "Journal" : "Journals"}</small></div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="ad-banner">
            <InfoIcon />
            <p>Rankings are based on total published works across all journals, then by number of journals contributed to, and recency of latest publication.</p>
          </div>

          <section className="ad-list" aria-label={mode === "rankings" ? "Contributor rankings" : "Contributors"}>
            <div className="ad-list-head">
              <h2>{mode === "rankings" ? "Rankings" : "Contributors"}<span>{rows.length} {rows.length === 1 ? "result" : "results"}</span></h2>
              {mode === "directory" && (
                <div className="ad-seg ad-seg-view" role="group" aria-label="Layout">
                  <button type="button" aria-pressed={view === "list"} className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}><ListIcon /><span>List view</span></button>
                  <button type="button" aria-pressed={view === "card"} className={view === "card" ? "is-active" : ""} onClick={() => setView("card")}><GridIcon /><span>Card view</span></button>
                </div>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="ad-empty">
                <span><UsersIcon /></span>
                <h3>{hasFilters ? "No contributors match these filters." : "No contributor profiles yet."}</h3>
                <p>{hasFilters ? "Try clearing a filter or searching a different name, affiliation, or journal." : "Published author profiles will appear here as records are connected."}</p>
                {hasFilters && <button type="button" className="ad-empty-clear" onClick={() => { setQ(""); setJournalSet([]); setWorks("any"); setSort("name"); resetPage(); }}>Clear all filters</button>}
              </div>
            ) : mode === "directory" && view === "card" ? (
              <div className="ad-card-grid">
                {paged.map((author) => (
                  <article key={author.id} className="ad-card">
                    <Link href={`/authors/${author.slug}`} className="ad-card-link">
                      <Avatar author={author} size={56} />
                      <div className="ad-card-id">
                        <h3>{author.name}</h3>
                        {author.credentials && <p>{author.credentials}</p>}
                      </div>
                      <Chips journals={author.journals} />
                      <div className="ad-card-foot">
                        <span><b>{author.publicationCount}</b> works</span>
                        <span><b>{author.journals.length}</b> {author.journals.length === 1 ? "journal" : "journals"}</span>
                      </div>
                      <span className="ad-card-cta">View profile <ArrowIcon /></span>
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th className="c-contributor">Contributor</th>
                      <th className="c-journals">Journals</th>
                      <th className="c-latest">Latest publication</th>
                      <th className="c-works">Works</th>
                      <th className="c-jcount">Journals</th>
                      <th className="c-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((author) => (
                      <tr key={author.id}>
                        <td className="c-contributor">
                          <Link href={`/authors/${author.slug}`} className="ad-row-id">
                            <Avatar author={author} size={40} />
                            <span>{author.name}</span>
                          </Link>
                        </td>
                        <td className="c-journals"><Chips journals={author.journals} /></td>
                        <td className="c-latest">{author.latest ? <Link href={`/publications/${author.latest.slug}`} className="ad-latest"><strong>{author.latest.title}</strong><small>{author.latest.dateLabel}</small></Link> : <span className="ad-muted">—</span>}</td>
                        <td className="c-works"><b>{author.publicationCount}</b></td>
                        <td className="c-jcount"><b>{author.journals.length}</b></td>
                        <td className="c-action"><Link href={`/authors/${author.slug}`} className="ad-view">View profile</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && (
              <div className="ad-foot">
                <span className="ad-foot-range">Showing {showFrom} to {showTo} of {rows.length} results</span>
                <nav className="ad-pager" aria-label="Pagination">
                  <button type="button" className="ad-pager-btn" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  {pageNumbers.map((entry, index) => entry === "gap" ? <span key={`gap-${index}`} className="ad-pager-gap">…</span> : (
                    <button key={entry} type="button" className={`ad-pager-btn${entry === safePage ? " is-active" : ""}`} onClick={() => setPage(entry)} aria-current={entry === safePage ? "page" : undefined} aria-label={`Page ${entry}`}>{entry}</button>
                  ))}
                  <button type="button" className="ad-pager-btn" disabled={safePage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} aria-label="Next page">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                </nav>
                <label className="ad-perpage">Show
                  <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); resetPage(); }} aria-label="Results per page">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  per page
                </label>
              </div>
            )}
          </section>
        </div>
      </div>
      <span className="ad-sr-only" aria-hidden="true">{totals.authors} contributors across {totals.journals} journals</span>
    </div>
  );
}
