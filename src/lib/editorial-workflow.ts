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
  const currentIndex = stage === "published" || stage === "closed"
    ? 4
    : stage.startsWith("production_")
      ? stage === "production_ready_to_publish" || stage === "production_scheduled" ? 3 : 2
      : stage === "review_new" ? 0 : 1;

  return [
    { label: "Submitted", complete: currentIndex > 0, current: currentIndex === 0 },
    { label: "Editorial review", complete: currentIndex > 1, current: currentIndex === 1 },
    { label: "Publication production", complete: currentIndex > 2, current: currentIndex === 2 },
    { label: "Ready to publish", complete: currentIndex > 3, current: currentIndex === 3 },
    { label: "Published", complete: currentIndex > 4, current: currentIndex === 4 }
  ];
}
