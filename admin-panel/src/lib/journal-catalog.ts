import type { JournalCatalog, JournalMeta, IssueRecord, IssueStatus, SiteStore, SiteJournal, SiteIssue } from "@/types";

export const JOURNAL_CATALOG_KEY = "talikha-journal-catalog-v2";

export const ISSUE_STATUS_ORDER: IssueStatus[] = ["Draft", "Open", "Editorial", "Production", "Scheduled", "Published", "Archived"];

export const ISSUE_STATUS_META: Record<IssueStatus, { label: string; tone: string; note: string }> = {
  Draft: { label: "Draft", tone: "tp-pill--neutral", note: "Not yet visible" },
  Open: { label: "Open for submissions", tone: "tp-pill--green", note: "Accepting manuscripts" },
  Editorial: { label: "In editorial", tone: "tp-pill--amber", note: "Under review" },
  Production: { label: "In production", tone: "tp-pill--amber", note: "Being prepared" },
  Scheduled: { label: "Scheduled", tone: "tp-pill--blue", note: "Queued to publish" },
  Published: { label: "Published", tone: "tp-pill--green", note: "Live on the site" },
  Archived: { label: "Archived", tone: "tp-pill--neutral", note: "Closed, read-only" },
};

export const jwUid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const jwToday = () => new Date().toISOString().slice(0, 10);
export const jwStamp = () => new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const jwFmtDate = (value: string) => (value ? new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.length <= 10 ? value + "T00:00:00" : value}`)) : "—");
export const jwProductionPercent = (status: IssueStatus) => ({ Draft: 8, Open: 18, Editorial: 42, Production: 74, Scheduled: 92, Published: 100, Archived: 100 }[status]);

export const jwEmptyIssue = (journalId: string, volume: number, issue: number): IssueRecord => ({
  id: jwUid("ISS"), journalId, volume, issue, title: "", description: "", status: "Draft", isCurrent: false, isSubmissionTarget: false,
  isSpecial: false, specialLabel: "", publicationDate: "", submissionDeadline: "", editorialStart: "", editorialEnd: "",
  openAt: "", closeAt: "", publishAt: "", cover: "", articleOrder: [], doi: "", keywords: [], seoTitle: "",
  seoDescription: "", socialImage: "", changelog: [`Created ${jwStamp()}`], deleted: false, createdAt: new Date().toISOString(),
});

export const jwEmptyJournal = (): JournalMeta => ({
  id: jwUid("JRN"), title: "", abbreviation: "", issnOnline: "", issnPrint: "", publisher: "Talikha Publishing",
  frequency: "Quarterly", language: "English", subject: "", copyright: "© Talikha Publishing", license: "CC BY 4.0",
  doiPrefix: "", seoTitle: "", seoDescription: "", socialImage: "", deleted: false,
});

export function jwSeedCatalog(initialPublicationRecords: { journal: string; submissionId: string }[]): JournalCatalog {
  const journals: JournalMeta[] = [
    { id: "jrn-inquira", title: "InQuira", abbreviation: "Inq.", issnOnline: "3000-0001", issnPrint: "3000-0002", publisher: "Talikha Publishing", frequency: "Quarterly", language: "English", subject: "Inquiry & social science", copyright: "© Talikha Publishing", license: "CC BY 4.0", doiPrefix: "10.0000/talikha.inquira", seoTitle: "InQuira — Talikha Publishing", seoDescription: "A journal of inquiry and social research.", socialImage: "", deleted: false },
    { id: "jrn-lumera", title: "Lumera", abbreviation: "Lum.", issnOnline: "3000-0011", issnPrint: "3000-0012", publisher: "Talikha Publishing", frequency: "Biannual", language: "English", subject: "Creative & literary studies", copyright: "© Talikha Publishing", license: "CC BY 4.0", doiPrefix: "10.0000/talikha.lumera", seoTitle: "Lumera — Talikha Publishing", seoDescription: "A journal of creative and literary work.", socialImage: "", deleted: false },
  ];
  const seedArticles = (journalTitle: string) => initialPublicationRecords.filter((r) => r.journal === journalTitle).map((r) => r.submissionId);
  const issues: IssueRecord[] = [
    { ...jwEmptyIssue("jrn-inquira", 1, 1), title: "Inaugural issue", status: "Published", isCurrent: true, publicationDate: "2026-03-15", submissionDeadline: "2026-01-31", cover: "journal-academic-frontiers-hero.jpg", articleOrder: seedArticles("InQuira"), doi: "10.0000/talikha.inquira.v1i1", changelog: ["Seeded as published current issue"] },
    { ...jwEmptyIssue("jrn-inquira", 1, 2), title: "Spring cycle", status: "Editorial", publicationDate: "2026-09-30", submissionDeadline: "2026-07-15", changelog: ["Seeded in editorial"] },
    { ...jwEmptyIssue("jrn-lumera", 1, 1), title: "First light", status: "Published", isCurrent: true, publicationDate: "2026-04-20", submissionDeadline: "2026-02-28", cover: "journal-academic-frontiers-hero.jpg", articleOrder: seedArticles("Lumera"), doi: "10.0000/talikha.lumera.v1i1", changelog: ["Seeded as published current issue"] },
  ];
  journals[0].submissionIssueId = issues[0].id;
  journals[1].submissionIssueId = issues[2].id;
  issues[0].isSubmissionTarget = true;
  issues[2].isSubmissionTarget = true;
  return { journals, issues, syncedAt: new Date().toISOString() };
}

export const jwSluggify: (v: string) => string = (value) => { const out = (value || "journal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); return out || "journal"; };

export function projectCatalogForSite(catalog: JournalCatalog): SiteStore {
  const journals: SiteJournal[] = [];
  const issues: SiteIssue[] = [];
  for (const j of catalog.journals) {
    if (j.deleted) continue;
    const slug = j.slug || jwSluggify(j.title);
    const cur = catalog.issues.find((i) => i.journalId === j.id && !i.deleted && i.isCurrent) || catalog.issues.find((i) => i.journalId === j.id && !i.deleted);
    const rawCover = cur && cur.cover ? cur.cover : "";
    const isAbs = rawCover.charAt(0) === "/" || rawCover.indexOf("data:") === 0 || rawCover.indexOf("http:") === 0 || rawCover.indexOf("https:") === 0;
    const hero = rawCover ? (isAbs ? rawCover : "/assets/" + rawCover) : "/assets/journal-academic-frontiers-hero.jpg";
    journals.push({ id: j.id, slug, title: j.title, description: j.seoDescription || "", scope: j.subject || "", issn: j.issnOnline || "", issnOnline: j.issnOnline || "", issnPrint: j.issnPrint || "", hero, accent: "emerald", status: "published", submissionIssueId: j.submissionIssueId, metadata: { editorId: j.id, abbreviation: j.abbreviation, publisher: j.publisher, frequency: j.frequency, language: j.language, subject: j.subject, copyright: j.copyright, license: j.license, doiPrefix: j.doiPrefix, seoTitle: j.seoTitle, seoDescription: j.seoDescription, socialImage: j.socialImage, submissionIssueId: j.submissionIssueId, deleted: j.deleted } });
  }
  for (const i of catalog.issues) {
    if (i.deleted) continue;
    issues.push({ id: i.id, journalId: i.journalId, volume: String(i.volume), issue: String(i.issue), title: i.title || "", description: i.description || "", status: i.status, isCurrent: !!i.isCurrent, isSubmissionTarget: !!i.isSubmissionTarget, publicationDate: i.publicationDate || "", cover: i.cover || "", deleted: false, metadata: { editorId: i.id, isSpecial: i.isSpecial, specialLabel: i.specialLabel, submissionDeadline: i.submissionDeadline, editorialStart: i.editorialStart, editorialEnd: i.editorialEnd, openAt: i.openAt, closeAt: i.closeAt, publishAt: i.publishAt, articleOrder: i.articleOrder, doi: i.doi, keywords: i.keywords, seoTitle: i.seoTitle, seoDescription: i.seoDescription, socialImage: i.socialImage, changelog: i.changelog, createdAt: i.createdAt, deleted: i.deleted } });
  }
  return { version: 1, journals, issues };
}

export function publishCatalogToSite(catalog: JournalCatalog): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const body = projectCatalogForSite(catalog);
  return fetch("/api/journal-store", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => { const result = await r.json().catch(() => ({} as { error?: string; dbError?: string })); if (!r.ok || result.dbSynced !== true) { console.error("[journal-store] publish failed", r.status, result.error || result.dbError || "database sync did not complete"); return false; } return true; })
    .catch((e) => { console.error("[journal-store] publish error", e); return false; });
}

export function jwLoadCatalog(seedRecords: { journal: string; submissionId: string }[]): JournalCatalog {
  if (typeof window === "undefined") return jwSeedCatalog(seedRecords);
  try {
    const raw = window.localStorage.getItem(JOURNAL_CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as JournalCatalog;
      if (parsed && Array.isArray(parsed.journals) && Array.isArray(parsed.issues)) return parsed;
    }
  } catch { /* fall through to seed */ }
  return jwSeedCatalog(seedRecords);
}

let JOURNAL_CATALOG: JournalCatalog | null = null;

export function initJournalCatalog(seedRecords: { journal: string; submissionId: string }[]): void {
  if (!JOURNAL_CATALOG) JOURNAL_CATALOG = jwLoadCatalog(seedRecords);
}

export function getJournalCatalog(): JournalCatalog {
  if (!JOURNAL_CATALOG) JOURNAL_CATALOG = jwLoadCatalog([]);
  return JOURNAL_CATALOG;
}

export function saveJournalCatalog(next: JournalCatalog): void {
  JOURNAL_CATALOG = next;
  if (typeof window !== "undefined") {
    const localSafe = { ...next, issues: next.issues.map((issue) => ({ ...issue, cover: issue.cover.startsWith("data:") ? "" : issue.cover, socialImage: issue.socialImage.startsWith("data:") ? "" : issue.socialImage })) };
    try { window.localStorage.setItem(JOURNAL_CATALOG_KEY, JSON.stringify(localSafe)); } catch { /* server state remains authoritative */ }
    window.dispatchEvent(new CustomEvent("talikha:catalog"));
  }
}

export function jwNextNumber(catalog: JournalCatalog, journalId: string): { volume: number; issue: number } {
  const live = catalog.issues.filter((i) => i.journalId === journalId && !i.deleted);
  if (!live.length) return { volume: 1, issue: 1 };
  const maxVol = Math.max(...live.map((i) => i.volume));
  const inVol = live.filter((i) => i.volume === maxVol);
  const maxIssue = Math.max(...inVol.map((i) => i.issue));
  return { volume: maxVol, issue: maxIssue + 1 };
}

export function jwCloneIssue(catalog: JournalCatalog, source: IssueRecord): IssueRecord {
  const next = jwNextNumber(catalog, source.journalId);
  return { ...jwEmptyIssue(source.journalId, next.volume, next.issue), title: source.title ? `${source.title} (copy)` : "", description: source.description, isSpecial: source.isSpecial, specialLabel: source.specialLabel, keywords: [...source.keywords], seoTitle: source.seoTitle, seoDescription: source.seoDescription, changelog: [`Duplicated from Vol ${source.volume} Issue ${source.issue} on ${jwStamp()}`] };
}

export function jwValidateIssue(catalog: JournalCatalog, issue: IssueRecord): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const journal = catalog.journals.find((j) => j.id === issue.journalId);
  if (!journal) blocking.push("The parent journal is missing.");
  const dup = catalog.issues.find((i) => i.id !== issue.id && i.journalId === issue.journalId && !i.deleted && i.volume === issue.volume && i.issue === issue.issue);
  if (dup) blocking.push(`Volume ${issue.volume}, Issue ${issue.issue} already exists for this journal.`);
  const maxIssue = Math.max(0, ...catalog.issues.filter((i) => i.journalId === issue.journalId && !i.deleted && i.volume === issue.volume && i.id !== issue.id).map((i) => i.issue));
  if (maxIssue && issue.issue > maxIssue + 1) warnings.push(`Issue number skips the sequence (expected ${maxIssue + 1}).`);
  const orderSet = new Set(issue.articleOrder);
  if (orderSet.size !== issue.articleOrder.length) blocking.push("An article is assigned twice within this issue.");
  for (const sid of issue.articleOrder) {
    const elsewhere = catalog.issues.find((i) => i.id !== issue.id && !i.deleted && i.status === "Published" && i.articleOrder.includes(sid));
    if (elsewhere) blocking.push(`An assigned article is also published in Vol ${elsewhere.volume} Issue ${elsewhere.issue}.`);
  }
  if (issue.status === "Published" || issue.status === "Scheduled") {
    if (!issue.cover) blocking.push("A cover image is required before publishing.");
    if (!issue.publicationDate) blocking.push("A publication date is required before publishing.");
    if (!journal?.issnOnline && !journal?.issnPrint) warnings.push("Add an ISSN to the journal metadata for citation quality.");
  }
  return { blocking, warnings };
}

export function jwCoverSrc(cover: string, assetPrefix: string): string {
  if (!cover) return "";
  return cover.startsWith("data:") ? cover : `${assetPrefix}${cover}`;
}

export function jwCurrentForTitle(title: string): { volume: string; issue: string } | null {
  const catalog = getJournalCatalog();
  const jid = catalog.journals.find((j) => j.title === title && !j.deleted)?.id;
  if (!jid) return null;
  const i = catalog.issues.find((x) => x.journalId === jid && !x.deleted && x.isCurrent) || catalog.issues.find((x) => x.journalId === jid && !x.deleted);
  return i ? { volume: String(i.volume), issue: String(i.issue) } : null;
}
