import type { Publication } from "./types";

export type CitationSeg = { t: string; em?: boolean };

function year(date: string) {
  const m = date.match(/^(\d{4})/);
  return m ? m[1] : date;
}

function parsePages(pages?: string) {
  if (!pages) return { start: "", end: "" };
  const parts = pages.split(/[-–—]/).map((s) => s.trim());
  return { start: parts[0] || "", end: parts[1] || "" };
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]?.toUpperCase() + ".").join(" ");
}

function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

function firstName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, -1).join(" ");
}

function doiUrl(doi?: string) {
  if (!doi) return "";
  return `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}`;
}

function authorsOrDisplay(p: Publication): Array<{ name: string; orcid?: string; affiliation?: string }> {
  return p.authors.length ? p.authors : p.authorDisplay.split(";").map((n) => ({ name: n.trim() })).filter((a) => a.name);
}

function authorListApa(authors: { name: string }[]) {
  if (!authors.length) return "";
  const fmt = (a: { name: string }) => `${lastName(a.name)}, ${initials(firstName(a.name))}`;
  if (authors.length === 1) return fmt(authors[0]);
  if (authors.length === 2) return `${fmt(authors[0])}, & ${fmt(authors[1])}`;
  return `${authors.slice(0, -1).map(fmt).join(", ")}, & ${fmt(authors[authors.length - 1])}`;
}

function authorListMla(authors: { name: string }[]) {
  if (!authors.length) return "";
  if (authors.length === 1) return authors[0].name;
  if (authors.length === 2) return `${authors[0].name}, and ${authors[1].name}`;
  return `${authors[0].name}, et al`;
}

function authorListChicago(authors: { name: string }[]) {
  if (!authors.length) return "";
  if (authors.length === 1) return authors[0].name;
  if (authors.length === 2) return `${authors[0].name}, and ${authors[1].name}`;
  const all = authors.map((a) => a.name);
  return `${all.slice(0, -1).join(", ")}, and ${all[all.length - 1]}`;
}

export function segsToPlain(segs: CitationSeg[]) {
  return segs.map((s) => s.t).join("");
}

export function formatApa(p: Publication): CitationSeg[] {
  const y = year(p.publicationDate);
  const d = doiUrl(p.doi);
  const authors = authorsOrDisplay(p);
  const segs: CitationSeg[] = [
    { t: `${authorListApa(authors)} (${y}). ${p.title}. ` },
    { t: p.journal.title, em: true }
  ];
  if (p.volume) segs.push({ t: ", " }, { t: p.volume, em: true });
  if (p.issue) segs.push({ t: `(${p.issue})` });
  if (p.volume || p.issue) segs.push({ t: ", " });
  if (p.pages) segs.push({ t: `${p.pages}. ` });
  else segs.push({ t: ". " });
  if (d) segs.push({ t: d });
  return segs;
}

export function formatMla(p: Publication): CitationSeg[] {
  const y = year(p.publicationDate);
  const d = doiUrl(p.doi);
  const authors = authorsOrDisplay(p);
  const segs: CitationSeg[] = [
    { t: `${authorListMla(authors)}. “${p.title}.” ` },
    { t: p.journal.title, em: true }
  ];
  if (p.volume) segs.push({ t: `, vol. ${p.volume}` });
  if (p.issue) segs.push({ t: `, no. ${p.issue}` });
  segs.push({ t: `, ${y}` });
  if (p.pages) segs.push({ t: `, pp. ${p.pages}` });
  segs.push({ t: "." });
  if (d) segs.push({ t: ` ${d}.` });
  return segs;
}

export function formatChicago(p: Publication): CitationSeg[] {
  const y = year(p.publicationDate);
  const d = doiUrl(p.doi);
  const authors = authorsOrDisplay(p);
  const segs: CitationSeg[] = [
    { t: `${authorListChicago(authors)}. “${p.title}.” ` },
    { t: p.journal.title, em: true }
  ];
  if (p.volume) segs.push({ t: ` ${p.volume}` });
  if (p.issue) segs.push({ t: `, no. ${p.issue}` });
  segs.push({ t: ` (${y})` });
  if (p.pages) segs.push({ t: `: ${p.pages}` });
  segs.push({ t: "." });
  if (d) segs.push({ t: ` ${d}.` });
  return segs;
}

export function formatBibtex(p: Publication) {
  const y = year(p.publicationDate);
  const authors = authorsOrDisplay(p);
  const key = `${lastName(authors[0]?.name || "unknown")}${y}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const authorStr = authors.map((a) => `${lastName(a.name)}, ${firstName(a.name)}`).join(" and ");
  const lines = [`@article{${key},`, `  author = {${authorStr}},`, `  title = {${p.title}},`, `  journal = {${p.journal.title}},`];
  if (p.volume) lines.push(`  volume = {${p.volume}},`);
  if (p.issue) lines.push(`  number = {${p.issue}},`);
  if (p.pages) lines.push(`  pages = {${p.pages.replace(/[-–—]/, "--")}},`);
  lines.push(`  year = {${y}},`);
  if (p.doi) lines.push(`  doi = {${p.doi}},`);
  lines.push("}");
  return lines.join("\n");
}

export function formatRis(p: Publication) {
  const y = year(p.publicationDate);
  const authors = authorsOrDisplay(p);
  const { start, end } = parsePages(p.pages);
  const lines = ["TY  - JOUR"];
  for (const a of authors) lines.push(`AU  - ${lastName(a.name)}, ${firstName(a.name)}`);
  lines.push(`TI  - ${p.title}`, `JO  - ${p.journal.title}`);
  if (p.volume) lines.push(`VL  - ${p.volume}`);
  if (p.issue) lines.push(`IS  - ${p.issue}`);
  if (start) lines.push(`SP  - ${start}`);
  if (end) lines.push(`EP  - ${end}`);
  lines.push(`PY  - ${y}`);
  if (p.doi) lines.push(`DO  - ${p.doi}`);
  lines.push("ER  -");
  return lines.join("\n");
}

function dateParts(date: string) {
  const parts = date.split("-").map((part) => Number(part));
  return parts.length && Number.isFinite(parts[0]) ? parts.filter((part) => Number.isFinite(part)) : [Number(year(date))];
}

function normalizedOrcid(orcid?: string) {
  return orcid?.replace(/^https?:\/\/orcid\.org\//i, "").trim() || undefined;
}

function depositAuthors(p: Publication) {
  return authorsOrDisplay(p).map((author) => ({
    given: firstName(author.name) || undefined,
    family: lastName(author.name),
    ORCID: normalizedOrcid(author.orcid),
    affiliation: author.affiliation ? [{ name: author.affiliation }] : undefined,
  }));
}

export function formatCrossref(p: Publication) {
  const deposit: Record<string, unknown> = {
    type: "journal-article",
    title: [p.title],
    author: depositAuthors(p),
    "container-title": [p.journal.title],
    ISSN: p.journal.issn ? [p.journal.issn] : undefined,
    volume: p.volume || undefined,
    issue: p.issue || undefined,
    page: p.pages || undefined,
    published: { "date-parts": [dateParts(p.publicationDate)] },
    DOI: p.doi || undefined,
    URL: p.doi ? doiUrl(p.doi) : undefined,
    abstract: p.abstract || undefined,
    subject: p.keywords.length ? p.keywords : undefined,
    license: p.licenseUrl ? [{ URL: p.licenseUrl, contentVersion: "vor" }] : undefined,
  };
  return JSON.stringify(deposit, (_key, value) => value === undefined ? undefined : value, 2);
}

export function formatDataCite(p: Publication) {
  const resource: Record<string, unknown> = {
    identifier: p.doi ? { identifier: p.doi, identifierType: "DOI" } : undefined,
    creators: authorsOrDisplay(p).map((author) => ({
      name: author.name,
      nameType: "Personal",
      nameIdentifiers: normalizedOrcid(author.orcid) ? [{ nameIdentifier: `https://orcid.org/${normalizedOrcid(author.orcid)}`, nameIdentifierScheme: "ORCID", schemeUri: "https://orcid.org" }] : undefined,
      affiliation: author.affiliation ? [{ name: author.affiliation }] : undefined,
    })),
    titles: [{ title: p.title }],
    publisher: "Talikha Publishing",
    publicationYear: Number(year(p.publicationDate)),
    types: { resourceTypeGeneral: "Text", resourceType: "Journal Article" },
    container: { containerTitle: p.journal.title, firstPage: parsePages(p.pages).start || undefined, lastPage: parsePages(p.pages).end || undefined, volume: p.volume || undefined, issue: p.issue || undefined },
    subjects: p.keywords.map((subject) => ({ subject })),
    descriptions: p.abstract ? [{ description: p.abstract, descriptionType: "Abstract" }] : undefined,
    rightsList: p.licenseUrl ? [{ rightsUri: p.licenseUrl, rights: p.licenseName }] : undefined,
  };
  return JSON.stringify(resource, (_key, value) => value === undefined ? undefined : value, 2);
}

export function isOpenAccess(licenseName: string) {
  return /creative\s*commons|^cc\s/i.test(licenseName);
}
