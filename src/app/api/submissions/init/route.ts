import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { submissionInitSchema } from "@/lib/submission";
import { isSubmissionsEnabled } from "@/lib/launch";
import { allowRequest, getRequestRateLimitKey } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { synchronizeJournalLifecycles } from "@/lib/journal-lifecycle";

const MAX_INIT_BODY_BYTES = 32 * 1024;

function safeName(name: string) {
  const sanitized = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-140);
  return sanitized || "file";
}

async function createUploadInstructions(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, submissionId: string, files: Array<{ key: string; field: "manuscript" | "authorPhoto" | "paymentProof"; name: string }>) {
  const uploads = [];
  for (const file of files) {
    const path = `${submissionId}/${file.field}/${randomUUID()}-${safeName(file.name)}`;
    const { data, error: uploadError } = await admin.storage.from("submission-files").createSignedUploadUrl(path, { upsert: false });
    if (uploadError || !data?.token) return null;
    uploads.push({ key: file.key, field: file.field, path, token: data.token });
  }
  return uploads;
}

export async function POST(request: NextRequest) {
  if (!isSubmissionsEnabled()) return NextResponse.json({ error: "Public submissions are currently closed." }, { status: 503 });
  const ip = getRequestRateLimitKey(request.headers);
  if (!await allowRequest(`submission:${ip}`)) return NextResponse.json({ error: "Too many submission attempts. Please wait before trying again." }, { status: 429 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Secure submissions are not configured yet." }, { status: 503 });
  await synchronizeJournalLifecycles(admin);
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_INIT_BODY_BYTES) return NextResponse.json({ error: "Submission details are too large." }, { status: 413 });
  const parsed = submissionInitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please review the submission fields." }, { status: 400 });
  const input = parsed.data;
  if (input.website) return NextResponse.json({ error: "Submission rejected." }, { status: 400 });
  if (process.env.TURNSTILE_SECRET_KEY?.trim() && !(await verifyTurnstileToken(input.turnstileToken, ip))) {
    return NextResponse.json({ error: "The security check expired or could not be verified. Please try again." }, { status: 400 });
  }
  const { data: journal } = await admin
    .from("journals")
    .select("id, title, slug, current_issue_id, submission_issue_id")
    .eq("id", input.journalId)
    .eq("slug", input.preferredJournal)
    .maybeSingle();
  if (!journal || journal.submission_issue_id !== input.issueId) {
    return NextResponse.json({ error: "That journal's submission target has changed. Refresh the form and choose it again." }, { status: 409 });
  }
  const { data: issue } = await admin
    .from("issues")
    .select("id, journal_id, volume, issue_number, editorial_metadata, status")
    .eq("id", input.issueId)
    .maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const issueMetadata = issue?.editorial_metadata && typeof issue.editorial_metadata === "object" ? issue.editorial_metadata as { submissionDeadline?: string } : {};
  if (!issue || issue.journal_id !== journal.id || issue.status === "archived" || (issueMetadata.submissionDeadline && issueMetadata.submissionDeadline < today)) {
    return NextResponse.json({ error: "That issue is no longer accepting submissions. Please refresh the form." }, { status: 409 });
  }
  const { data: existing } = await admin
    .from("submissions")
    .select("id, reference, status")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) {
    if (existing.status === "submitted") return NextResponse.json({ error: "This submission attempt has already been completed." }, { status: 409 });
    if (existing.status !== "uploading") return NextResponse.json({ error: "This submission attempt can no longer be resumed." }, { status: 409 });
    const uploads = await createUploadInstructions(admin, existing.id, input.files);
    if (!uploads) return NextResponse.json({ error: "Could not prepare private file storage." }, { status: 500 });
    return NextResponse.json({ submissionId: existing.id, reference: existing.reference, uploads }, { status: 200 });
  }
  const reference = `TAL-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data: submission, error } = await admin.from("submissions").insert({ idempotency_key: input.idempotencyKey, reference, title: input.workingTitle, publication_type: input.publicationType, preferred_journal_id: journal.id, assigned_issue_id: issue.id, journal_title_snapshot: journal.title, volume_snapshot: issue.volume, issue_snapshot: issue.issue_number, abstract: "", author_name: input.authorName, author_email: input.authorEmail, affiliation: input.affiliation || null, phone: input.phone || null, author_notes: input.notes || null, author_details: input.authorDetails, status: "uploading", consent_at: new Date().toISOString(), source_ip_hash: null }).select("id").single();
  if (error || !submission) return NextResponse.json({ error: "Could not create the protected submission record." }, { status: 500 });

  const { error: paymentError } = await admin.from("payments").insert({
    submission_id: submission.id,
    payment_reference: input.paymentReference,
    provider: input.paymentMethod,
    amount: input.paymentTotal ?? 0,
    currency: "PHP",
    status: "pending",
    metadata: {
      publication_plan: input.publicationPlan || null,
      promo_code: input.promoCode || null,
      source: "public_submission"
    }
  });
  if (paymentError) {
    await admin.from("submissions").delete().eq("id", submission.id);
    return NextResponse.json({ error: "Could not create the payment record." }, { status: 500 });
  }

  const uploads = await createUploadInstructions(admin, submission.id, input.files);
  if (!uploads) {
    await admin.from("submissions").update({ status: "upload_failed" }).eq("id", submission.id);
    return NextResponse.json({ error: "Could not prepare private file storage." }, { status: 500 });
  }
  return NextResponse.json({ submissionId: submission.id, reference, uploads }, { status: 201 });
}
