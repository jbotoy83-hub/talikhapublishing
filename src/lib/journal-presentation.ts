import type { Journal, Publication } from "@/lib/types";

export type JournalPresentation = {
  type: string;
  cadence: string;
  initials: string;
  themes: string[];
};

const presentations: Record<string, JournalPresentation> = {
  inquira: {
    type: "Peer-reviewed research",
    cadence: "Quarterly",
    initials: "IQ",
    themes: ["Research articles", "Field evidence", "Peer review"]
  },
  lumera: {
    type: "Literary journal",
    cadence: "Biannual",
    initials: "LM",
    themes: ["Poetry", "Essays", "Fiction"]
  }
};

export function getJournalPresentation(journal: Journal): JournalPresentation {
  return presentations[journal.slug] || {
    type: "Editorial journal",
    cadence: "Weekly",
    initials: journal.title.split(/\s+/).map((word) => word[0]).join("").slice(0, 3),
    themes: journal.scope.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3)
  };
}

type JournalIssueGroup = {
  issue: string;
  publications: Array<Pick<Publication, "id" | "volume" | "issue">>;
};

export type JournalVolumeGroup = {
  volume: string;
  issues: JournalIssueGroup[];
  publicationCount: number;
};

function compareArchiveLabels(a: string, b: string) {
  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return bNumber - aNumber;
  return b.localeCompare(a, "en", { numeric: true });
}

export function comparePublicationsNewestFirst(a: Publication, b: Publication) {
  const dateOrder = b.publicationDate.localeCompare(a.publicationDate);
  if (dateOrder) return dateOrder;
  const volumeOrder = compareArchiveLabels(a.volume || "", b.volume || "");
  if (volumeOrder) return volumeOrder;
  const issueOrder = compareArchiveLabels(a.issue || "", b.issue || "");
  if (issueOrder) return issueOrder;
  const modifiedOrder = b.modifiedDate.localeCompare(a.modifiedDate);
  if (modifiedOrder) return modifiedOrder;
  return a.title.localeCompare(b.title, "en");
}

export function groupJournalArchive(publications: Array<Pick<Publication, "id" | "volume" | "issue">>): JournalVolumeGroup[] {
  const volumes = new Map<string, Map<string, Array<Pick<Publication, "id" | "volume" | "issue">>>>();
  for (const publication of publications) {
    const volume = publication.volume || "Unassigned";
    const issue = publication.issue || "Unassigned";
    if (!volumes.has(volume)) volumes.set(volume, new Map());
    const issues = volumes.get(volume)!;
    if (!issues.has(issue)) issues.set(issue, []);
    issues.get(issue)!.push(publication);
  }
  return [...volumes.entries()]
    .sort(([a], [b]) => compareArchiveLabels(a, b))
    .map(([volume, issues]) => {
      const groupedIssues = [...issues.entries()]
        .sort(([a], [b]) => compareArchiveLabels(a, b))
        .map(([issue, records]) => ({ issue, publications: records }));
      return {
        volume,
        issues: groupedIssues,
        publicationCount: groupedIssues.reduce((total, issue) => total + issue.publications.length, 0)
      };
    });
}

export function archiveIssueLabel(publication: Publication | undefined) {
  if (!publication) return "Archive awaiting verified records";
  const parts = [publication.volume ? `Vol. ${publication.volume}` : "", publication.issue ? `No. ${publication.issue}` : ""].filter(Boolean);
  const year = publication.publicationDate.slice(0, 4);
  return parts.length ? `${parts.join(", ")} · ${year}` : year;
}

export function formatPublicationDate(publication: Publication) {
  if (publication.publicationDatePrecision === "year") return publication.publicationDate;
  return new Date(`${publication.publicationDate}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
