import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { PublicationCard } from "@/components/publication-card";
import { getJournals, getPublications } from "@/lib/content";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 300;
const pageSize = 24;

type ArchiveParams = { page?: string; q?: string; journal?: string; sort?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<ArchiveParams> }): Promise<Metadata> {
  const { page: pageParam, q, journal } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const hasFilters = Boolean(q?.trim() || journal?.trim());
  return {
    title: page > 1 ? `Publications - Page ${page}` : "Publications",
    description: `Search and browse research, essays, creative work, and books published by ${SITE_NAME}.`,
    alternates: { canonical: !hasFilters && page > 1 ? `/publications?page=${page}` : "/publications" },
    robots: hasFilters ? { index: false, follow: true } : undefined
  };
}

function pageHref(page: number, params: ArchiveParams) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.journal) query.set("journal", params.journal);
  if (params.sort && params.sort !== "newest") query.set("sort", params.sort);
  if (page > 1) query.set("page", String(page));
  const value = query.toString();
  return value ? `/publications?${value}` : "/publications";
}

export default async function PublicationsPage({ searchParams }: { searchParams: Promise<ArchiveParams> }) {
  const [allPublications, journals, params] = await Promise.all([getPublications(), getJournals(), searchParams]);
  const query = params.q?.trim().toLocaleLowerCase() || "";
  const journal = params.journal?.trim() || "";
  const sort = params.sort === "oldest" || params.sort === "title" ? params.sort : "newest";

  const filtered = allPublications
    .filter((publication) => !journal || publication.journal.slug === journal)
    .filter((publication) => !query || [
      publication.title,
      publication.authorDisplay,
      publication.abstract,
      publication.doi || "",
      publication.keywords.join(" "),
      publication.journal.title
    ].join(" ").toLocaleLowerCase().includes(query))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const direction = sort === "oldest" ? 1 : -1;
      return a.publicationDate.localeCompare(b.publicationDate) * direction;
    });

  const requestedPage = Math.max(1, Number(params.page) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const doiCount = allPublications.filter((publication) => publication.doi).length;

  return (
    <main id="main-content" className="publication-archive-page">
      <header className="publication-archive-hero">
        <div className="publication-archive-orbit" aria-hidden="true" />
        <div className="section-shell publication-archive-hero-grid">
          <div>
            <p className="eyebrow">Publication archive</p>
            <h1>Published work, <em>carefully recorded.</em></h1>
            <p>Explore research, essays, and creative work with clear authorship, journal context, DOI data, and recommended citations.</p>
            <a href="#archive-results">Browse the archive <Icon name="arrow" className="h-4 w-4" /></a>
          </div>
          <dl aria-label="Archive summary">
            <div><dt>Records</dt><dd>{allPublications.length.toLocaleString("en-PH")}</dd></div>
            <div><dt>Journals</dt><dd>{journals.length}</dd></div>
            <div><dt>DOI-linked</dt><dd>{doiCount.toLocaleString("en-PH")}</dd></div>
          </dl>
        </div>
      </header>

      <section className="publication-archive-directory" id="archive-results">
        <div className="section-shell">
          <div className="publication-archive-heading">
            <div>
              <p className="eyebrow">Browse the collection</p>
              <h2>Find a publication</h2>
            </div>
            <p>Search across verified record fields or narrow the archive by journal. Every result opens at a stable, shareable URL.</p>
          </div>

          <form className="publication-filter-panel" action="/publications">
            <label className="publication-search-field">
              <span>Search the archive</span>
              <span className="publication-control-wrap"><Icon name="search" className="h-4 w-4" /><input name="q" type="search" defaultValue={params.q} placeholder="Title, author, DOI, or keyword" /></span>
            </label>
            <label>
              <span>Journal</span>
              <select name="journal" defaultValue={journal}>
                <option value="">All journals</option>
                {journals.map((item) => <option key={item.id} value={item.slug}>{item.title}</option>)}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select name="sort" defaultValue={sort}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A-Z</option>
              </select>
            </label>
            <button type="submit">Apply filters</button>
          </form>

          <div className="publication-result-bar" aria-live="polite">
            <p><strong>{filtered.length.toLocaleString("en-PH")}</strong> {filtered.length === 1 ? "publication" : "publications"}</p>
            {(query || journal || sort !== "newest") && <Link href="/publications">Clear filters</Link>}
          </div>

          {visible.length ? (
            <div className="publication-folio-grid">
              {visible.map((publication) => <PublicationCard key={publication.id} publication={publication} />)}
            </div>
          ) : (
            <div className="publication-empty-state">
              <Icon name="book" className="h-7 w-7" />
              <h2>No publications match these filters.</h2>
              <p>Try a broader search or return to the complete archive.</p>
              <Link href="/publications">View all publications</Link>
            </div>
          )}

          {pageCount > 1 && (
            <nav className="publication-pagination" aria-label="Publication archive pages">
              {page > 1 ? <Link href={pageHref(page - 1, params)}>Previous</Link> : <span />}
              <span>Page {page} of {pageCount}</span>
              {page < pageCount ? <Link href={pageHref(page + 1, params)}>Next</Link> : <span />}
            </nav>
          )}
        </div>
      </section>
    </main>
  );
}
