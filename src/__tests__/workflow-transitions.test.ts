import { describe, it, expect } from "vitest";
import {
  workflowStages,
  progressIndexOf,
  progressBoundary,
  canonicalStageForProgress,
  deriveAuthorStatus,
  getAuthorProgress,
  isWorkflowStage,
  getUpcomingWorkflowStages,
  type WorkflowStage,
} from "@/lib/editorial-workflow";

describe("workflowStages", () => {
  it("contains all 12 stages in order", () => {
    expect(workflowStages).toHaveLength(12);
    expect(workflowStages[0]).toBe("review_new");
    expect(workflowStages[workflowStages.length - 1]).toBe("closed");
  });
});

describe("isWorkflowStage", () => {
  it("accepts valid stages", () => {
    expect(isWorkflowStage("review_new")).toBe(true);
    expect(isWorkflowStage("published")).toBe(true);
    expect(isWorkflowStage("closed")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isWorkflowStage("invalid")).toBe(false);
    expect(isWorkflowStage(null)).toBe(false);
    expect(isWorkflowStage(undefined)).toBe(false);
    expect(isWorkflowStage("")).toBe(false);
  });
});

describe("progressIndexOf", () => {
  it("maps review stages to progress 0-1", () => {
    expect(progressIndexOf("review_new")).toBe(0);
    expect(progressIndexOf("review_in_progress")).toBe(1);
    expect(progressIndexOf("review_final")).toBe(1);
    expect(progressIndexOf("review_accepted")).toBe(1);
  });

  it("maps production stages to progress 2-3", () => {
    expect(progressIndexOf("production_ready")).toBe(2);
    expect(progressIndexOf("production_preparation")).toBe(2);
    expect(progressIndexOf("production_proof")).toBe(2);
    expect(progressIndexOf("production_records")).toBe(2);
    expect(progressIndexOf("production_ready_to_publish")).toBe(3);
    expect(progressIndexOf("production_scheduled")).toBe(3);
  });

  it("maps terminal stages correctly", () => {
    expect(progressIndexOf("published")).toBe(4);
    expect(progressIndexOf("closed")).toBe(-1);
  });
});

describe("canonicalStageForProgress", () => {
  it("returns the entry stage for each progress level", () => {
    expect(canonicalStageForProgress(0)).toBe("review_new");
    expect(canonicalStageForProgress(1)).toBe("review_in_progress");
    expect(canonicalStageForProgress(2)).toBe("production_ready");
    expect(canonicalStageForProgress(3)).toBe("production_ready_to_publish");
    expect(canonicalStageForProgress(4)).toBe("published");
  });

  it("falls back to review_new for unknown progress", () => {
    expect(canonicalStageForProgress(99)).toBe("review_new");
  });
});

describe("progressBoundary", () => {
  it("emits closing + opening activities at boundary 0→1", () => {
    const activities = progressBoundary(0, 1);
    expect(activities.length).toBeGreaterThan(0);
    expect(activities.some((a) => a.title === "Submission verified")).toBe(true);
    expect(activities.some((a) => a.title === "Editorial review started")).toBe(true);
  });

  it("emits closing + opening activities at boundary 1→2", () => {
    const activities = progressBoundary(1, 2);
    expect(activities.some((a) => a.title === "Submission accepted")).toBe(true);
    expect(activities.some((a) => a.title === "Publication production started")).toBe(true);
  });

  it("returns closing + opening for same progress (no guard)", () => {
    const activities = progressBoundary(2, 2);
    expect(activities.length).toBeGreaterThan(0);
    expect(activities.some((a) => a.title === "Publication preparation completed")).toBe(true);
  });
});

describe("deriveAuthorStatus", () => {
  it("returns Declined for closed", () => {
    expect(deriveAuthorStatus("closed", false)).toBe("Declined");
  });

  it("returns Published for published", () => {
    expect(deriveAuthorStatus("published", false)).toBe("Published");
  });

  it("returns Scheduled for production_scheduled", () => {
    expect(deriveAuthorStatus("production_scheduled", false)).toBe("Scheduled");
  });

  it("returns Ready to publish for production_ready_to_publish", () => {
    expect(deriveAuthorStatus("production_ready_to_publish", false)).toBe("Ready to publish");
  });

  it("returns In production for other production stages", () => {
    expect(deriveAuthorStatus("production_ready", false)).toBe("In production");
    expect(deriveAuthorStatus("production_preparation", false)).toBe("In production");
    expect(deriveAuthorStatus("production_proof", false)).toBe("In production");
    expect(deriveAuthorStatus("production_records", false)).toBe("In production");
  });

  it("returns Revision required when open revision exists", () => {
    expect(deriveAuthorStatus("review_in_progress", true)).toBe("Revision required");
  });

  it("returns New submission for review_new", () => {
    expect(deriveAuthorStatus("review_new", false)).toBe("New submission");
  });

  it("returns Under review for other review stages", () => {
    expect(deriveAuthorStatus("review_in_progress", false)).toBe("Under review");
    expect(deriveAuthorStatus("review_final", false)).toBe("Under review");
    expect(deriveAuthorStatus("review_accepted", false)).toBe("Under review");
  });
});

describe("getAuthorProgress", () => {
  it("returns 5 steps for active submissions", () => {
    const steps = getAuthorProgress("review_new");
    expect(steps).toHaveLength(5);
    expect(steps[0].label).toBe("Submitted");
    expect(steps[0].current).toBe(true);
  });

  it("marks completed steps correctly", () => {
    const steps = getAuthorProgress("production_ready");
    expect(steps[0].complete).toBe(true);
    expect(steps[1].complete).toBe(true);
    expect(steps[2].current).toBe(true);
  });

  it("shows Declined step for closed submissions", () => {
    const steps = getAuthorProgress("closed");
    expect(steps).toHaveLength(5);
    expect(steps[4].label).toBe("Declined");
    expect(steps[4].current).toBe(true);
  });
});

describe("getUpcomingWorkflowStages", () => {
  it("returns all subsequent stages", () => {
    const upcoming = getUpcomingWorkflowStages("review_new");
    expect(upcoming[0]).toBe("review_in_progress");
    expect(upcoming).not.toContain("review_new");
    expect(upcoming).not.toContain("closed");
  });

  it("returns empty for closed", () => {
    expect(getUpcomingWorkflowStages("closed")).toHaveLength(0);
  });

  it("returns only published for production_scheduled", () => {
    const upcoming = getUpcomingWorkflowStages("production_scheduled");
    expect(upcoming).toEqual(["published"]);
  });
});
