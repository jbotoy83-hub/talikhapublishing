import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { workflowStages, type WorkflowStage } from "@/lib/editorial-workflow";
import { getSiteUrl } from "@/lib/site";
import { renderOfficialReceiptPdf } from "@/lib/receipt-pdf";
import { createApa7JournalCitation } from "@/lib/apa-citation";

const uuid = z.string().uuid();
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().transform((value) => value || undefined);

const transitionInput = z.object({
  submissionId: uuid,
  toStage: z.enum(workflowStages),
  internalTitle: optionalText(200),
  internalDescription: optionalText(5000),
  publicTitle: optionalText(200),
  publicDescription: optionalText(5000),
  visibility: z.enum(["internal", "author"]).default("internal"),
  metadata: z.record(z.string(), z.unknown()).default({})
});

const publicationRecordInput = z.object({
  submissionId: uuid,
  journalId: uuid.optional(),
  issueId: uuid.optional(),
  doi: optionalText(255),
  finalPdfFileId: uuid.optional(),
  certificateFileId: uuid.optional(),
  citationData: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({})
});

const workflowUpdateInput = z.object({
  submissionId: uuid,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  visibility: z.enum(["internal", "author"])
});

const authorRequestInput = z.object({
  submissionId: uuid,
  requestType: z.enum(["revision", "proof_approval", "information", "consent", "other"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  dueAt: z.string().datetime().optional()
});

const paymentQuoteInput = z.object({
  submissionId: uuid,
  paymentId: uuid.optional(),
  provider: optionalText(100),
  paymentReference: optionalText(200),
  feePreset: z.enum(["literature_500", "research_2500", "extended_3000", "premium_5000", "custom"]),
  customFee: z.coerce.number().min(0).max(50000).optional(),
  taxAmount: z.coerce.number().min(0).max(50000).default(0),
  promoDiscount: z.enum(["none", "promo_150", "promo_350"]).default("none"),
  customDiscount: z.coerce.number().min(0).max(50000).default(0)
});

const confirmPaymentInput = z.object({ paymentId: uuid, submissionId: uuid });
const regenerateReceiptInput = z.object({ receiptId: uuid, submissionId: uuid });

const feePresets = {
  literature_500: { label: "Literature processing fee", amount: 500 },
  research_2500: { label: "Research processing fee", amount: 2500 },
  extended_3000: { label: "Extended processing fee", amount: 3000 },
  premium_5000: { label: "Premium processing fee", amount: 5000 }
} as const;

function workflowFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "The workflow could not be updated.";
  if (/Required checklist|publication-ready manuscript|final PDF|confirmed payment|publication record|future publication date|not yet due|payment|receipt|currency|discount|fee/i.test(message)) return message;
  return "The workflow could not be updated. Please refresh the record and try again.";
}

function refreshWorkflowPages(submissionId: string) {
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath("/admin/production");
  revalidatePath("/admin/schedule");
  revalidatePath("/publications");
  revalidatePath("/publications/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

function publicationSlug(title: string, submissionId: string) {
  const base = title.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 78) || "publication";
  return `${base}-${submissionId.slice(0, 8).toLocaleLowerCase()}`;
}

function publicationContentType(value: string) {
  if (/creative|poetry|fiction|literature/i.test(value)) return "creative";
  if (/commentary|essay|opinion/i.test(value)) return "commentary";
  return "research";
}

export async function transitionSubmission(input: z.input<typeof transitionInput>) {
  const parsed = transitionInput.parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { data, error } = await admin.rpc("transition_submission", {
    p_submission_id: parsed.submissionId,
    p_to_stage: parsed.toStage,
    p_actor_id: user.id,
    p_internal_title: parsed.internalTitle || "",
    p_internal_description: parsed.internalDescription || "",
    p_public_title: parsed.publicTitle || null,
    p_public_description: parsed.publicDescription || null,
    p_visibility: parsed.visibility,
    p_metadata: parsed.metadata
  });

  if (error) throw new Error(workflowFailure(error));
  refreshWorkflowPages(parsed.submissionId);
  return data;
}

export async function setWorkflowChecklistItem(input: { checklistItemId: string; completed: boolean }) {
  const parsed = z.object({ checklistItemId: uuid, completed: z.boolean() }).parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { data, error } = await admin.rpc("complete_workflow_checklist_item", {
    p_checklist_item_id: parsed.checklistItemId,
    p_actor_id: user.id,
    p_completed: parsed.completed
  });
  if (error || !data) throw new Error(workflowFailure(error));
  refreshWorkflowPages((data as { submission_id: string }).submission_id);
  return data as { submission_id: string };
}

export async function savePublicationRecord(input: z.input<typeof publicationRecordInput>) {
  const parsed = publicationRecordInput.parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { data: submission, error: submissionError } = await admin
    .from("submissions")
    .select("id, title, abstract, author_name, publication_type, current_stage")
    .eq("id", parsed.submissionId)
    .maybeSingle();
  if (submissionError || !submission) throw new Error("The submission record could not be found.");
  if (!(String(submission.current_stage) as WorkflowStage).startsWith("production_")) {
    throw new Error("Publication records can only be prepared after acceptance.");
  }

  if (parsed.issueId && !parsed.journalId) throw new Error("Choose the journal before assigning an issue.");
  if (parsed.issueId && parsed.journalId) {
    const { data: issue } = await admin.from("issues").select("journal_id").eq("id", parsed.issueId).maybeSingle();
    if (!issue || issue.journal_id !== parsed.journalId) throw new Error("The selected issue does not belong to the selected journal.");
  }

  let publicationId: string | null = null;
  let publicArticleUrl: string | null = null;
  let citationData: Record<string, unknown> = parsed.citationData;
  if (parsed.journalId) {
    const { data: existingPublications } = await admin.from("publications").select("id, slug").eq("source_submission_id", parsed.submissionId).limit(1);
    const existingPublication = existingPublications?.[0];
    const { data: submittedAuthors } = await admin.from("submission_authors").select("position, first_name, middle_initial, surname").eq("submission_id", parsed.submissionId).order("position");
    const authorDisplay = (submittedAuthors || []).map((author) => [author.first_name, author.middle_initial, author.surname].filter(Boolean).join(" ")).join("; ") || submission.author_name;
    const { data: journal } = await admin.from("journals").select("title").eq("id", parsed.journalId).maybeSingle();
    const { data: citationIssue } = parsed.issueId ? await admin.from("issues").select("volume, issue_number").eq("id", parsed.issueId).maybeSingle() : { data: null };
    citationData = createApa7JournalCitation({ authors: (submittedAuthors || []).map((author) => [author.first_name, author.middle_initial, author.surname].filter(Boolean).join(" ")).filter(Boolean).length ? (submittedAuthors || []).map((author) => [author.first_name, author.middle_initial, author.surname].filter(Boolean).join(" ")) : [submission.author_name], title: submission.title, year: new Date().getFullYear(), journalTitle: journal?.title || "", volume: citationIssue?.volume, issue: citationIssue?.issue_number, doi: parsed.doi });
    const slug = existingPublication?.slug || publicationSlug(submission.title, submission.id);
    const pdfUrl = new URL(`/api/publications/${slug}/pdf`, `${getSiteUrl()}/`).toString();

    if (existingPublication) {
      const { data: updated, error: updateError } = await admin.from("publications").update({
        journal_id: parsed.journalId,
        issue_id: parsed.issueId || null,
        title: submission.title,
        abstract: submission.abstract || "",
        author_display: authorDisplay,
        doi: parsed.doi || null,
        pdf_url: pdfUrl,
        recommended_citation: String(citationData.formatted_citation || ""),
        content_type: publicationContentType(String((submission as { publication_type?: string }).publication_type || ""))
      }).eq("id", existingPublication.id).select("id, slug").single();
      if (updateError || !updated) throw new Error("The public publication record could not be updated.");
      publicationId = updated.id;
      publicArticleUrl = new URL(`/publications/${updated.slug}`, `${getSiteUrl()}/`).toString();
    } else {
      const { data: created, error: createError } = await admin.from("publications").insert({
        journal_id: parsed.journalId,
        issue_id: parsed.issueId || null,
        source_submission_id: parsed.submissionId,
        slug,
        title: submission.title,
        abstract: submission.abstract || "",
        author_display: authorDisplay,
        doi: parsed.doi || null,
        pdf_url: pdfUrl,
        recommended_citation: String(citationData.formatted_citation || ""),
        content_type: publicationContentType(String((submission as { publication_type?: string }).publication_type || "")),
        status: "draft"
      }).select("id, slug").single();
      if (createError || !created) throw new Error("The public publication record could not be created.");
      publicationId = created.id;
      publicArticleUrl = new URL(`/publications/${created.slug}`, `${getSiteUrl()}/`).toString();
    }
  }

  const { error } = await admin.from("publication_records").upsert({
    submission_id: parsed.submissionId,
    publication_id: publicationId,
    journal_id: parsed.journalId || null,
    issue_id: parsed.issueId || null,
    doi: parsed.doi || null,
    public_article_url: publicArticleUrl || null,
    final_pdf_file_id: parsed.finalPdfFileId || null,
    certificate_file_id: parsed.certificateFileId || null,
    citation_data: citationData,
    metadata: parsed.metadata
  }, { onConflict: "submission_id" });
  if (error) throw new Error("The publication record could not be saved.");

  await admin.from("workflow_events").insert({
    submission_id: parsed.submissionId,
    event_type: "publication_record_updated",
    internal_title: "Publication record updated",
    internal_description: "Publication metadata, issue assignment, or final documents were updated.",
    visibility: "internal",
    actor_type: user.role,
    actor_id: user.id,
    metadata: { doi: parsed.doi || null, issue_id: parsed.issueId || null }
  });
  refreshWorkflowPages(parsed.submissionId);
}

export async function createWorkflowUpdate(input: z.input<typeof workflowUpdateInput>) {
  const parsed = workflowUpdateInput.parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { error } = await admin.from("workflow_events").insert({
    submission_id: parsed.submissionId,
    event_type: "editorial_update",
    internal_title: parsed.title,
    internal_description: parsed.description,
    public_title: parsed.visibility === "author" ? parsed.title : null,
    public_description: parsed.visibility === "author" ? parsed.description : null,
    visibility: parsed.visibility,
    actor_type: user.role,
    actor_id: user.id
  });
  if (error) throw new Error("The editorial update could not be saved.");
  refreshWorkflowPages(parsed.submissionId);
}

export async function createAuthorRequest(input: z.input<typeof authorRequestInput>) {
  const parsed = authorRequestInput.parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { error } = await admin.rpc("create_author_request", {
    p_submission_id: parsed.submissionId,
    p_actor_id: user.id,
    p_request_type: parsed.requestType,
    p_title: parsed.title,
    p_description: parsed.description,
    p_due_at: parsed.dueAt || null
  });
  if (error) throw new Error("The author request could not be created.");
  refreshWorkflowPages(parsed.submissionId);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildPaymentLines(input: z.infer<typeof paymentQuoteInput>) {
  const preset = input.feePreset === "custom" ? null : feePresets[input.feePreset];
  const processingFee = input.feePreset === "custom" ? roundCurrency(input.customFee || 0) : preset?.amount || 0;
  if (processingFee <= 0) throw new Error("Enter a processing fee greater than zero.");

  const lines: Array<{ code: "processing_fee" | "tax" | "promo_discount" | "custom_discount"; description: string; amount: number }> = [{
    code: "processing_fee",
    description: preset?.label || "Custom publication processing fee",
    amount: processingFee
  }];
  if (input.taxAmount > 0) lines.push({ code: "tax", description: "Tax", amount: roundCurrency(input.taxAmount) });
  if (input.promoDiscount === "promo_150") lines.push({ code: "promo_discount", description: "Promo discount", amount: -150 });
  if (input.promoDiscount === "promo_350") lines.push({ code: "promo_discount", description: "Promo discount", amount: -350 });
  if (input.customDiscount > 0) lines.push({ code: "custom_discount", description: "Custom discount", amount: -roundCurrency(input.customDiscount) });

  const total = roundCurrency(lines.reduce((sum, line) => sum + line.amount, 0));
  if (total < 0) throw new Error("Discounts cannot exceed the fee and tax total.");
  return { lines, total };
}

export async function configureSubmissionPayment(input: z.input<typeof paymentQuoteInput>) {
  const parsed = paymentQuoteInput.parse(input);
  const { lines } = buildPaymentLines(parsed);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { error } = await admin.rpc("configure_submission_payment", {
    p_submission_id: parsed.submissionId,
    p_payment_id: parsed.paymentId || null,
    p_actor_id: user.id,
    p_provider: parsed.provider || null,
    p_payment_reference: parsed.paymentReference || null,
    p_currency: "PHP",
    p_lines: lines,
    p_metadata: {
      fee_preset: parsed.feePreset,
      custom_fee: parsed.feePreset === "custom" ? parsed.customFee || 0 : null,
      tax_amount: parsed.taxAmount,
      promo_discount: parsed.promoDiscount,
      custom_discount: parsed.customDiscount
    }
  });
  if (error) throw new Error(workflowFailure(error));
  refreshWorkflowPages(parsed.submissionId);
}

export async function confirmSubmissionPayment(input: z.input<typeof confirmPaymentInput>) {
  const parsed = confirmPaymentInput.parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { data: payment, error } = await admin.rpc("confirm_submission_payment", { p_payment_id: parsed.paymentId, p_actor_id: user.id });
  if (error) throw new Error(workflowFailure(error));
  if (!payment) throw new Error("The payment could not be confirmed.");
  await createOfficialReceiptPdf({ paymentId: parsed.paymentId, submissionId: parsed.submissionId });
  refreshWorkflowPages(parsed.submissionId);
}

export async function regenerateOfficialReceiptPdf(input: z.input<typeof regenerateReceiptInput>) {
  const parsed = regenerateReceiptInput.parse(input);
  await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");
  const { data: receipt, error } = await admin.from("receipts").select("payment_id, submission_id").eq("id", parsed.receiptId).eq("submission_id", parsed.submissionId).maybeSingle();
  if (error || !receipt) throw new Error("The receipt record could not be found.");
  await createOfficialReceiptPdf({ paymentId: receipt.payment_id, submissionId: receipt.submission_id });
  refreshWorkflowPages(parsed.submissionId);
}

async function createOfficialReceiptPdf({ paymentId, submissionId }: { paymentId: string; submissionId: string }) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { data: receipt, error: receiptError } = await admin
    .from("receipts")
    .select("id, receipt_number, amount, currency, issued_at, storage_path, snapshot")
    .eq("payment_id", paymentId)
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (receiptError || !receipt) throw new Error("The receipt record could not be created.");

  const fileName = `official-receipt-${receipt.receipt_number}.pdf`;
  const storagePath = `${submissionId}/receipts/${fileName}`;
  try {
    const pdf = await renderOfficialReceiptPdf({
      receiptNumber: receipt.receipt_number,
      amount: Number(receipt.amount),
      currency: receipt.currency,
      issuedAt: receipt.issued_at,
      snapshot: receipt.snapshot as Parameters<typeof renderOfficialReceiptPdf>[0]["snapshot"]
    });
    const { error: uploadError } = await admin.storage.from("receipts").upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error("The receipt PDF could not be stored.");

    const { data: existingFile } = await admin.from("submission_files").select("id").eq("submission_id", submissionId).eq("storage_path", storagePath).maybeSingle();
    if (existingFile) {
      await admin.from("submission_files").update({ original_name: fileName, mime_type: "application/pdf", size_bytes: pdf.length, storage_bucket: "receipts" }).eq("id", existingFile.id);
    } else {
      const { error: fileError } = await admin.from("submission_files").insert({ submission_id: submissionId, file_kind: "receipt", storage_path: storagePath, storage_bucket: "receipts", original_name: fileName, mime_type: "application/pdf", size_bytes: pdf.length });
      if (fileError) throw new Error("The receipt document record could not be saved.");
    }
    await admin.from("receipts").update({ storage_bucket: "receipts", storage_path: storagePath, snapshot: { ...(receipt.snapshot as Record<string, unknown> || {}), pdf_status: "ready" } }).eq("id", receipt.id);
  } catch {
    await admin.from("receipts").update({ snapshot: { ...(receipt.snapshot as Record<string, unknown> || {}), pdf_status: "pending" } }).eq("id", receipt.id);
    throw new Error("Payment confirmed, but the receipt PDF is still being prepared. The payment record has been preserved safely.");
  }
}
