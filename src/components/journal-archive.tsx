"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Journal, Publication } from "@/lib/types";
import { Icon } from "./icon";
import { comparePublicationsNewestFirst, formatPublicationDate } from "@/lib/journal-presentation";

const PAGE_SIZE = 24;

type JournalArchiveProps = {
  journal: Journal;
  publications: Publication[];
  initialSearch: string;
  initialVolume: string;
  initialIssue: string;
  initialPage: number;
};

function pageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}

function archivePart(value: string | undefined, prefix: "Volume" | "Issue") {
  return value && value !== "Unassigned" ? `${prefix} ${value}` : `${prefix} metadata pending`;
}

export function JournalArchive({ journal, publications, initialSearch, initialVolume, initialIssue, initialPage }: JournalArchiveProps) {
  const [search, setSearch] = useState(initialSearch);
  const [volume, setVolume] = useState(initialVolume);
  const [issue, setIssue] = useState(initialIssue);
  const [page, setPage] = useState(initialPage);

  const sortedPublications = useMemo(() => [...publications].sort(comparePublicationsNewestFirst), [publications]);
  const currentPublication = sortedPublications[0];
  const volumeOptions = useMemo(() => [...new Set(sortedPublications.map((publication) => publication.volume || "Unassigned"))].sort((a, b) => b.localeCompare(a, "en", { numeric: true })), [sortedPublications]);
  const issueOptions = useMemo(() => [...new Set(sortedPublications.filter((publication) => !volume || (publication.volume || "Unassigned") === volume).map((publication) => publication.issue || "Unassigned"))].sort((a, b) => b.localeCompare(a, "en", { numeric: true })), [sortedPublications, volume]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return sortedPublications.filter((publication) => {
      if (volume && (publication.volume || "Unassigned") !== volume) return false;
      if (issue && (publication.issue || "Unassigned") !== issue) return false;
      return !query || [publication.title, publication.authorDisplay, publication.abstract, publication.keywords.join(" ")].join(" ").toLocaleLowerCase().includes(query);
    });
  }, [issue, search, sortedPublications, volume]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const visiblePublications = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pages = pageItems(currentPage, totalPages);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (volume) params.set("volume", volume);
    if (issue) params.set("issue", issue);
    if (currentPage > 1) params.set("page", String(currentPage));
    const suffix = params.toString();
    window.history.replaceState(null, "", `/journals/${journal.slug}${suffix ? `?${suffix}` : ""}#archive`);
  }, [currentPage, issue, journal.slug, search, volume]);

  const resetPage = () => setPage(1);
  const changeVolume = (nextVolume: string) => {
    setVolume(nextVolume);
    if (issue && !publications.some((publication) => (publication.volume || "Unassigned") === nextVolume && (publication.issue || "Unassigned") === issue)) setIssue("");
    resetPage();
  };

  return <>
    {currentPublication && <aside className="journal-current-release" aria-label="Current archive release">
      <div><p>Current release</p><strong>{archivePart(currentPublication.volume, "Volume")} <span aria-hidden="true">·</span> {archivePart(currentPublication.issue, "Issue")}</strong></div>
    </aside>}
    <form className="journal-archive-controls" onSubmit={(event) => event.preventDefault()}>
      <label>Search publications<span className="journal-search-field"><Icon name="search" className="h-4 w-4" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Search titles, authors, or keywords" /></span></label>
      <div className="journal-select-grid">
        <label>Current volume<select value={volume} onChange={(event) => changeVolume(event.target.value)}><option value="">All volumes</option>{volumeOptions.map((item) => <option key={item} value={item}>{item === "Unassigned" ? "Metadata pending" : `Volume ${item}`}</option>)}</select></label>
        <label>Current issue<select value={issue} onChange={(event) => { setIssue(event.target.value); resetPage(); }}><option value="">All issues</option>{issueOptions.map((item) => <option key={item} value={item}>{item === "Unassigned" ? "Metadata pending" : `Issue ${item}`}</option>)}</select></label>
      </div>
    </form>
    <p className="journal-filter-status" role="status">{filtered.length.toLocaleString("en-US")} publication{filtered.length === 1 ? "" : "s"}{search || volume || issue ? " match the selected filters" : " in this archive"}.</p>
    <div className="journal-latest-list" id="journalLatestGrid">
      {visiblePublications.map((publication) => <article className="journal-latest-record" key={publication.id}><Link href={`/publications/${publication.slug}`} className="journal-latest-image" aria-label={`Read ${publication.title}`}><Image src={journal.heroImage} alt="" fill sizes="145px" /></Link><div className="journal-latest-content"><div className="journal-latest-badges"><span>{publication.contentType}</span>{publication.licenseUrl && <span className="journal-open-access"><Icon name="unlock" className="h-3.5 w-3.5" />Open access</span>}</div><h3><Link href={`/publications/${publication.slug}`}>{publication.title}</Link></h3><p className="journal-latest-authors">{publication.authors.length ? publication.authors.map((author, index) => <span key={author.id}>{index > 0 && ", "}<Link href={`/authors/${author.slug}`}>{author.name}</Link></span>) : publication.authorDisplay}</p><div className="journal-latest-meta"><time dateTime={publication.publicationDate}>{formatPublicationDate(publication)}</time>{publication.volume && <span><strong>Vol. {publication.volume}</strong>{publication.issue ? `, No. ${publication.issue}` : ""}</span>}{publication.doi && <span>DOI {publication.doi}</span>}</div></div></article>)}
      {!visiblePublications.length && <p className="journal-empty-state">No verified publications match these filters.</p>}
    </div>
    {totalPages > 1 && <nav className="journal-pagination" aria-label="Publication archive pages">
      <button type="button" className="journal-pagination-previous" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} aria-label="Go to previous page"><Icon name="arrow" className="h-4 w-4" /> <span>Previous</span></button>
      {pages.map((target, index) => <span className="journal-pagination-item" key={target}>{index > 0 && target - pages[index - 1] > 1 && <span className="journal-pagination-ellipsis" aria-hidden="true">…</span>}<button type="button" className={target === currentPage ? "active" : ""} aria-current={target === currentPage ? "page" : undefined} onClick={() => setPage(target)}>{target}</button></span>)}
      <button type="button" className="journal-pagination-next" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages} aria-label="Go to next page"><span>Next</span> <Icon name="arrow" className="h-4 w-4" /></button>
    </nav>}
  </>;
}
