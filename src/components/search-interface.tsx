"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SearchResponse, SearchFilters, FacetItem } from "@/lib/search";

function useUrlState() {
  const [params, setParams] = useState<URLSearchParams>(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""));
  useEffect(() => {
    const handler = () => setParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  const update = useCallback((next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    if (!sp.get("page")) sp.delete("page");
    const qs = sp.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
    setParams(new URLSearchParams(qs));
  }, []);
  return { params, update };
}

function FacetGroup({ title, items, active, param, onUpdate }: { title: string; items: FacetItem[]; active: string | undefined; param: string; onUpdate: (v: Record<string, string | undefined>) => void }) {
  const [open, setOpen] = useState(true);
  if (!items.length) return null;
  return (
    <div className="search-facet-group">
      <button type="button" className="search-facet-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        <svg className={`search-facet-chevron${open ? " search-facet-chevron--open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div className={`search-facet-body${open ? " search-facet-body--open" : ""}`}>
        {items.slice(0, 8).map((item) => (
          <label key={item.value} className={`search-facet-item${active === item.value ? " search-facet-item--active" : ""}`}>
            <input type="radio" name={param} checked={active === item.value} onChange={() => onUpdate({ [param]: active === item.value ? undefined : item.value, page: undefined })} className="search-facet-radio" />
            <span className="search-facet-label">{item.label}</span>
            <span className="search-facet-count">{item.count}</span>
          </label>
        ))}
        {active && !items.some((i) => i.value === active) && (
          <button type="button" className="search-facet-clear" onClick={() => onUpdate({ [param]: undefined, page: undefined })}>Clear filter</button>
        )}
      </div>
    </div>
  );
}

export function SearchInterface() {
  const { params, update } = useUrlState();
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(params.get("q") || "");
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const filters: SearchFilters = {
    q: params.get("q") || undefined,
    journal: params.get("journal") || undefined,
    year: params.get("year") || undefined,
    type: params.get("type") || undefined,
    keyword: params.get("keyword") || undefined,
    sort: (params.get("sort") as SearchFilters["sort"]) || undefined,
    page: Number(params.get("page")) || 1
  };

  const doSearch = useCallback(async (f: SearchFilters) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (f.q) sp.set("q", f.q);
      if (f.journal) sp.set("journal", f.journal);
      if (f.year) sp.set("year", f.year);
      if (f.type) sp.set("type", f.type);
      if (f.keyword) sp.set("keyword", f.keyword);
      if (f.sort) sp.set("sort", f.sort);
      if (f.page && f.page > 1) sp.set("page", String(f.page));
      const res = await fetch(`/api/search?${sp}`, { signal: ctrl.signal });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { doSearch(filters); }, [params.toString()]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      update({ q: query || undefined, page: undefined });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const activePills: Array<{ param: string; label: string }> = [];
  if (filters.journal) activePills.push({ param: "journal", label: data?.facets.journals.find((j) => j.value === filters.journal)?.label || filters.journal });
  if (filters.year) activePills.push({ param: "year", label: filters.year });
  if (filters.type) activePills.push({ param: "type", label: filters.type });
  if (filters.keyword) activePills.push({ param: "keyword", label: filters.keyword });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="search-interface">
      <div className="search-bar-wrap">
        <div className="search-bar">
          <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search publications, authors, keywords…" className="search-bar-input" aria-label="Search" />
          {query && <button type="button" className="search-bar-clear" onClick={() => { setQuery(""); update({ q: undefined, page: undefined }); }} aria-label="Clear search">×</button>}
        </div>
        <select value={filters.sort || "relevance"} onChange={(e) => update({ sort: e.target.value === "relevance" ? undefined : e.target.value, page: undefined })} className="search-sort" aria-label="Sort results">
          <option value="relevance">Relevance</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      {activePills.length > 0 && (
        <div className="search-pills">
          {activePills.map((pill) => (
            <button key={pill.param} type="button" className="search-pill" onClick={() => update({ [pill.param]: undefined, page: undefined })}>
              {pill.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="search-pill search-pill--clear" onClick={() => update({ journal: undefined, year: undefined, type: undefined, keyword: undefined, page: undefined })}>Clear all</button>
        </div>
      )}

      {data && <p className="search-count">{data.total} result{data.total !== 1 ? "s" : ""}{filters.q ? ` for "${filters.q}"` : ""}</p>}

      <div className="search-layout">
        {data && (data.facets.journals.length > 0 || data.facets.years.length > 0 || data.facets.types.length > 0 || data.facets.keywords.length > 0) && (
          <aside className="search-sidebar" aria-label="Filters">
            <FacetGroup title="Journal" items={data.facets.journals} active={filters.journal} param="journal" onUpdate={update} />
            <FacetGroup title="Year" items={data.facets.years} active={filters.year} param="year" onUpdate={update} />
            <FacetGroup title="Type" items={data.facets.types} active={filters.type} param="type" onUpdate={update} />
            <FacetGroup title="Keyword" items={data.facets.keywords} active={filters.keyword} param="keyword" onUpdate={update} />
          </aside>
        )}

        <div className="search-results">
          {loading && <div className="search-loading"><div className="search-skeleton" /><div className="search-skeleton" /><div className="search-skeleton" /></div>}
          {!loading && data?.results.map((r) => (
            <article key={r.publication.id} className="search-result-card">
              <div className="search-result-accent" style={{ background: `var(--journal-accent-${r.publication.journal.accent || "emerald"}, #2f6e59)` }} />
              <div className="search-result-body">
                <div className="search-result-meta">
                  <Link href={`/journals/${r.publication.journal.slug}`} className="search-result-journal">{r.publication.journal.title}</Link>
                  <span className="search-result-type">{r.publication.contentType}</span>
                </div>
                <h3><Link href={`/publications/${r.publication.slug}`} dangerouslySetInnerHTML={{ __html: r.highlightTitle }} /></h3>
                <p className="search-result-authors">{r.publication.authorDisplay}</p>
                <p className="search-result-abstract" dangerouslySetInnerHTML={{ __html: r.highlightAbstract }} />
                <div className="search-result-footer">
                  {r.publication.doi && <span className="search-result-doi">{r.publication.doi}</span>}
                  {r.publication.volume && <span>Vol. {r.publication.volume}{r.publication.issue ? `, No. ${r.publication.issue}` : ""}</span>}
                  <time>{r.publication.publicationDate}</time>
                </div>
              </div>
            </article>
          ))}
          {!loading && data && data.results.length === 0 && (
            <div className="search-empty">
              <p>No results found{filters.q ? ` for "${filters.q}"` : ""}.</p>
              <p>Try adjusting your search or clearing filters.</p>
              <button type="button" className="search-empty-clear" onClick={() => { setQuery(""); update({ q: undefined, journal: undefined, year: undefined, type: undefined, keyword: undefined, page: undefined }); }}>Clear all filters</button>
            </div>
          )}
          {totalPages > 1 && (
            <nav className="search-pagination" aria-label="Search results pages">
              {(filters.page || 1) > 1 && <button type="button" onClick={() => update({ page: String((filters.page || 1) - 1) })}>← Previous</button>}
              <span>Page {filters.page || 1} of {totalPages}</span>
              {(filters.page || 1) < totalPages && <button type="button" onClick={() => update({ page: String((filters.page || 1) + 1) })}>Next →</button>}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
