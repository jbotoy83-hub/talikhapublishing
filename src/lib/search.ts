import type { Publication } from "./types";
import { getPublications } from "./content";

export type SearchFilters = {
  q?: string;
  journal?: string;
  year?: string;
  type?: string;
  keyword?: string;
  sort?: "relevance" | "newest" | "oldest" | "title";
  page?: number;
};

export type FacetItem = { value: string; label: string; count: number };
export type SearchFacets = { journals: FacetItem[]; years: FacetItem[]; types: FacetItem[]; keywords: FacetItem[] };
export type SearchResult = { publication: Publication; score: number; highlightTitle: string; highlightAbstract: string };
export type SearchResponse = { results: SearchResult[]; total: number; page: number; pageSize: number; facets: SearchFacets };

const PAGE_SIZE = 12;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const terms = query.trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.join("|")})`, "gi");
  return text.replace(re, "<mark>$1</mark>");
}

function scorePublication(p: Publication, query: string) {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  let score = 0;
  const titleLower = p.title.toLowerCase();
  const abstractLower = p.abstract.toLowerCase();
  const authorLower = p.authorDisplay.toLowerCase();
  const kwLower = p.keywords.join(" ").toLowerCase();
  for (const term of terms) {
    if (titleLower.includes(term)) score += 10;
    if (authorLower.includes(term)) score += 5;
    if (kwLower.includes(term)) score += 4;
    if (abstractLower.includes(term)) score += 2;
    if (p.doi?.toLowerCase().includes(term)) score += 3;
    if (p.journal.title.toLowerCase().includes(term)) score += 1;
  }
  return score;
}

function matchesFilters(p: Publication, filters: SearchFilters) {
  if (filters.journal && p.journal.slug !== filters.journal) return false;
  if (filters.year) {
    const pubYear = p.publicationDate.slice(0, 4);
    if (pubYear !== filters.year) return false;
  }
  if (filters.type && p.contentType !== filters.type) return false;
  if (filters.keyword && !p.keywords.some((k) => k.toLowerCase() === filters.keyword!.toLowerCase())) return false;
  return true;
}

function matchesQuery(p: Publication, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const haystack = [p.title, p.abstract, p.authorDisplay, p.journal.title, p.keywords.join(" "), p.doi || ""].join(" ").toLowerCase();
  return haystack.includes(q);
}

function buildFacets(publications: Publication[], activeFilters: SearchFilters): SearchFacets {
  const journalMap = new Map<string, { label: string; count: number }>();
  const yearMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const keywordMap = new Map<string, number>();

  for (const p of publications) {
    const withoutJournal = { ...activeFilters, journal: undefined };
    const withoutYear = { ...activeFilters, year: undefined };
    const withoutType = { ...activeFilters, type: undefined };
    const withoutKeyword = { ...activeFilters, keyword: undefined };

    if (matchesFilters(p, withoutJournal)) {
      const existing = journalMap.get(p.journal.slug);
      if (existing) existing.count++;
      else journalMap.set(p.journal.slug, { label: p.journal.title, count: 1 });
    }
    if (matchesFilters(p, withoutYear)) {
      const y = p.publicationDate.slice(0, 4);
      yearMap.set(y, (yearMap.get(y) || 0) + 1);
    }
    if (matchesFilters(p, withoutType)) {
      typeMap.set(p.contentType, (typeMap.get(p.contentType) || 0) + 1);
    }
    if (matchesFilters(p, withoutKeyword)) {
      for (const kw of p.keywords) {
        const lower = kw.toLowerCase();
        keywordMap.set(lower, (keywordMap.get(lower) || 0) + 1);
      }
    }
  }

  const journals = [...journalMap.entries()].map(([value, { label, count }]) => ({ value, label, count })).sort((a, b) => b.count - a.count);
  const years = [...yearMap.entries()].map(([value, count]) => ({ value, label: value, count })).sort((a, b) => b.value.localeCompare(a.value));
  const typeLabels: Record<string, string> = { research: "Research", creative: "Creative", commentary: "Commentary" };
  const types = [...typeMap.entries()].map(([value, count]) => ({ value, label: typeLabels[value] || value, count })).sort((a, b) => b.count - a.count);
  const keywords = [...keywordMap.entries()].map(([value, count]) => ({ value, label: value, count })).sort((a, b) => b.count - a.count).slice(0, 30);

  return { journals, years, types, keywords };
}

export async function searchPublications(filters: SearchFilters): Promise<SearchResponse> {
  const allPublications = await getPublications();
  const query = filters.q || "";
  const page = Math.max(1, filters.page || 1);

  const queryMatched = query.trim() ? allPublications.filter((p) => matchesQuery(p, query)) : allPublications;
  const filtered = queryMatched.filter((p) => matchesFilters(p, filters));

  const scored: SearchResult[] = filtered.map((p) => ({
    publication: p,
    score: query.trim() ? scorePublication(p, query) : 0,
    highlightTitle: highlight(p.title, query),
    highlightAbstract: highlight(p.abstract.slice(0, 300), query)
  }));

  const sort = filters.sort || (query.trim() ? "relevance" : "newest");
  if (sort === "relevance") scored.sort((a, b) => b.score - a.score || b.publication.publicationDate.localeCompare(a.publication.publicationDate));
  else if (sort === "newest") scored.sort((a, b) => b.publication.publicationDate.localeCompare(a.publication.publicationDate));
  else if (sort === "oldest") scored.sort((a, b) => a.publication.publicationDate.localeCompare(b.publication.publicationDate));
  else if (sort === "title") scored.sort((a, b) => a.publication.title.localeCompare(b.publication.title));

  const total = scored.length;
  const start = (page - 1) * PAGE_SIZE;
  const results = scored.slice(start, start + PAGE_SIZE);
  const facets = buildFacets(queryMatched, filters);

  return { results, total, page, pageSize: PAGE_SIZE, facets };
}
