import { describe, expect, it } from "vitest";
import {
  isValidDoi,
  isValidOrcid,
  normalizeDoi,
  pageRangeIssue,
  rangesOverlap,
  stableJson,
  validatePeerReviewScores,
} from "@/lib/publication-preflight-rules";

describe("publication preflight rules", () => {
  it("normalizes and validates DOI values", () => {
    expect(normalizeDoi("https://doi.org/10.1234/Example")).toBe("10.1234/example");
    expect(isValidDoi("10.1234/example")).toBe(true);
    expect(isValidDoi("example")).toBe(false);
  });

  it("validates ORCID checksums", () => {
    expect(isValidOrcid("0000-0002-1825-0097")).toBe(true);
    expect(isValidOrcid("0000-0002-1825-0098")).toBe(false);
  });

  it("checks page ordering and overlap", () => {
    expect(pageRangeIssue(1, 10)).toBeNull();
    expect(pageRangeIssue(10, 1)).toMatch(/ascending/);
    expect(rangesOverlap(12, 20, 18, 24)).toBe(true);
    expect(rangesOverlap(1, 10, 11, 20)).toBe(false);
  });

  it("calculates peer-review totals and chronology", () => {
    const valid = validatePeerReviewScores({
      rows: [{ criterion: "Quality", awarded: 45, maximum: 50 }, { criterion: "Clarity", awarded: 43, maximum: 50 }],
      displayedTotal: 88,
      reviewDate: "2026-07-15",
      submittedAt: "2026-07-01T00:00:00Z",
      now: new Date("2026-07-30T00:00:00Z"),
    });
    expect(valid.valid).toBe(true);
    expect(valid.awardedTotal).toBe(88);

    const invalid = validatePeerReviewScores({
      rows: [{ criterion: "Quality", awarded: 86, maximum: 95 }],
      displayedTotal: 88,
      reviewDate: "2026-06-30",
      submittedAt: "2026-07-01T00:00:00Z",
      now: new Date("2026-07-30T00:00:00Z"),
    });
    expect(invalid.issues).toContain("Peer-review maximum scores total 95; the required denominator is 100.");
    expect(invalid.issues).toContain("Displayed peer-review score is 88, but the entered criteria total 86.");
  });

  it("creates deterministic serialized fingerprints", () => {
    expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
  });
});
