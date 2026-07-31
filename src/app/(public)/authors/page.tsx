import type { Metadata } from "next";
import { AuthorDirectoryShell } from "@/components/author-directory-shell";
import { getAuthors, getJournals, getPublications } from "@/lib/content";
import { formatPublicationDate } from "@/lib/journal-presentation";
import { SITE_NAME } from "@/lib/site";
import type { Author, Journal } from "@/lib/types";

export const revalidate = 300;

type AuthorParams = {
  page?: string;
  q?: string;
  journal?: string;
  works?: string;
  sort?: string;
  view?: string;
  mode?: string;
  perPage?: string;
};

const WORK_VALUES = ["any", "1-5", "6-10", "11-20", "20+"];

type Latest = { title: string; slug: string; dateLabel: string; dateKey: string };
type AuthorRecord = { author: Author; count: number; journals: Journal[]; latest: Latest | null };

export async function generateMetadata({ searchParams }: { searchParams: Promise<AuthorParams> }): Promise<Metadata> {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const filtered = Boolean(params.q?.trim() || params.journal || (params.works && params.works !== "any") || (params.sort && params.sort !== "name") || params.mode === "rankings");
  return {
    title: page > 1 ? `Authors - Page ${page}` : "Authors",
    description: `Meet the researchers, educators, poets, and writers published by ${SITE_NAME}.`,
    alternates: { canonical: !filtered && page > 1 ? `/authors?page=${page}` : "/authors" },
    robots: filtered ? { index: false, follow: true } : undefined
  };
}

function buildRecords(authors: Author[], publications: Awaited<ReturnType<typeof getPublications>>): AuthorRecord[] {
  const count = new Map<string, number>();
  const journals = new Map<string, Map<string, Journal>>();
  const latest = new Map<string, Latest>();
  for (const publication of publications) {
    const dateKey = publication.publicationDate;
    const dateLabel = formatPublicationDate(publication);
    for (const author of publication.authors) {
      count.set(author.id, (count.get(author.id) || 0) + 1);
      const authorJournals = journals.get(author.id) || new Map<string, Journal>();
      authorJournals.set(publication.journal.id, publication.journal);
      journals.set(author.id, authorJournals);
      const current = latest.get(author.id);
      if (!current || dateKey > current.dateKey) {
        latest.set(author.id, { title: publication.title, slug: publication.slug, dateLabel, dateKey });
      }
    }
  }
  return authors.map((author) => ({
    author,
    count: count.get(author.id) || 0,
    journals: [...(journals.get(author.id)?.values() || [])].sort((a, b) => a.title.localeCompare(b.title)),
    latest: latest.get(author.id) || null
  }));
}

function rankTie(a: AuthorRecord, b: AuthorRecord) {
  return (
    b.count - a.count ||
    b.journals.length - a.journals.length ||
    (b.latest?.dateKey || "").localeCompare(a.latest?.dateKey || "") ||
    a.author.name.localeCompare(b.author.name)
  );
}

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<AuthorParams> }) {
  const [authors, publications, journals, params] = await Promise.all([getAuthors(), getPublications(), getJournals(), searchParams]);
  const records = buildRecords(authors, publications);

  const ranked = [...records].sort(rankTie);
  const rankById = new Map<string, number>();
  ranked.forEach((record, index) => rankById.set(record.author.id, index + 1));

  const authorIdsByJournal = new Map<string, Set<string>>();
  for (const record of records) {
    if (record.count === 0) continue;
    for (const journal of record.journals) {
      const set = authorIdsByJournal.get(journal.slug) || new Set<string>();
      set.add(record.author.id);
      authorIdsByJournal.set(journal.slug, set);
    }
  }
  const journalFacets = journals
    .map((journal) => ({ id: journal.id, slug: journal.slug, title: journal.title, count: authorIdsByJournal.get(journal.slug)?.size || 0 }))
    .filter((journal) => journal.count > 0)
    .sort((a, b) => a.title.localeCompare(b.title));

  const payload = records.map((record) => ({
    id: record.author.id,
    slug: record.author.slug,
    name: record.author.name,
    affiliation: record.author.affiliation,
    credentials: record.author.credentials,
    imageUrl: record.author.imageUrl,
    publicationCount: record.count,
    journals: record.journals.map((journal) => ({ id: journal.id, title: journal.title, slug: journal.slug })),
    latest: record.latest,
    globalRank: rankById.get(record.author.id) || records.length
  }));

  const q = params.q?.trim() || "";
  const journal = journalFacets.some((item) => item.slug === params.journal) ? params.journal || "" : "";
  const works = params.works && WORK_VALUES.includes(params.works) ? params.works : "any";
  const sort = params.sort === "publications" || params.sort === "recent" ? params.sort : "name";
  const mode = params.mode === "rankings" ? "rankings" : "directory";
  const perPage = [10, 20, 50].includes(Number(params.perPage)) ? Number(params.perPage) : 10;
  const page = Math.max(1, Number(params.page) || 1);

  return (
    <main id="main-content" className="authors-directory-page">
      <header className="ad-hero">
        <svg className="ad-hero-art" viewBox="0 0 540 380" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1.4">
            <circle cx="330" cy="138" r="118" />
            <ellipse cx="330" cy="138" rx="48" ry="118" />
            <ellipse cx="330" cy="138" rx="92" ry="118" />
            <path d="M212 138h236M226 92h208M226 184h208" />
          </g>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M150 300c0-58 0-104 0-150" />
            <path d="M150 196c-22-6-40-22-44-46 24-2 42 12 44 46Z" />
            <path d="M150 168c20-8 34-26 36-50-24 0-40 16-36 50Z" />
            <path d="M150 232c-20-4-36-18-40-40 22-2 38 10 40 40Z" />
            <path d="M150 214c18-7 30-22 32-44-22 0-36 14-32 44Z" />
          </g>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M300 268c34-15 64-15 92 0 28-15 58-15 92 0v70c-34-15-64-15-92 0-28-15-58-15-92 0v-70Z" />
            <path d="M392 268v70" />
            <path d="M318 286c22-8 42-8 60 0M318 304c22-8 42-8 60 0M416 286c22-8 42-8 60 0M416 304c22-8 42-8 60 0" />
          </g>
        </svg>
        <div className="section-shell ad-hero-shell">
          <div className="ad-hero-copy">
            <p className="authors-overline">Author directory</p>
            <h1 className="ad-hero-title">Find contributors and publication profiles</h1>
            <p className="ad-hero-lede">Explore researchers and writers published across {SITE_NAME} journals. Use filters to discover experts, review their work, and view full publication profiles.</p>
          </div>
          <div className="ad-hero-stat">
            <span className="ad-hero-stat-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="3.2" /><path d="M22 19v-1a4 4 0 0 0-3-3.85M16 3.6a4 4 0 0 1 0 6.8" /></svg>
            </span>
            <div>
              <strong>{authors.length.toLocaleString("en-PH")}</strong>
              <small>contributors across our journals</small>
            </div>
          </div>
        </div>
      </header>

      <AuthorDirectoryShell
        authors={payload}
        journals={journalFacets}
        totals={{ authors: authors.length, journals: journalFacets.length }}
        initial={{ q, journal, works, sort, mode, page, perPage }}
      />
    </main>
  );
}
