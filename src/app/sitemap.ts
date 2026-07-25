import type { MetadataRoute } from "next";
import { getAuthors, getJournals, getPublications } from "@/lib/content";
import { isIndexingEnabled } from "@/lib/launch";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexingEnabled()) return [];
  const [publications, authors, journals] = await Promise.all([getPublications(), getAuthors(), getJournals()]);
  const pages = ["", "/journals", "/publications", "/authors", "/services", "/about", "/editorial-standards", "/submit", "/faq", "/privacy", "/terms"];
  return [
    ...pages.map((path, index) => ({ url: absoluteUrl(path || "/"), changeFrequency: index < 4 ? "weekly" as const : "monthly" as const, priority: index === 0 ? 1 : index < 4 ? 0.9 : 0.6 })),
    ...journals.map((journal) => ({ url: absoluteUrl(`/journals/${journal.slug}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...publications.map((publication) => ({ url: absoluteUrl(`/publications/${publication.slug}`), lastModified: new Date(`${publication.modifiedDate}T00:00:00Z`), changeFrequency: "monthly" as const, priority: 0.9 })),
    ...authors.map((author) => ({ url: absoluteUrl(`/authors/${author.slug}`), changeFrequency: "monthly" as const, priority: 0.7 }))
  ];
}
