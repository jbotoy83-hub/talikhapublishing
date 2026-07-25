export type ApaCitationInput = {
  authors: string[];
  title: string;
  year: string | number;
  journalTitle: string;
  volume?: string | number | null;
  issue?: string | number | null;
  pages?: string | null;
  doi?: string | null;
  url?: string | null;
};

export type ApaCitationData = {
  style: "apa-7";
  formatted_citation: string;
  author_text: string;
  year: string;
  journal_title: string;
  volume: string;
  issue: string;
  pages: string;
  doi_url: string | null;
  source_url: string | null;
};

function initial(value: string) { return value ? `${value[0].toLocaleUpperCase()}.` : ""; }

export function formatApaAuthor(name: string) {
  const parts = name.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length < 2) return name.trim();
  const surname = parts.at(-1)!;
  return `${surname}, ${parts.slice(0, -1).map(initial).filter(Boolean).join(" ")}`;
}

export function formatApaAuthors(authors: string[]) {
  const formatted = authors.map(formatApaAuthor).filter(Boolean);
  if (formatted.length <= 1) return formatted[0] || "";
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  if (formatted.length <= 20) return `${formatted.slice(0, -1).join(", ")}, & ${formatted.at(-1)}`;
  return `${formatted.slice(0, 19).join(", ")}, . . . ${formatted.at(-1)}`;
}

export function normalizeDoiUrl(doi?: string | null) {
  const value = String(doi || "").trim().replace(/^https?:\/\/doi\.org\//i, "");
  return value ? `https://doi.org/${value}` : null;
}

export function createApa7JournalCitation(input: ApaCitationInput): ApaCitationData {
  const authorText = formatApaAuthors(input.authors);
  const year = String(input.year || "n.d.").trim() || "n.d.";
  const volume = String(input.volume || "").trim();
  const issue = String(input.issue || "").trim();
  const pages = String(input.pages || "").trim();
  const doiUrl = normalizeDoiUrl(input.doi);
  const sourceUrl = doiUrl ? null : String(input.url || "").trim() || null;
  const volumeIssue = volume ? `${volume}${issue ? `(${issue})` : ""}` : issue ? `(${issue})` : "";
  const journalPart = [input.journalTitle.trim(), volumeIssue].filter(Boolean).join(", ");
  const locator = pages ? `${journalPart}${journalPart ? ", " : ""}${pages}` : journalPart;
  const retrieval = doiUrl || sourceUrl;
  const formatted = `${authorText ? `${authorText} ` : ""}(${year}). ${input.title.trim()}. ${locator}.${retrieval ? ` ${retrieval}` : ""}`.replace(/\.\s+$/, ".");
  return { style: "apa-7", formatted_citation: formatted, author_text: authorText, year, journal_title: input.journalTitle.trim(), volume, issue, pages, doi_url: doiUrl, source_url: sourceUrl };
}
