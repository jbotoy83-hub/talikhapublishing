import { describe, expect, it } from "vitest";
import { formatCrossref, formatDataCite } from "@/lib/citation-format";
import type { Publication } from "@/lib/types";

const publication: Publication = {
  id: "publication-1",
  slug: "metadata-ready-article",
  title: "Metadata-ready article",
  abstract: "A short abstract for deposit testing.",
  keywords: ["metadata", "publishing"],
  journal: { id: "journal-1", slug: "inquira", title: "InQuira", description: "", scope: "", issn: "3000-0001", heroImage: "", accent: "emerald" },
  authors: [{ id: "author-1", slug: "jane-doe", name: "Jane Doe", bio: "", affiliation: "Talikha University", credentials: "PhD", orcid: "0000-0002-1825-0097" }],
  authorDisplay: "Jane Doe",
  publicationDate: "2026-07-31",
  publicationDatePrecision: "day",
  modifiedDate: "2026-07-31",
  volume: "1",
  issue: "2",
  pages: "10-20",
  doi: "10.1234/example",
  recommendedCitation: "",
  licenseName: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  copyrightHolder: "The authors",
  featured: false,
  contentType: "research",
  views: 0,
  downloads: 0,
};

describe("citation deposit formats", () => {
  it("includes Crossref-ready author, DOI, issue, and page metadata", () => {
    const payload = JSON.parse(formatCrossref(publication)) as Record<string, unknown>;
    expect(payload.type).toBe("journal-article");
    expect(payload.DOI).toBe("10.1234/example");
    expect((payload.author as Array<Record<string, unknown>>)[0].ORCID).toBe("0000-0002-1825-0097");
    expect(payload.page).toBe("10-20");
  });

  it("includes DataCite creator identifiers and publication year", () => {
    const payload = JSON.parse(formatDataCite(publication)) as Record<string, unknown>;
    expect(payload.publicationYear).toBe(2026);
    expect((payload.creators as Array<Record<string, unknown>>)[0].name).toBe("Jane Doe");
    expect((payload.identifier as Record<string, unknown>).identifier).toBe("10.1234/example");
  });
});
