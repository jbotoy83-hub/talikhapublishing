"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import type { SearchResponse, SearchFilters, FacetItem } from "@/lib/search";
import { formatPublicationDate } from "@/lib/journal-presentation";
import { isOpenAccess } from "@/lib/citation-format";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

function useUrlState() {
  const router = useRouter();
  const params = useSearchParams();
  const update = useCallback((next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    if (!sp.get("page")) sp.delete("page");
    const qs = sp.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    router.replace(url, { scroll: false });
  }, [router]);
  return { params, update };
}

function FacetGroup({ title, items, active, param, onUpdate, defaultOpen = true }: { title: string; items: FacetItem[]; active: string | undefined; param: string; onUpdate: (v: Record<string, string | undefined>) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
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

function paginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const ordered = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  ordered.forEach((page, index) => {
    if (index > 0 && page - ordered[index - 1] > 1) result.push("ellipsis");
    result.push(page);
  });
  return result;
}

export function SearchInterface() {
  const { params, update } = useUrlState();
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(params.get("q") || "");
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipInitialQueryUpdateRef = useRef(true);

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
    setQuery(params.get("q") || "");
  }, [params]);

  useEffect(() => {
    if (skipInitialQueryUpdateRef.current) {
      skipInitialQueryUpdateRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      update({ q: query.trim() || undefined, page: undefined });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const activePills: Array<{ param: string; label: string }> = [];
  if (filters.journal) activePills.push({ param: "journal", label: data?.facets.journals.find((j) => j.value === filters.journal)?.label || filters.journal });
  if (filters.year) activePills.push({ param: "year", label: filters.year });
  if (filters.type) activePills.push({ param: "type", label: filters.type });
  if (filters.keyword) activePills.push({ param: "keyword", label: filters.keyword });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const activeFilterCount = activePills.length;

  return (
    <div className="search-interface">
      <div className="search-interface-heading">
        <div>
          <p className="search-overline">Search the catalogue</p>
          <h2>Publication records</h2>
        </div>
        <p>Browse the archive one record at a time.</p>
      </div>
      <form className="search-bar-wrap" onSubmit={(event) => { event.preventDefault(); update({ q: query.trim() || undefined, page: undefined }); }}>
        <div className="search-bar">
          <Icon name="search" className="search-bar-icon h-5 w-5" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search publications, authors, keywords…" className="search-bar-input" aria-label="Search" />
          {query && <button type="button" className="search-bar-clear" onClick={() => { setQuery(""); update({ q: undefined, page: undefined }); }} aria-label="Clear search">×</button>}
        </div>
        <label className="search-sort-control">
          <span>Sort by</span>
          <select value={filters.sort || "relevance"} onChange={(e) => update({ sort: e.target.value === "relevance" ? undefined : e.target.value, page: undefined })} className="search-sort" aria-label="Sort results">
            <option value="relevance">Relevance</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </form>

      {activePills.length > 0 && (
        <div className="search-pills" aria-label="Active filters">
          {activePills.map((pill) => (
            <button key={pill.param} type="button" className="search-pill" onClick={() => update({ [pill.param]: undefined, page: undefined })}>
              {pill.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="search-pill search-pill--clear" onClick={() => update({ journal: undefined, year: undefined, type: undefined, keyword: undefined, page: undefined })}>Clear all</button>
        </div>
      )}

      {data && <div className="search-result-summary"><p className="search-count"><strong>{data.total}</strong> result{data.total !== 1 ? "s" : ""}{filters.q ? ` for "${filters.q}"` : ""}</p><span>{activeFilterCount ? `${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active` : "All published records"}</span></div>}

      <div className="search-layout">
        {data && (data.facets.journals.length > 0 || data.facets.years.length > 0 || data.facets.types.length > 0 || data.facets.keywords.length > 0) && (
          <aside className="search-sidebar" aria-label="Filters">
            <div className="search-sidebar-heading"><span>Refine results</span><small>{activeFilterCount ? `${activeFilterCount} active` : "Optional"}</small></div>
            <FacetGroup title="Journal" items={data.facets.journals} active={filters.journal} param="journal" onUpdate={update} />
            <FacetGroup title="Year" items={data.facets.years} active={filters.year} param="year" onUpdate={update} />
            <FacetGroup title="Type" items={data.facets.types} active={filters.type} param="type" onUpdate={update} />
            <FacetGroup title="Keyword" items={data.facets.keywords} active={filters.keyword} param="keyword" onUpdate={update} defaultOpen={false} />
          </aside>
        )}

        <div className="search-results">
          {loading && <div className="search-loading"><div className="search-skeleton" /><div className="search-skeleton" /><div className="search-skeleton" /></div>}
          {!loading && data?.results.map((r) => (
            <article key={r.publication.id} className="search-result-card">
              <div className="search-result-accent" style={{ background: `var(--journal-accent-${r.publication.journal.accent || "emerald"}, #2f6e59)` }} />
              <div className="search-result-body">
                <div className="search-result-topline">
                  <div className="search-result-meta">
                    <Link href={`/journals/${r.publication.journal.slug}`} className="search-result-journal">{r.publication.journal.title}</Link>
                    <span className="search-result-type">{r.publication.contentType}</span>
                  </div>
                  <div className="search-result-status">
                    <div className={`search-result-access${isOpenAccess(r.publication.licenseName) ? " search-result-access--open" : ""}`}>
                      <Icon name={isOpenAccess(r.publication.licenseName) ? "unlock" : "lock"} className="h-3.5 w-3.5" />
                      <span>{isOpenAccess(r.publication.licenseName) ? "Open access" : r.publication.licenseName}</span>
                    </div>
                    <span className="search-result-views"><Icon name="eye" className="h-3.5 w-3.5" />{r.publication.views.toLocaleString("en-US")} views</span>
                  </div>
                </div>
                <h3><Link href={`/publications/${r.publication.slug}`} dangerouslySetInnerHTML={{ __html: r.highlightTitle }} /></h3>
                <p className="search-result-authors">{r.publication.authorDisplay}</p>
                {r.publication.abstract && <p className="search-result-abstract" dangerouslySetInnerHTML={{ __html: r.highlightAbstract }} />}
                <dl className="search-result-details">
                  <div><dt>Published</dt><dd><time dateTime={r.publication.publicationDate}>{formatPublicationDate(r.publication)}</time></dd></div>
                  {(r.publication.volume || r.publication.issue) && <div><dt>Issue</dt><dd>{r.publication.volume ? `Vol. ${r.publication.volume}` : ""}{r.publication.issue ? `${r.publication.volume ? ", " : ""}No. ${r.publication.issue}` : ""}</dd></div>}
                  {r.publication.pages && <div><dt>Pages</dt><dd>{r.publication.pages}</dd></div>}
                  {r.publication.doi && <div className="search-result-details-doi"><dt>DOI</dt><dd><a href={`https://doi.org/${r.publication.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}`} target="_blank" rel="noopener noreferrer">{r.publication.doi}</a></dd></div>}
                </dl>
                {r.publication.keywords.length > 0 && <div className="search-result-keywords"><span>Topics</span><div>{r.publication.keywords.slice(0, 4).map((keyword) => <Link key={keyword} href={`/search?keyword=${encodeURIComponent(keyword)}`}>{keyword}</Link>)}</div></div>}
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
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); if ((filters.page || 1) > 1) update({ page: String((filters.page || 1) - 1) }); }} /></PaginationItem>
                {paginationItems(filters.page || 1, totalPages).map((page, index) => page === "ellipsis" ? <PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem> : <PaginationItem key={page}><PaginationLink href="#" isActive={page === (filters.page || 1)} onClick={(event) => { event.preventDefault(); if (page !== (filters.page || 1)) update({ page: page > 1 ? String(page) : undefined }); }}>{page}</PaginationLink></PaginationItem>)}
                <PaginationItem><PaginationNext href="#" onClick={(event) => { event.preventDefault(); if ((filters.page || 1) < totalPages) update({ page: String((filters.page || 1) + 1) }); }} /></PaginationItem>
              </PaginationContent>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
