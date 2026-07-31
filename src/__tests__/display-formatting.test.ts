import { describe, expect, it } from "vitest";
import { createApa7JournalCitation, formatApaAuthor, formatApaAuthors, normalizeDoiUrl } from "@/lib/apa-citation";
import { authorInitials, portraitColor } from "@/lib/author-display";
import {
  archiveIssueLabel,
  compareByEngagement,
  comparePublicationsNewestFirst,
  formatPublicationDate,
  getJournalPresentation,
  groupJournalArchive
} from "@/lib/journal-presentation";
import type { Journal, Publication } from "@/lib/types";

describe("apa-citation", () => {
  describe("formatApaAuthor", () => {
    it("renders surname first with given-name initials", () => {
      expect(formatApaAuthor("Jane Doe")).toBe("Doe, J.");
      expect(formatApaAuthor("John Ronald Tolkien")).toBe("Tolkien, J. R.");
    });

    it("normalizes surrounding and repeated whitespace", () => {
      expect(formatApaAuthor("  jane   doe  ")).toBe("doe, J.");
    });

    it("returns a single-part name unchanged (trimmed)", () => {
      expect(formatApaAuthor("Madonna")).toBe("Madonna");
      expect(formatApaAuthor("  Madonna  ")).toBe("Madonna");
    });
  });

  describe("formatApaAuthors", () => {
    it("handles zero, one, and two authors", () => {
      expect(formatApaAuthors([])).toBe("");
      expect(formatApaAuthors(["Jane Doe"])).toBe("Doe, J.");
      expect(formatApaAuthors(["Jane Doe", "John Smith"])).toBe("Doe, J., & Smith, J.");
    });

    it("uses the ampersand before the last author for 3-20 authors", () => {
      expect(formatApaAuthors(["A B", "C D", "E F"])).toBe("B, A., D, C., & F, E.");
    });
  });

  describe("normalizeDoiUrl", () => {
    it("prefixes a bare DOI with https://doi.org/", () => {
      expect(normalizeDoiUrl("10.1234/x")).toBe("https://doi.org/10.1234/x");
    });

    it("is idempotent for an already-prefixed DOI (case-insensitive)", () => {
      expect(normalizeDoiUrl("https://doi.org/10.1234/x")).toBe("https://doi.org/10.1234/x");
      expect(normalizeDoiUrl("HTTP://DOI.ORG/10.1/x")).toBe("https://doi.org/10.1/x");
    });

    it("returns null for empty or missing input", () => {
      expect(normalizeDoiUrl("")).toBeNull();
      expect(normalizeDoiUrl(null)).toBeNull();
      expect(normalizeDoiUrl(undefined)).toBeNull();
    });
  });

  describe("createApa7JournalCitation", () => {
    it("builds a full citation with DOI and structured fields", () => {
      const data = createApa7JournalCitation({
        authors: ["Jane Doe"],
        title: "Study of things",
        year: 2020,
        journalTitle: "InQuira",
        volume: "1",
        issue: "2",
        pages: "10-20",
        doi: "10.1234/x"
      });
      expect(data.style).toBe("apa-7");
      expect(data.formatted_citation).toBe("Doe, J. (2020). Study of things. InQuira, 1(2), 10-20. https://doi.org/10.1234/x");
      expect(data.author_text).toBe("Doe, J.");
      expect(data.year).toBe("2020");
      expect(data.journal_title).toBe("InQuira");
      expect(data.volume).toBe("1");
      expect(data.issue).toBe("2");
      expect(data.pages).toBe("10-20");
      expect(data.doi_url).toBe("https://doi.org/10.1234/x");
      expect(data.source_url).toBeNull();
    });

    it("falls back to a source URL when there is no DOI", () => {
      const data = createApa7JournalCitation({
        authors: ["John Ronald Tolkien"],
        title: "The tale",
        year: "1999",
        journalTitle: "Lumera",
        volume: "3",
        issue: null,
        pages: null,
        doi: null,
        url: "https://example.com/p"
      });
      expect(data.formatted_citation).toBe("Tolkien, J. R. (1999). The tale. Lumera, 3. https://example.com/p");
      expect(data.doi_url).toBeNull();
      expect(data.source_url).toBe("https://example.com/p");
    });

    it("prefers DOI over a provided source URL", () => {
      const data = createApa7JournalCitation({ authors: ["Jane Doe"], title: "T", year: 2020, journalTitle: "J", doi: "10.1/x", url: "https://example.com" });
      expect(data.doi_url).toBe("https://doi.org/10.1/x");
      expect(data.source_url).toBeNull();
    });

    it("uses n.d. for a missing year", () => {
      const data = createApa7JournalCitation({ authors: ["Jane Doe"], title: "T", year: "", journalTitle: "J" });
      expect(data.year).toBe("n.d.");
    });
  });
});

describe("author-display", () => {
  describe("authorInitials", () => {
    it("derives initials from given/surname order", () => {
      expect(authorInitials("Jane Doe")).toBe("DJ");
    });

    it("derives initials from surname-first (comma) order", () => {
      expect(authorInitials("Doe, Jane")).toBe("DJ");
    });

    it("strips 'et al.' before deriving initials", () => {
      expect(authorInitials("Jane Doe et al.")).toBe("DJ");
    });

    it("uses the same token twice for a single-part name", () => {
      expect(authorInitials("Plato")).toBe("PP");
    });
  });

  describe("portraitColor", () => {
    it("returns a deterministic palette color", () => {
      const palette = ["#1d5b47", "#8b452f", "#31556d", "#6b4a78", "#79602e", "#27636a"];
      expect(palette).toContain(portraitColor("Jane Doe"));
      expect(portraitColor("Jane Doe")).toBe(portraitColor("Jane Doe"));
    });

    it("maps the code-point sum modulo the palette length", () => {
      expect(portraitColor("")).toBe("#1d5b47");
      expect(portraitColor("A")).toBe("#27636a");
    });
  });
});

function makeJournal(overrides: Partial<Journal> = {}): Journal {
  return { id: "j-1", slug: "inquira", title: "InQuira", description: "", scope: "", issn: "3000-0001", heroImage: "", accent: "emerald", ...overrides };
}

function makePublication(overrides: Partial<Publication> = {}): Publication {
  return {
    id: "pub-1",
    slug: "pub-1",
    title: "Title",
    abstract: "",
    keywords: [],
    journal: makeJournal(),
    authors: [],
    authorDisplay: "",
    publicationDate: "2026-07-31",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-31",
    volume: "1",
    issue: "2",
    pages: "",
    doi: "",
    recommendedCitation: "",
    licenseName: "",
    licenseUrl: "",
    copyrightHolder: "",
    featured: false,
    contentType: "research",
    views: 0,
    downloads: 0,
    ...overrides
  };
}

describe("journal-presentation", () => {
  describe("getJournalPresentation", () => {
    it("returns the curated InQuira presentation", () => {
      expect(getJournalPresentation(makeJournal({ slug: "inquira" }))).toEqual({
        type: "Peer-reviewed research",
        cadence: "Quarterly",
        initials: "IQ",
        themes: ["Research articles", "Field evidence", "Peer review"]
      });
    });

    it("returns the curated Lumera presentation", () => {
      expect(getJournalPresentation(makeJournal({ slug: "lumera", title: "Lumera" }))).toEqual({
        type: "Literary journal",
        cadence: "Biannual",
        initials: "LM",
        themes: ["Poetry", "Essays", "Fiction"]
      });
    });

    it("derives a fallback presentation for unknown journals", () => {
      const result = getJournalPresentation(makeJournal({ slug: "other", title: "New Voices Journal", scope: "Poetry, Fiction, Essays, Drama" }));
      expect(result.type).toBe("Editorial journal");
      expect(result.cadence).toBe("Weekly");
      expect(result.initials).toBe("NVJ");
      expect(result.themes).toEqual(["Poetry", "Fiction", "Essays"]);
    });
  });

  describe("archiveIssueLabel", () => {
    it("returns a placeholder when there is no publication", () => {
      expect(archiveIssueLabel(undefined)).toBe("Archive awaiting verified records");
    });

    it("combines volume, issue, and year", () => {
      expect(archiveIssueLabel(makePublication({ volume: "1", issue: "2", publicationDate: "2026-07-31" }))).toBe("Vol. 1, No. 2 · 2026");
    });

    it("shows volume alone when there is no issue", () => {
      expect(archiveIssueLabel(makePublication({ volume: "3", issue: "", publicationDate: "2025-06-01" }))).toBe("Vol. 3 · 2025");
    });

    it("falls back to the year when volume and issue are missing", () => {
      expect(archiveIssueLabel(makePublication({ volume: "", issue: "", publicationDate: "2026-01-01" }))).toBe("2026");
    });
  });

  describe("groupJournalArchive", () => {
    it("groups by volume and issue, sorted newest-first with counts", () => {
      const groups = groupJournalArchive([
        { id: "a", volume: "1", issue: "1" },
        { id: "b", volume: "2", issue: "1" },
        { id: "c", volume: "1", issue: "2" },
        { id: "d", volume: "1", issue: "1" }
      ]);
      expect(groups.map((g) => g.volume)).toEqual(["2", "1"]);
      expect(groups[0].publicationCount).toBe(1);
      expect(groups[1].publicationCount).toBe(3);
      expect(groups[1].issues.map((i) => i.issue)).toEqual(["2", "1"]);
      expect(groups[1].issues[1].publications.map((p) => p.id)).toEqual(["a", "d"]);
    });

    it("buckets missing volume/issue under 'Unassigned'", () => {
      const groups = groupJournalArchive([{ id: "x", volume: "", issue: "" }]);
      expect(groups[0].volume).toBe("Unassigned");
      expect(groups[0].issues[0].issue).toBe("Unassigned");
    });
  });

  describe("comparePublicationsNewestFirst", () => {
    it("orders by publication date descending", () => {
      const older = makePublication({ id: "older", publicationDate: "2025-01-01" });
      const newer = makePublication({ id: "newer", publicationDate: "2026-01-01" });
      expect([older, newer].sort(comparePublicationsNewestFirst).map((p) => p.id)).toEqual(["newer", "older"]);
    });

    it("breaks date ties by volume descending", () => {
      const v1 = makePublication({ id: "v1", publicationDate: "2026-01-01", volume: "1" });
      const v2 = makePublication({ id: "v2", publicationDate: "2026-01-01", volume: "2" });
      expect([v1, v2].sort(comparePublicationsNewestFirst).map((p) => p.id)).toEqual(["v2", "v1"]);
    });
  });

  describe("compareByEngagement", () => {
    it("orders by combined views and downloads descending", () => {
      const low = makePublication({ id: "low", views: 1, downloads: 1 });
      const high = makePublication({ id: "high", views: 10, downloads: 5 });
      expect([low, high].sort(compareByEngagement).map((p) => p.id)).toEqual(["high", "low"]);
    });
  });

  describe("formatPublicationDate", () => {
    it("returns the raw value for year precision", () => {
      expect(formatPublicationDate(makePublication({ publicationDate: "2026", publicationDatePrecision: "year" }))).toBe("2026");
    });

    it("formats a day-precision date into a non-ISO, year-bearing string", () => {
      const result = formatPublicationDate(makePublication({ publicationDate: "2026-07-31", publicationDatePrecision: "day" }));
      expect(result).not.toBe("2026-07-31");
      expect(result).toContain("2026");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
