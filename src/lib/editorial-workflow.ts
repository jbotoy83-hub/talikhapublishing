export const workflowStages = [
  "review_new",
  "review_in_progress",
  "review_final",
  "review_accepted",
  "production_ready",
  "production_preparation",
  "production_proof",
  "production_records",
  "production_ready_to_publish",
  "production_scheduled",
  "published",
  "closed"
] as const;

export type WorkflowStage = (typeof workflowStages)[number];

export const reviewStages = [
  "review_new",
  "review_in_progress",
  "review_final",
  "review_accepted",
  "closed"
] as const satisfies readonly WorkflowStage[];

export const productionStages = [
  "production_ready",
  "production_preparation",
  "production_proof",
  "production_records",
  "production_ready_to_publish",
  "production_scheduled",
  "published"
] as const satisfies readonly WorkflowStage[];

export const workflowStageLabels: Record<WorkflowStage, string> = {
  review_new: "New submission",
  review_in_progress: "In progress",
  review_final: "Final review",
  review_accepted: "Accepted",
  production_ready: "Ready for production",
  production_preparation: "Manuscript preparation",
  production_proof: "Author proof",
  production_records: "Publication records",
  production_ready_to_publish: "Ready to publish",
  production_scheduled: "Scheduled",
  published: "Published",
  closed: "Closed"
};

export const primaryWorkflowActions: Partial<Record<WorkflowStage, { to: WorkflowStage; label: string }>> = {
  review_new: { to: "review_in_progress", label: "Start review" },
  review_in_progress: { to: "review_final", label: "Send to final review" },
  review_final: { to: "review_accepted", label: "Accept to production" },
  review_accepted: { to: "production_ready", label: "Open production record" },
  production_ready: { to: "production_preparation", label: "Start preparation" },
  production_preparation: { to: "production_proof", label: "Send author proof" },
  production_proof: { to: "production_records", label: "Record proof decision" },
  production_records: { to: "production_ready_to_publish", label: "Prepare for publishing" },
  production_ready_to_publish: { to: "production_scheduled", label: "Schedule publication" },
  production_scheduled: { to: "published", label: "Publish when due" },
  published: { to: "closed", label: "Close record" }
};

export const workflowStageOrder = workflowStages.filter((stage) => stage !== "closed");

export function getUpcomingWorkflowStages(stage: WorkflowStage) {
  if (stage === "closed") return [];
  const currentIndex = workflowStageOrder.indexOf(stage);
  return currentIndex < 0 ? [] : workflowStageOrder.slice(currentIndex + 1);
}

export function isWorkflowStage(value: string | null | undefined): value is WorkflowStage {
  return Boolean(value) && (workflowStages as readonly string[]).includes(value as string);
}

export function getAuthorProgress(stage: WorkflowStage) {
  const currentIndex = stage === "published"
    ? 4
    : stage === "closed"
      ? -1
      : stage.startsWith("production_")
        ? stage === "production_ready_to_publish" || stage === "production_scheduled" ? 3 : 2
        : stage === "review_new" ? 0 : 1;

  if (stage === "closed") {
    return [
      { label: "Submitted", complete: true, current: false },
      { label: "Editorial review", complete: false, current: false },
      { label: "Publication production", complete: false, current: false },
      { label: "Ready to publish", complete: false, current: false },
      { label: "Declined", complete: false, current: true }
    ];
  }

  return [
    { label: "Submitted", complete: currentIndex > 0, current: currentIndex === 0 },
    { label: "Editorial review", complete: currentIndex > 1, current: currentIndex === 1 },
    { label: "Publication production", complete: currentIndex > 2, current: currentIndex === 2 },
    { label: "Ready to publish", complete: currentIndex > 3, current: currentIndex === 3 },
    { label: "Published", complete: currentIndex > 4, current: currentIndex === 4 }
  ];
}

export type ProgressActivity = { title: string; description: string };

export const PROGRESS_OPENING: Record<number, ProgressActivity[]> = {
  0: [
    { title: "Submission received", description: "Your submission has been successfully received." },
    { title: "Submission under verification", description: "Your submission and supporting documents are being checked." }
  ],
  1: [
    { title: "Editorial review started", description: "Your submission is currently being evaluated by the editorial team." },
    { title: "Editorial review in progress", description: "The editorial evaluation of your submission is ongoing." }
  ],
  2: [
    { title: "Publication production started", description: "Your submission is being prepared for publication." },
    { title: "Publication preparation in progress", description: "The final publication files and information are being prepared." }
  ],
  3: [
    { title: "Ready for publication", description: "Your submission has completed the editorial and production processes." }
  ],
  4: [
    { title: "Published", description: "Your submission has been officially published." },
    { title: "Publication files available", description: "The final publication files are now available." },
    { title: "Certificate available", description: "Your publication certificate is now available." },
    { title: "Publication information updated", description: "Information associated with your publication has been updated." }
  ]
};

export const PROGRESS_CLOSING: Record<number, ProgressActivity[]> = {
  0: [
    { title: "Submission verified", description: "Your submission has been verified and will proceed to editorial review." }
  ],
  1: [
    { title: "Editorial review completed", description: "The editorial evaluation has been completed." },
    { title: "Submission accepted", description: "Your submission has been accepted and will proceed to publication production." }
  ],
  2: [
    { title: "Publication preparation completed", description: "The production process has been completed." }
  ]
};

export const SCHEDULE_FIRST: ProgressActivity = { title: "Publication scheduled", description: "Your submission has been scheduled for publication." };
export const SCHEDULE_UPDATED: ProgressActivity = { title: "Publication schedule updated", description: "The publication schedule for your submission has been updated." };
export const POST_PUBLISH_INFO: ProgressActivity = { title: "Publication information updated", description: "Information associated with your publication has been updated." };
export const POST_PUBLISH_CERT: ProgressActivity = { title: "Certificate available", description: "Your publication certificate is now available." };

export function progressBoundary(fromProgress: number, toProgress: number): ProgressActivity[] {
  const closing = PROGRESS_CLOSING[fromProgress] || [];
  const opening = PROGRESS_OPENING[toProgress] || [];
  return [...closing, ...opening];
}

const PROGRESS_STAGE_MAP: Record<WorkflowStage, number> = {
  review_new: 0,
  review_in_progress: 1, review_final: 1, review_accepted: 1,
  production_ready: 2, production_preparation: 2, production_proof: 2, production_records: 2,
  production_ready_to_publish: 3, production_scheduled: 3,
  published: 4,
  closed: -1
};

export function progressIndexOf(stage: WorkflowStage): number {
  return PROGRESS_STAGE_MAP[stage] ?? -1;
}

const CANONICAL_STAGE: Record<number, WorkflowStage> = {
  0: "review_new",
  1: "review_in_progress",
  2: "production_ready",
  3: "production_ready_to_publish",
  4: "published"
};

export function canonicalStageForProgress(progress: number): WorkflowStage {
  return CANONICAL_STAGE[progress] || "review_new";
}

export function deriveAuthorStatus(stage: WorkflowStage, hasOpenRevision: boolean): string {
  if (stage === "closed") return "Declined";
  if (stage === "published") return "Published";
  if (stage === "production_scheduled") return "Scheduled";
  if (stage === "production_ready_to_publish") return "Ready to publish";
  if (stage.startsWith("production_")) return "In production";
  if (hasOpenRevision) return "Revision required";
  if (stage === "review_new") return "New submission";
  return "Under review";
}
