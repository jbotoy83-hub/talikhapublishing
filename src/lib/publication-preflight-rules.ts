export type PreflightCheckStatus = "not_reviewed" | "pass" | "confirmed" | "warning" | "fail";
export type PreflightCheckMode = "automatic" | "manual" | "calculated";
export type PreflightStatus = "not_started" | "in_review" | "blocked" | "ready" | "submitted" | "stale";

export type PreflightBlocker = {
  code: string;
  group: string;
  message: string;
  artifactId?: string;
  page?: number;
  fixAction:
    | "attach_file"
    | "select_version"
    | "edit_metadata"
    | "open_artifact"
    | "edit_author"
    | "edit_assignment"
    | "regenerate_certificate"
    | "open_preview";
};

export type PeerReviewScoreRow = {
  criterion: string;
  awarded: number;
  maximum: number;
};

export function normalizeDoi(value: string) {
  return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLocaleLowerCase();
}

export function isValidDoi(value: string) {
  return /^10\.\d{4,9}\/\S+$/i.test(normalizeDoi(value));
}

export function isValidOrcid(value: string) {
  const normalized = value.replace(/^https?:\/\/orcid\.org\//i, "").replace(/-/g, "").toUpperCase();
  if (!/^\d{15}[\dX]$/.test(normalized)) return false;
  let total = 0;
  for (let index = 0; index < 15; index += 1) total = (total + Number(normalized[index])) * 2;
  const remainder = (12 - (total % 11)) % 11;
  return normalized[15] === (remainder === 10 ? "X" : String(remainder));
}

export function pageRangeIssue(startValue: string | number | null, endValue: string | number | null) {
  const start = Number(startValue);
  const end = Number(endValue);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return "Page start and end must be positive whole numbers in ascending order.";
  }
  return null;
}

export function rangesOverlap(start: number, end: number, otherStart: number, otherEnd: number) {
  return start <= otherEnd && end >= otherStart;
}

export function validatePeerReviewScores(input: {
  rows: PeerReviewScoreRow[];
  displayedTotal: number;
  reviewDate: string;
  submittedAt: string;
  now?: Date;
}) {
  const issues: string[] = [];
  if (!input.rows.length) issues.push("Enter every peer-review criterion.");
  for (const row of input.rows) {
    if (!row.criterion.trim()) issues.push("Every score row needs a criterion name.");
    if (!Number.isFinite(row.awarded) || !Number.isFinite(row.maximum) || row.maximum <= 0 || row.awarded < 0 || row.awarded > row.maximum) {
      issues.push(`${row.criterion || "A criterion"} has a score outside its allowed maximum.`);
    }
  }
  const awardedTotal = input.rows.reduce((total, row) => total + (Number(row.awarded) || 0), 0);
  const maximumTotal = input.rows.reduce((total, row) => total + (Number(row.maximum) || 0), 0);
  if (maximumTotal !== 100) issues.push(`Peer-review maximum scores total ${maximumTotal}; the required denominator is 100.`);
  if (awardedTotal !== Number(input.displayedTotal)) {
    issues.push(`Displayed peer-review score is ${input.displayedTotal}, but the entered criteria total ${awardedTotal}.`);
  }
  if (!Number.isFinite(input.displayedTotal) || input.displayedTotal < 0 || input.displayedTotal > 100) {
    issues.push("The displayed peer-review score must be between 0 and 100.");
  }
  const reviewDate = new Date(`${input.reviewDate}T12:00:00Z`);
  const submittedDate = new Date(input.submittedAt);
  const now = input.now || new Date();
  if (!input.reviewDate || Number.isNaN(reviewDate.getTime())) issues.push("Enter the review date shown in the peer-review result.");
  else {
    if (reviewDate < submittedDate) issues.push("The peer-review date cannot be before the submission date.");
    if (reviewDate > now) issues.push("The peer-review date cannot be in the future.");
  }
  return { issues, awardedTotal, maximumTotal, valid: issues.length === 0 };
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
