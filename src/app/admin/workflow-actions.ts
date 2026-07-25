"use server";

import { redirect } from "next/navigation";
import { setWorkflowChecklistItem as completeChecklistItem, configureSubmissionPayment, confirmSubmissionPayment, createAuthorRequest, createWorkflowUpdate, regenerateOfficialReceiptPdf, savePublicationRecord, transitionSubmission } from "@/lib/editorial-workflow-server";
import { isWorkflowStage, type WorkflowStage } from "@/lib/editorial-workflow";

function text(formData: FormData, key: string, maximum = 5000) {
  return String(formData.get(key) || "").trim().slice(0, maximum);
}

function workflowRedirect(submissionId: string, key: "workflowError" | "workflowSuccess", message: string): never {
  const params = new URLSearchParams({ [key]: message });
  redirect(`/admin/submissions/${submissionId}?${params.toString()}`);
}

export async function transitionSubmissionAction(formData: FormData) {
  const submissionId = text(formData, "submissionId", 64);
  const toStage = text(formData, "toStage", 64);
  if (!submissionId || !isWorkflowStage(toStage)) workflowRedirect(submissionId || "unknown", "workflowError", "The requested workflow action is invalid.");

  const scheduledFor = text(formData, "scheduledFor", 80);
  try {
    await transitionSubmission({
      submissionId,
      toStage: toStage as WorkflowStage,
      internalTitle: text(formData, "internalTitle", 200),
      internalDescription: text(formData, "internalDescription"),
      publicTitle: text(formData, "publicTitle", 200),
      publicDescription: text(formData, "publicDescription"),
      visibility: text(formData, "visibility", 20) === "author" ? "author" : "internal",
      metadata: scheduledFor ? { scheduled_for: new Date(scheduledFor).toISOString() } : {}
    });
  } catch (error) {
    workflowRedirect(submissionId, "workflowError", error instanceof Error ? error.message : "The workflow could not be updated.");
  }
  workflowRedirect(submissionId, "workflowSuccess", "Workflow updated.");
}

export async function completeWorkflowChecklistItem(formData: FormData) {
  const submissionId = text(formData, "submissionId", 64);
  const checklistItemId = text(formData, "checklistItemId", 64);
  try {
    await completeChecklistItem({ checklistItemId, completed: text(formData, "completed", 10) === "true" });
  } catch (error) {
    workflowRedirect(submissionId, "workflowError", error instanceof Error ? error.message : "The checklist could not be updated.");
  }
  workflowRedirect(submissionId, "workflowSuccess", "Checklist updated.");
}

export async function savePublicationRecordAction(formData: FormData) {
  const submissionId = text(formData, "submissionId", 64);
  const citationText = text(formData, "citationText", 5000);
  try {
    await savePublicationRecord({
      submissionId,
      journalId: text(formData, "journalId", 64) || undefined,
      issueId: text(formData, "issueId", 64) || undefined,
      doi: text(formData, "doi", 255),
      finalPdfFileId: text(formData, "finalPdfFileId", 64) || undefined,
      certificateFileId: text(formData, "certificateFileId", 64) || undefined,
      citationData: citationText ? { formatted_citation: citationText } : {},
      metadata: { publication_notes: text(formData, "publicationNotes", 5000) }
    });
  } catch (error) {
    workflowRedirect(submissionId, "workflowError", error instanceof Error ? error.message : "The publication record could not be saved.");
  }
  workflowRedirect(submissionId, "workflowSuccess", "Publication record saved.");
}

export async function createWorkflowUpdateAction(formData: FormData) {
  const submissionId = text(formData, "submissionId", 64);
  try {
    await createWorkflowUpdate({
      submissionId,
      title: text(formData, "title", 200),
      description: text(formData, "description", 5000),
      visibility: text(formData, "visibility", 20) === "author" ? "author" : "internal"
    });
  } catch (error) {
    workflowRedirect(submissionId, "workflowError", error instanceof Error ? error.message : "The editorial update could not be saved.");
  }
  workflowRedirect(submissionId, "workflowSuccess", "Editorial update saved.");
}

export async function createAuthorRequestAction(formData: FormData) {
  const submissionId = text(formData, "submissionId", 64);
  const dueAt = text(formData, "dueAt", 80);
  try {
    await createAuthorRequest({
      submissionId,
      requestType: text(formData, "requestType", 30) as "revision" | "proof_approval" | "information" | "consent" | "other",
      title: text(formData, "title", 200),
      description: text(formData, "description", 5000),
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined
    });
  } catch (error) {
    workflowRedirect(submissionId, "workflowError", error instanceof Error ? error.message : "The author request could not be created.");
  }
  workflowRedirect(submissionId, "workflowSuccess", "Author request sent.");
}

function amount(formData: FormData, key: string) {
  const value = text(formData, key, 32);
  return value ? Number(value) : 0;
}

export async function configureSubmissionPaymentAction(formData: FormData) {
  const submissionId = text(formData, "submissionId", 64);
  try {
    await configureSubmissionPayment({
      submissionId,
      paymentId: text(formData, "paymentId", 64) || undefined,
      provider: text(formData, "provider", 100),
      paymentReference: text(formData, "paymentReference", 200),
      feePreset: text(formData, "feePreset", 40) as "literature_500" | "research_2500" | "extended_3000" | "premium_5000" | "custom",
      customFee: amount(formData, "customFee"),
      taxAmount: amount(formData, "taxAmount"),
      promoDiscount: text(formData, "promoDiscount", 30) as "none" | "promo_150" | "promo_350",
      customDiscount: amount(formData, "customDiscount")
    });
  } catch (error) {
    workflowRedirect(submissionId, "workflowError", error instanceof Error ? error.message : "The payment quote could not be saved.");
  }
  workflowRedirect(submissionId, "workflowSuccess", "Payment quote saved.");
}

export async function confirmSubmissionPaymentAction(formData: FormData) {
  const submissionId = text(formData, "submissionId", 64);
  try {
    await confirmSubmissionPayment({ submissionId, paymentId: text(formData, "paymentId", 64) });
  } catch (error) {
    workflowRedirect(submissionId, "workflowError", error instanceof Error ? error.message : "The payment could not be confirmed.");
  }
  workflowRedirect(submissionId, "workflowSuccess", "Payment confirmed and official receipt created.");
}

export async function regenerateOfficialReceiptPdfAction(formData: FormData) {
  const submissionId = text(formData, "submissionId", 64);
  try {
    await regenerateOfficialReceiptPdf({ submissionId, receiptId: text(formData, "receiptId", 64) });
  } catch (error) {
    workflowRedirect(submissionId, "workflowError", error instanceof Error ? error.message : "The receipt PDF could not be generated.");
  }
  workflowRedirect(submissionId, "workflowSuccess", "Receipt PDF generated.");
}
