import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { demoAuthors, demoJournals, demoPublications } from "@/data/demo-content";
import { isDemoContentEnabled } from "@/lib/launch";
import type { Author, Journal, Publication } from "@/lib/types";
import { getPublicSupabase } from "@/lib/supabase/public";
type StoreJournal = { id: string; slug: string; title: string; description?: string; scope?: string; issnOnline?: string; issn?: string; hero?: string; hero_image_url?: string; accent?: string; status?: string; deleted?: boolean; [k: string]: unknown };
type StoreIssue = { id: string; journalId: string; volume: string; issue: string; title?: string; status?: string; isCurrent?: boolean; publicationDate?: string; cover?: string; deleted?: boolean; [k: string]: unknown };
export type JournalStore = { version?: number; journals: StoreJournal[]; issues: StoreIssue[] };
export type JournalCurrentIssue = { id: string; volume: string; issue: string; title: string; status: string; publicationDate: string; cover: string };
export type JournalIssueSummary = { id: string; volume: string; issue: string; title: string; status: string; isCurrent: boolean; publicationDate: string; cover: string };

const JOURNAL_STORE_PATH = join(process.cwd(), "src", "data", "journal-store.json");
const DEFAULT_JOURNAL_STORE: JournalStore = {
  version: 1,
  journals: [
    { id: "11111111-1111-4111-8111-111111111111", slug: "inquira", title: "InQuira", description: "A peer-reviewed journal for empirical research, classroom inquiry, and applied scholarship.", scope: "Education, social science, language, public service, technology, health, and multidisciplinary research.", issnOnline: "3000-0001", hero: "/assets/journal-academic-frontiers-hero.jpg", accent: "emerald", status: "published" },
    { id: "22222222-2222-4222-8222-222222222222", slug: "lumera", title: "Lumera", description: "A literary journal for poetry, fiction, creative nonfiction, essays, and reflective writing.", scope: "Poetry, fiction, creative nonfiction, essays, literary reflection, and creative expression.", issnOnline: "3000-0011", hero: "/assets/journal-echoes-expression-hero.jpg", accent: "clay", status: "published" }
  ],
  issues: [
    { id: "iss-inq-1-1", journalId: "11111111-1111-4111-8111-111111111111", volume: "1", issue: "1", title: "Inaugural issue", status: "published", isCurrent: true, publicationDate: "2026-03-15", cover: "/assets/journal-academic-frontiers-hero.jpg" },
    { id: "iss-lum-1-1", journalId: "22222222-2222-4222-8222-222222222222", volume: "1", issue: "1", title: "First light", status: "published", isCurrent: true, publicationDate: "2026-04-20", cover: "/assets/journal-echoes-expression-hero.jpg" }
  ]
};

function readJournalStore(): JournalStore {
  try {
    const raw = readFileSync(JOURNAL_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as JournalStore;
    if (parsed && Array.isArray(parsed.journals) && Array.isArray(parsed.issues)) return parsed;
  } catch {
    /* store missing or unreadable on this request — use the built-in default */
  }
  return DEFAULT_JOURNAL_STORE;
}

export function getJournalStore(): JournalStore {
  return readJournalStore();
}

function mapStoreJournal(j: StoreJournal): Journal {
  return {
    id: j.id,
    slug: j.slug,
    title: j.title,
    description: j.description || "",
    scope: j.scope || "",
    issn: j.issnOnline || j.issn || "",
    heroImage: j.hero || j.hero_image_url || "/assets/journal-academic-frontiers-hero.jpg",
    accent: j.accent || "emerald"
  };
}

function storeJournalsAll(): Journal[] {
  return readJournalStore().journals.filter((j) => !j.deleted).map(mapStoreJournal);
}

function storeJournals(): Journal[] {
  return readJournalStore().journals.filter((j) => !j.deleted && (j.status || "published") === "published").map(mapStoreJournal);
}

function withStoreJournals(publications: Publication[]): Publication[] {
  const byId = new Map(storeJournalsAll().map((j) => [j.id, j]));
  return publications.map((p) => {
    const sj = byId.get(p.journal.id);
    return sj ? { ...p, journal: sj } : p;
  });
}

export function getCurrentIssueForJournal(journalId: string): JournalCurrentIssue | null {
  const issues = readJournalStore().issues.filter((i) => i.journalId === journalId && !i.deleted);
  const i = issues.find((x) => x.isCurrent) || issues.find((x) => (x.status || "") === "published");
  if (!i) return null;
  return { id: i.id, volume: i.volume, issue: i.issue, title: i.title || "", status: i.status || "", publicationDate: i.publicationDate || "", cover: i.cover || "" };
}

export function getJournalIssues(journalId: string): JournalIssueSummary[] {
  return readJournalStore().issues.filter((i) => i.journalId === journalId && !i.deleted).map((i) => ({ id: i.id, volume: i.volume, issue: i.issue, title: i.title || "", status: i.status || "", isCurrent: Boolean(i.isCurrent), publicationDate: i.publicationDate || "", cover: i.cover || "" }));
}


type JournalRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  scope: string | null;
  issn: string | null;
  hero_image_url: string | null;
  accent: string | null;
};

type AuthorRow = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  affiliation: string | null;
  credentials: string | null;
  orcid: string | null;
  image_url: string | null;
};

type PublicationRow = {
  id: string;
  slug: string;
  title: string;
  abstract: string | null;
  keywords: string[] | null;
  publication_date: string | null;
  updated_at: string;
  volume: string | null;
  issue_number: string | null;
  pages: string | null;
  doi: string | null;
  pdf_url: string | null;
  recommended_citation: string | null;
  license_name: string | null;
  license_url: string | null;
  copyright_holder: string | null;
  featured: boolean | null;
  content_type: "research" | "creative" | "commentary" | null;
  author_display: string | null;
  journal: JournalRow | JournalRow[] | null;
  publication_authors:
    | Array<{ position: number; author: AuthorRow | AuthorRow[] | null }>
    | null;
};

function mapJournal(row: JournalRow): Journal {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || "",
    scope: row.scope || "",
    issn: row.issn || "",
    heroImage: row.hero_image_url || "/assets/journal-academic-frontiers-hero.jpg",
    accent: row.accent || "emerald"
  };
}

function mapAuthor(row: AuthorRow): Author {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    bio: row.bio || "",
    affiliation: row.affiliation || undefined,
    credentials: row.credentials || undefined,
    orcid: row.orcid || undefined,
    imageUrl: row.image_url || undefined
  };
}

function mapPublication(row: PublicationRow): Publication | null {
  const journalRecord = Array.isArray(row.journal) ? row.journal[0] : row.journal;
  if (!journalRecord) return null;
  const authors = (row.publication_authors || [])
    .sort((a, b) => a.position - b.position)
    .flatMap((record) => {
      const author = Array.isArray(record.author) ? record.author[0] : record.author;
      return author ? [mapAuthor(author)] : [];
    });
  const citationYear = row.recommended_citation?.match(/\(((?:19|20)\d{2})\)/)?.[1];
  const publicationDate = row.publication_date || citationYear || row.updated_at.slice(0, 4);
  const normalizedYearOnlyDate = Boolean(row.publication_date?.endsWith("-01-01") && citationYear === row.publication_date.slice(0, 4));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    abstract: row.abstract || "",
    keywords: row.keywords || [],
    journal: mapJournal(journalRecord),
    authors,
    authorDisplay: row.author_display || authors.map((author) => author.name).join("; "),
    publicationDate: normalizedYearOnlyDate ? publicationDate.slice(0, 4) : publicationDate,
    publicationDatePrecision: row.publication_date && !normalizedYearOnlyDate ? "day" : "year",
    modifiedDate: row.updated_at.slice(0, 10),
    volume: row.volume || undefined,
    issue: row.issue_number || undefined,
    pages: row.pages || undefined,
    doi: row.doi || undefined,
    pdfUrl: row.pdf_url || undefined,
    recommendedCitation: row.recommended_citation || "",
    licenseName: row.license_name || "All rights reserved",
    licenseUrl: row.license_url || "",
    copyrightHolder: row.copyright_holder || "The authors",
    featured: Boolean(row.featured),
    contentType: row.content_type || "research"
  };
}

const publicationSelect = `
  id, slug, title, abstract, keywords, publication_date, updated_at,
  volume, issue_number, pages, doi, pdf_url, recommended_citation,
  license_name, license_url, copyright_holder, featured, content_type, author_display,
  journal:journals(id, slug, title, description, scope, issn, hero_image_url, accent),
  publication_authors(position, author:authors(id, slug, name, bio, affiliation, credentials, orcid, image_url))
`;

const homePublicationSelect = `
  id, slug, title, abstract, keywords, publication_date, updated_at,
  volume, issue_number, pages, doi, pdf_url, recommended_citation,
  license_name, license_url, copyright_holder, featured, content_type, author_display,
  journal:journals(id, slug, title, description, scope, issn, hero_image_url, accent),
  publication_authors(position, author:authors(id, slug, name))
`;

export type JournalArchiveEntry = {
  id: string;
  journalId: string;
  volume?: string;
  issue?: string;
};

export type PublicContentCounts = {
  publications: number;
  authors: number;
  openAccess: number;
};


function fallbackPublications() {
  const base = isDemoContentEnabled() ? [...demoPublications] : [];
  return withStoreJournals(base);
}

function fallbackJournals() {
  return storeJournals();
}

function fallbackAuthors() {
  return isDemoContentEnabled() ? [...demoAuthors] : [];
}

function reportReadFailure(
  operation: string,
  error: { code?: string; message?: string } | null
) {
  if (!error) return;
  console.error(`[content] ${operation} failed`, {
    code: error.code || "unknown",
    message: error.message || "Unknown Supabase error"
  });
}

export const getPublications = cache(async (): Promise<Publication[]> => {
  const supabase = getPublicSupabase();
  if (!supabase) return fallbackPublications();
  const rows: PublicationRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("publications")
      .select(publicationSelect)
      .eq("status", "published")
      .order("publication_date", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error || !data) {
      reportReadFailure("getPublications", error);
      return fallbackPublications();
    }
    rows.push(...(data as unknown as PublicationRow[]));
    if (data.length < pageSize) break;
  }
  const mapped = rows
    .map(mapPublication)
    .filter((item): item is Publication => Boolean(item));
  return mapped.length ? mapped : fallbackPublications();
});

export const getHomePublications = cache(async (limit = 24): Promise<Publication[]> => {
  const supabase = getPublicSupabase();
  if (!supabase) return fallbackPublications().slice(0, limit);
  const { data, error } = await supabase
    .from("publications")
    .select(homePublicationSelect)
    .eq("status", "published")
    .order("publication_date", { ascending: false })
    .limit(limit);
  if (error || !data) {
    reportReadFailure("getHomePublications", error);
    return fallbackPublications().slice(0, limit);
  }
  return (data as unknown as PublicationRow[])
    .map(mapPublication)
    .filter((item): item is Publication => Boolean(item));
});

export const getPublicContentCounts = cache(async (): Promise<PublicContentCounts> => {
  const supabase = getPublicSupabase();
  if (!supabase) {
    const publications = fallbackPublications();
    return {
      publications: publications.length,
      authors: fallbackAuthors().length,
      openAccess: publications.filter((publication) => Boolean(publication.licenseUrl)).length
    };
  }
  const [publicationResult, authorResult, openAccessResult] = await Promise.all([
    supabase.from("publications").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("authors").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("publications").select("id", { count: "exact", head: true }).eq("status", "published").not("license_url", "is", null).neq("license_url", "")
  ]);
  if (publicationResult.error || authorResult.error || openAccessResult.error) {
    reportReadFailure("getPublicContentCounts.publications", publicationResult.error);
    reportReadFailure("getPublicContentCounts.authors", authorResult.error);
    reportReadFailure("getPublicContentCounts.openAccess", openAccessResult.error);
    const publications = fallbackPublications();
    return {
      publications: publications.length,
      authors: fallbackAuthors().length,
      openAccess: publications.filter((publication) => Boolean(publication.licenseUrl)).length
    };
  }
  return {
    publications: publicationResult.count || 0,
    authors: authorResult.count || 0,
    openAccess: openAccessResult.count || 0
  };
});

export const getJournalArchiveEntries = cache(async (): Promise<JournalArchiveEntry[]> => {
  const supabase = getPublicSupabase();
  if (!supabase) {
    return fallbackPublications().map((publication) => ({
      id: publication.id,
      journalId: publication.journal.id,
      volume: publication.volume,
      issue: publication.issue
    }));
  }
  const rows: Array<{ id: string; journal_id: string; volume: string | null; issue_number: string | null }> = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("publications")
      .select("id, journal_id, volume, issue_number")
      .eq("status", "published")
      .range(from, from + pageSize - 1);
    if (error || !data) {
      reportReadFailure("getJournalArchiveEntries", error);
      return [];
    }
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows.map((row) => ({
    id: row.id,
    journalId: row.journal_id,
    volume: row.volume || undefined,
    issue: row.issue_number || undefined
  }));
});

export async function getPublication(slug: string) {
  const supabase = getPublicSupabase();
  if (!supabase) return fallbackPublications().find((publication) => publication.slug === slug) || null;
  const { data, error } = await supabase
    .from("publications")
    .select(publicationSelect)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) {
    reportReadFailure("getPublication", error);
    return fallbackPublications().find((publication) => publication.slug === slug) || null;
  }
  return mapPublication(data as unknown as PublicationRow);
}

export const getJournals = cache(async (): Promise<Journal[]> => {
  const supabase = getPublicSupabase();
  if (!supabase) return fallbackJournals();
  const { data, error } = await supabase
    .from("journals")
    .select("id, slug, title, description, scope, issn, hero_image_url, accent")
    .eq("status", "published")
    .order("title");
  if (error || !data?.length) {
    reportReadFailure("getJournals", error);
    return fallbackJournals();
  }
  return (data as JournalRow[]).map(mapJournal);
});


export async function getJournal(slug: string) {
  const supabase = getPublicSupabase();
  if (!supabase) return fallbackJournals().find((journal) => journal.slug === slug) || null;
  const { data, error } = await supabase
    .from("journals")
    .select("id, slug, title, description, scope, issn, hero_image_url, accent")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) {
    reportReadFailure("getJournal", error);
    return fallbackJournals().find((journal) => journal.slug === slug) || null;
  }
  return mapJournal(data as JournalRow);
}

export const getAuthors = cache(async (): Promise<Author[]> => {
  const supabase = getPublicSupabase();
  if (!supabase) return fallbackAuthors();
  const { data, error } = await supabase
    .from("authors")
    .select("id, slug, name, bio, affiliation, credentials, orcid, image_url")
    .eq("status", "published")
    .order("name");
  if (error || !data?.length) {
    reportReadFailure("getAuthors", error);
    return fallbackAuthors();
  }
  return (data as AuthorRow[]).map(mapAuthor);
});

export async function getAuthor(slug: string) {
  const supabase = getPublicSupabase();
  if (!supabase) return fallbackAuthors().find((author) => author.slug === slug) || null;
  const { data, error } = await supabase
    .from("authors")
    .select("id, slug, name, bio, affiliation, credentials, orcid, image_url")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) {
    reportReadFailure("getAuthor", error);
    return fallbackAuthors().find((author) => author.slug === slug) || null;
  }
  return mapAuthor(data as AuthorRow);
}

export async function getAuthorPublications(authorId: string) {
  const supabase = getPublicSupabase();
  if (!supabase) return fallbackPublications().filter((publication) => publication.authors.some((author) => author.id === authorId));
  const { data: links, error: linkError } = await supabase.from("publication_authors").select("publication_id").eq("author_id", authorId);
  if (linkError) {
    reportReadFailure("getAuthorPublications.links", linkError);
    return fallbackPublications().filter((publication) => publication.authors.some((author) => author.id === authorId));
  }
  if (!links?.length) return [];
  const { data, error } = await supabase
    .from("publications")
    .select(publicationSelect)
    .eq("status", "published")
    .in("id", links.map((link) => link.publication_id))
    .order("publication_date", { ascending: false });
  if (error || !data) {
    reportReadFailure("getAuthorPublications.publications", error);
    return [];
  }
  return (data as unknown as PublicationRow[]).map(mapPublication).filter((item): item is Publication => Boolean(item));
}

export async function searchArchive(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const publications = await getPublications();
  return publications.filter((publication) =>
    [
      publication.title,
      publication.abstract,
      publication.authorDisplay,
      publication.journal.title,
      publication.keywords.join(" "),
      publication.doi || ""
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized)
  );
}
