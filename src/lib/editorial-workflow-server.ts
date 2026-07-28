import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { workflowStages, type WorkflowStage, progressIndexOf, progressBoundary, canonicalStageForProgress, SCHEDULE_FIRST, SCHEDULE_UPDATED, POST_PUBLISH_INFO, type ProgressActivity } from "@/lib/editorial-workflow";
import { getSiteUrl } from "@/lib/site";
import { renderOfficialReceiptPdf } from "@/lib/receipt-pdf";
import { createApa7JournalCitation } from "@/lib/apa-citation";

const uuid = z.string().uuid();
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().transform((value) => value || undefined);
const optionalDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date (YYYY-MM-DD)").optional().transform((value) => value || undefined);
const doiField = z.string().trim().max(255).regex(/^10\.\d{4,9}\/\S+$/, "Enter a valid DOI, e.g. 10.1000/xyz123").optional().transform((value) => value || undefined);

const transitionInput = z.object({
  submissionId: uuid,
  toStage: z.enum(workflowStages),
  internalTitle: optionalText(200),
  internalDescription: optionalText(5000),
  publicTitle: optionalText(200),
  publicDescription: optionalText(5000),
  visibility: z.enum(["internal", "author"]).default("internal"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  silent: z.boolean().default(false)
});

const publicationRecordInput = z.object({
  submissionId: uuid,
  journalId: uuid.optional(),
  issueId: uuid.optional(),
  doi: doiField,
  finalPdfFileId: uuid.optional(),
  certificateFileId: uuid.optional(),
  volume: optionalText(20),
  issueNumber: optionalText(20),
  pageStart: optionalText(20),
  pageEnd: optionalText(20),
  pages: optionalText(50),
  keywords: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  abstract: optionalText(20000),
  licenseName: optionalText(200),
  licenseUrl: optionalText(500),
  copyrightHolder: optionalText(200),
  publicationDate: optionalDate,
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

function publicationContentType(value: string): "research" | "creative" | "commentary" {
  if (/creative|poetry|fiction|literature/i.test(value)) return "creative";
  if (/commentary|essay|opinion/i.test(value)) return "commentary";
  return "research";
}

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

type PromotedAuthor = {
  name: string;
  orcid?: string | null;
  affiliation?: string | null;
  credentials?: string | null;
  corresponding?: boolean;
};

type SubmissionAuthorDetail = {
  firstName?: string | null;
  middleInitial?: string | null;
  surname?: string | null;
  name?: string | null;
  orcid?: string | null;
  affiliation?: string | null;
  institution?: string | null;
  academicTitle?: string | null;
};

function authorSlug(name: string) {
  return name.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "author";
}

function composeAuthorName(detail: SubmissionAuthorDetail, fallback: string) {
  const firstName = detail.firstName?.trim() || "";
  const middle = detail.middleInitial?.trim() ? `${detail.middleInitial.trim()}.` : "";
  const surname = detail.surname?.trim() || "";
  const given = [firstName, middle].filter(Boolean).join(" ");
  if (surname && given) return `${surname}, ${given}`;
  if (surname) return surname;
  if (given) return given;
  return detail.name?.trim() || fallback;
}

async function resolveAuthorsFromSubmission(admin: AdminClient, submissionId: string, fallbackName: string): Promise<PromotedAuthor[]> {
  const { data: submissionRow } = await admin.from("submissions").select("author_details").eq("id", submissionId).maybeSingle();
  const rawDetails = (submissionRow?.author_details as unknown as SubmissionAuthorDetail[] | null) || [];
  const details = Array.isArray(rawDetails) ? rawDetails : [];
  if (details.length) {
    return details
      .map((detail, index) => ({
        name: composeAuthorName(detail, fallbackName),
        orcid: detail.orcid || null,
        affiliation: detail.affiliation || detail.institution || null,
        credentials: detail.academicTitle || null,
        corresponding: index === 0
      }))
      .filter((author) => author.name.trim().length > 0);
  }
  const { data: rows } = await admin
    .from("submission_authors")
    .select("first_name, middle_initial, surname, institution, orcid, academic_title")
    .eq("submission_id", submissionId)
    .order("position");
  if (rows?.length) {
    return rows
      .map((row, index) => ({
        name: composeAuthorName({ firstName: row.first_name, middleInitial: row.middle_initial, surname: row.surname }, fallbackName),
        orcid: row.orcid || null,
        affiliation: row.institution || null,
        credentials: row.academic_title || null,
        corresponding: index === 0
      }))
      .filter((author) => author.name.trim().length > 0);
  }
  return fallbackName.trim() ? [{ name: fallbackName.trim(), corresponding: true }] : [];
}

async function syncPublicationAuthors(admin: AdminClient, publicationId: string, authors: PromotedAuthor[]) {
  const candidates = authors.filter((author) => author.name.trim().length > 0);
  if (!candidates.length) return;
  const linked: Array<{ id: string; corresponding: boolean }> = [];
  const seen = new Set<string>();
  for (const author of candidates) {
    const baseSlug = authorSlug(author.name);
    let existing: { id: string } | null = null;
    if (author.orcid) {
      const { data } = await admin.from("authors").select("id").eq("orcid", author.orcid).limit(1).maybeSingle();
      existing = data;
    }
    if (!existing) {
      const { data } = await admin.from("authors").select("id").eq("slug", baseSlug).limit(1).maybeSingle();
      existing = data;
    }
    let authorId: string;
    if (existing) {
      authorId = existing.id;
      const patch: Record<string, unknown> = {};
      if (author.orcid) patch.orcid = author.orcid;
      if (author.affiliation) patch.affiliation = author.affiliation;
      if (author.credentials) patch.credentials = author.credentials;
      if (Object.keys(patch).length) await admin.from("authors").update(patch).eq("id", authorId);
    } else {
      let created: { id: string } | null = null;
      for (let attempt = 0; attempt < 50 && !created; attempt += 1) {
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
        const { data, error } = await admin
          .from("authors")
          .insert({ name: author.name, slug, orcid: author.orcid || null, affiliation: author.affiliation || null, credentials: author.credentials || null, bio: "", status: "published" })
          .select("id")
          .maybeSingle();
        if (!error && data) created = data;
      }
      if (!created) throw new Error("An author profile could not be created.");
      authorId = created.id;
    }
    if (seen.has(authorId)) continue;
    seen.add(authorId);
    linked.push({ id: authorId, corresponding: Boolean(author.corresponding) });
  }
  const { error: clearError } = await admin.from("publication_authors").delete().eq("publication_id", publicationId);
  if (clearError) throw new Error("The author links could not be refreshed.");
  let position = 0;
  for (const link of linked) {
    position += 1;
    const { error } = await admin.from("publication_authors").insert({ publication_id: publicationId, author_id: link.id, position, corresponding: link.corresponding });
    if (error) throw new Error("The author links could not be saved.");
  }
}

const STAGE_PATH: WorkflowStage[] = [
  "review_new", "review_in_progress", "review_final", "review_accepted",
  "production_ready", "production_preparation", "production_proof", "production_records",
  "production_ready_to_publish", "production_scheduled", "published"
];

async function emitProgressActivity(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  submissionId: string,
  activities: ProgressActivity[],
  actorType: string,
  actorId: string,
  batchLabel: string
) {
  const { data: existing } = await admin
    .from("workflow_events")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("event_type", "progress_activity")
    .eq("metadata->>batch", batchLabel)
    .limit(1);
  if (existing && existing.length > 0) return;

  for (let i = 0; i < activities.length; i++) {
    await admin.from("workflow_events").insert({
      submission_id: submissionId,
      event_type: "progress_activity",
      internal_title: activities[i].title,
      internal_description: activities[i].description,
      public_title: activities[i].title,
      public_description: activities[i].description,
      visibility: "author",
      actor_type: actorType,
      actor_id: actorId,
      metadata: { batch: batchLabel, batch_index: i }
    });
  }
}

export async function transitionSubmission(input: z.input<typeof transitionInput>) {
  const parsed = transitionInput.parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { data: before } = await admin.from("submissions").select("current_stage").eq("id", parsed.submissionId).maybeSingle();
  const fromProgress = before ? progressIndexOf(before.current_stage as WorkflowStage) : -1;

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

  if (!parsed.silent) {
    const toProgress = progressIndexOf(parsed.toStage);
    if (fromProgress >= 0 && toProgress >= 0 && toProgress > fromProgress) {
      const activities = progressBoundary(fromProgress, toProgress);
      if (activities.length) await emitProgressActivity(admin, parsed.submissionId, activities, user.role, user.id, `boundary_${fromProgress}_${toProgress}`);
    }

    if (parsed.toStage === "production_scheduled" && before?.current_stage === "production_ready_to_publish") {
      await emitProgressActivity(admin, parsed.submissionId, [SCHEDULE_FIRST], user.role, user.id, "schedule_first");
    }
  }

  refreshWorkflowPages(parsed.submissionId);
  return data;
}

const advanceInput = z.object({
  submissionId: uuid,
  targetProgress: z.number().int().min(0).max(4),
  silent: z.boolean().default(false)
});

export async function advanceSubmissionProgress(input: z.input<typeof advanceInput>) {
  const parsed = advanceInput.parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { data: submission } = await admin.from("submissions").select("current_stage").eq("id", parsed.submissionId).maybeSingle();
  if (!submission) throw new Error("Submission not found.");

  const currentStage = submission.current_stage as WorkflowStage;
  const currentProgress = progressIndexOf(currentStage);
  if (currentProgress >= parsed.targetProgress) return { stage: currentStage, progress: currentProgress };

  const targetStage = canonicalStageForProgress(parsed.targetProgress);
  const currentIdx = STAGE_PATH.indexOf(currentStage);
  const targetIdx = STAGE_PATH.indexOf(targetStage);
  if (currentIdx < 0 || targetIdx < 0 || targetIdx <= currentIdx) throw new Error("Cannot compute advance path.");

  let lastStage = currentStage;
  let lastProgress = currentProgress;

  for (let i = currentIdx + 1; i <= targetIdx; i++) {
    const nextStage = STAGE_PATH[i];
    const { error } = await admin.rpc("transition_submission", {
      p_submission_id: parsed.submissionId,
      p_to_stage: nextStage,
      p_actor_id: user.id,
      p_internal_title: "",
      p_internal_description: "",
      p_public_title: null,
      p_public_description: null,
      p_visibility: "internal",
      p_metadata: {}
    });
    if (error) {
      return { stage: lastStage, progress: lastProgress, blocked: workflowFailure(error), blockedAt: nextStage };
    }
    if (!parsed.silent) {
      const nextProgress = progressIndexOf(nextStage);
      if (nextProgress > lastProgress) {
        const activities = progressBoundary(lastProgress, nextProgress);
        if (activities.length) await emitProgressActivity(admin, parsed.submissionId, activities, user.role, user.id, `advance_${lastProgress}_${nextProgress}`);
      }
      if (nextStage === "production_scheduled" && lastProgress < 3) {
        await emitProgressActivity(admin, parsed.submissionId, [SCHEDULE_FIRST], user.role, user.id, "schedule_first");
      }
    }
    lastStage = nextStage;
    lastProgress = progressIndexOf(nextStage);
  }

  refreshWorkflowPages(parsed.submissionId);
  return { stage: lastStage, progress: lastProgress };
}

const priorityInput = z.object({
  submissionId: uuid,
  priority: z.enum(["normal", "high", "urgent"])
});

export async function setSubmissionPriority(input: z.input<typeof priorityInput>) {
  const parsed = priorityInput.parse(input);
  await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { error } = await admin.from("submissions").update({ priority: parsed.priority }).eq("id", parsed.submissionId);
  if (error) throw new Error("The priority could not be updated.");
  refreshWorkflowPages(parsed.submissionId);
}

const rescheduleInput = z.object({
  submissionId: uuid,
  scheduledFor: z.string().datetime()
});

export async function rescheduleSubmission(input: z.input<typeof rescheduleInput>) {
  const parsed = rescheduleInput.parse(input);
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { error } = await admin.from("publication_records").update({ scheduled_for: parsed.scheduledFor }).eq("submission_id", parsed.submissionId);
  if (error) throw new Error("The schedule could not be updated.");

  await emitProgressActivity(admin, parsed.submissionId, [SCHEDULE_UPDATED], user.role, user.id, "reschedule");
  refreshWorkflowPages(parsed.submissionId);
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
    .select("id, title, abstract, author_name, publication_type, current_stage, preferred_journal_id, assigned_issue_id, volume_snapshot, issue_snapshot")
    .eq("id", parsed.submissionId)
    .maybeSingle();
  if (submissionError || !submission) throw new Error("The submission record could not be found.");
  if (!(String(submission.current_stage) as WorkflowStage).startsWith("production_")) {
    throw new Error("Publication records can only be prepared after acceptance.");
  }

  const resolvedJournalId = parsed.journalId || submission.preferred_journal_id || undefined;
  const resolvedIssueId = parsed.issueId || submission.assigned_issue_id || undefined;
  if (parsed.issueId && !resolvedJournalId) throw new Error("Choose the journal before assigning an issue.");
  if (resolvedIssueId && resolvedJournalId) {
    const { data: issue } = await admin.from("issues").select("journal_id,volume,issue_number").eq("id", resolvedIssueId).maybeSingle();
    if (!issue || issue.journal_id !== resolvedJournalId) throw new Error("The selected issue does not belong to the selected journal.");
    if (parsed.volume && parsed.volume !== issue.volume) throw new Error("The volume must match the selected issue.");
    if (parsed.issueNumber && parsed.issueNumber !== issue.issue_number) throw new Error("The issue number must match the selected issue.");
  }

  let publicationId: string | null = null;
  let publicArticleUrl: string | null = null;
  let citationData: Record<string, unknown> = parsed.citationData;
  if (resolvedJournalId) {
    const { data: existingPublications } = await admin.from("publications").select("id, slug").eq("source_submission_id", parsed.submissionId).limit(1);
    const existingPublication = existingPublications?.[0];
    const { data: submittedAuthors } = await admin.from("submission_authors").select("position, first_name, middle_initial, surname").eq("submission_id", parsed.submissionId).order("position");
    const authorDisplay = (submittedAuthors || []).map((author) => [author.first_name, author.middle_initial, author.surname].filter(Boolean).join(" ")).join("; ") || submission.author_name;
    const { data: journal } = await admin.from("journals").select("title").eq("id", resolvedJournalId).maybeSingle();
    const { data: citationIssue } = resolvedIssueId ? await admin.from("issues").select("volume, issue_number").eq("id", resolvedIssueId).maybeSingle() : { data: null };
    const resolvedVolume = citationIssue?.volume || parsed.volume || submission.volume_snapshot || null;
    const resolvedIssueNumber = citationIssue?.issue_number || parsed.issueNumber || submission.issue_snapshot || null;
    const resolvedPages = parsed.pages || (parsed.pageStart ? [parsed.pageStart, parsed.pageEnd].filter(Boolean).join("-") : null);
    const resolvedAbstract = parsed.abstract || submission.abstract || "";
    const citationAuthors = (submittedAuthors || []).map((author) => [author.first_name, author.middle_initial, author.surname].filter(Boolean).join(" ")).filter(Boolean);
    citationData = createApa7JournalCitation({ authors: citationAuthors.length ? citationAuthors : [submission.author_name], title: submission.title, year: new Date().getFullYear(), journalTitle: journal?.title || "", volume: resolvedVolume, issue: resolvedIssueNumber, pages: resolvedPages, doi: parsed.doi });
    const slug = existingPublication?.slug || publicationSlug(submission.title, submission.id);
    const pdfUrl = new URL(`/api/publications/${slug}/pdf`, `${getSiteUrl()}/`).toString();

    const sharedColumns = {
      journal_id: resolvedJournalId,
      issue_id: resolvedIssueId || null,
      title: submission.title,
      abstract: resolvedAbstract,
      author_display: authorDisplay,
      doi: parsed.doi || null,
      pdf_url: pdfUrl,
      recommended_citation: String(citationData.formatted_citation || ""),
      content_type: publicationContentType(String((submission as { publication_type?: string }).publication_type || "")),
      volume: resolvedVolume,
      issue_number: resolvedIssueNumber,
      pages: resolvedPages,
      keywords: parsed.keywords || [],
      license_name: parsed.licenseName || "All rights reserved",
      license_url: parsed.licenseUrl || null,
      copyright_holder: parsed.copyrightHolder || "The authors",
      publication_date: parsed.publicationDate || null
    };

    if (existingPublication) {
      const { data: updated, error: updateError } = await admin.from("publications").update(sharedColumns).eq("id", existingPublication.id).select("id, slug").single();
      if (updateError || !updated) throw new Error("The public publication record could not be updated.");
      publicationId = updated.id;
      publicArticleUrl = new URL(`/publications/${updated.slug}`, `${getSiteUrl()}/`).toString();
    } else {
      const { data: created, error: createError } = await admin.from("publications").insert({ ...sharedColumns, source_submission_id: parsed.submissionId, slug, status: "draft" }).select("id, slug").single();
      if (createError || !created) throw new Error("The public publication record could not be created.");
      publicationId = created.id;
      publicArticleUrl = new URL(`/publications/${created.slug}`, `${getSiteUrl()}/`).toString();
    }

    const promotedAuthors = await resolveAuthorsFromSubmission(admin, parsed.submissionId, submission.author_name);
    if (publicationId) await syncPublicationAuthors(admin, publicationId, promotedAuthors);
  }

  const { error } = await admin.from("publication_records").upsert({
    submission_id: parsed.submissionId,
    publication_id: publicationId,
    journal_id: resolvedJournalId || null,
    issue_id: resolvedIssueId || null,
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
    metadata: { doi: parsed.doi || null, issue_id: resolvedIssueId || null }
  });

  if (submission.current_stage === "published") {
    await emitProgressActivity(admin, parsed.submissionId, [POST_PUBLISH_INFO], user.role, user.id, "post_publish_info");
  }

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
  if (user.role !== "admin") throw new Error("Only an administrator can confirm a payment.");
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");

  const { data: beforeSub } = await admin.from("submissions").select("current_stage").eq("id", parsed.submissionId).maybeSingle();
  const wasAtNew = beforeSub?.current_stage === "review_new";

  const { data: payment, error } = await admin.rpc("confirm_payment_and_start_review", {
    p_submission_id: parsed.submissionId,
    p_payment_id: parsed.paymentId,
    p_actor_id: user.id
  });
  if (error) throw new Error(workflowFailure(error));
  if (!payment) throw new Error("The payment could not be confirmed.");

  if (wasAtNew) {
    const activities = progressBoundary(0, 1);
    if (activities.length) await emitProgressActivity(admin, parsed.submissionId, activities, user.role, user.id, "payment_boundary_0_1");
  }

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
