import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSubmissionsEnabled } from "@/lib/launch";
import { submissionCompleteSchema, submissionFileRules, type SubmissionFileField } from "@/lib/submission";
import { allowRequest, getRequestRateLimitKey } from "@/lib/rate-limit";
import { PROGRESS_OPENING } from "@/lib/editorial-workflow";
import { deliverQueuedMessages, ensureSubmissionConfirmations } from "@/lib/email/correspondence";

const MAX_COMPLETE_BODY_BYTES = 8 * 1024;

function confirmationStatus(statuses: string[]) {
  if (!statuses.length) return "not_queued";
  if (statuses.every((status) => status === "sent")) return "sent";
  if (statuses.includes("unknown")) return "unknown";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("sending")) return "sending";
  return "queued";
}

function matchesFileSignature(field: SubmissionFileField, mimetype: string, bytes: Uint8Array) {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const ascii = new TextDecoder("latin1").decode(bytes);
  if (mimetype === "application/pdf") return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return field === "manuscript" && startsWith(0x50, 0x4b, 0x03, 0x04) && ascii.includes("[Content_Types].xml") && ascii.includes("word/document.xml");
  }
  if (mimetype === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (mimetype === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mimetype === "image/webp") return startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return false;
}

function hasExpectedStoragePath(path: string, submissionId: string, field: SubmissionFileField) {
  const [recordId, folder, filename, ...rest] = path.split("/");
  return rest.length === 0 && recordId === submissionId && folder === field && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}-.+$/i.test(filename || "");
}

export async function POST(request: Request) {
  if (!isSubmissionsEnabled()) return NextResponse.json({ error: "Public submissions are currently closed." }, { status: 503 });
  const ip = getRequestRateLimitKey(request.headers);
  if (!await allowRequest(`submission-complete:${ip}`)) return NextResponse.json({ error: "Too many completion attempts. Please wait before trying again." }, { status: 429 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Secure submissions are not configured yet." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_COMPLETE_BODY_BYTES) return NextResponse.json({ error: "Completion details are too large." }, { status: 413 });
  const parsed = submissionCompleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid completion request." }, { status: 400 });
  const { submissionId, uploads } = parsed.data;
  if (uploads.some((upload) => !hasExpectedStoragePath(upload.path, submissionId, upload.field))) return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });

  const { data: pendingSubmission, error: pendingError } = await admin
    .from("submissions")
    .select("reference, status, author_details")
    .eq("id", submissionId)
    .maybeSingle();
  if (pendingError || !pendingSubmission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  if (pendingSubmission.status === "submitted") {
    const { data: messages } = await admin.from("email_messages").select("status").eq("submission_id", submissionId).eq("source", "automated");
    const statuses = (messages || []).map((message) => message.status);
    return NextResponse.json({ reference: pendingSubmission.reference, confirmation: { status: confirmationStatus(statuses), recipientCount: statuses.length } });
  }
  if (pendingSubmission.status !== "uploading") return NextResponse.json({ error: "This submission can no longer be completed." }, { status: 409 });

  const fileRows = [];
  for (const upload of uploads) {
    const segments = upload.path.split("/");
    const filename = segments.at(-1) || "file";
    const folder = segments.slice(0, -1).join("/");
    const { data: objects, error } = await admin.storage.from("submission-files").list(folder, { search: filename, limit: 2 });
    const object = objects?.find((item) => item.name === filename);
    const size = Number(object?.metadata?.size || 0);
    const mimetype = String(object?.metadata?.mimetype || object?.metadata?.contentType || "");
    const rule = submissionFileRules[upload.field];
    if (error || !object || !size || size > rule.max || !(rule.types as readonly string[]).includes(mimetype)) {
      await admin.storage.from("submission-files").remove([upload.path]);
      await admin.from("submissions").update({ status: "upload_failed" }).eq("id", submissionId).eq("status", "uploading");
      return NextResponse.json({ error: `The ${upload.field} upload failed validation.` }, { status: 400 });
    }

    const { data: fileBlob, error: downloadError } = await admin.storage.from("submission-files").download(upload.path);
    const signatureBytes = fileBlob ? new Uint8Array(await fileBlob.arrayBuffer()) : new Uint8Array();
    if (downloadError || !matchesFileSignature(upload.field, mimetype, signatureBytes)) {
      await admin.storage.from("submission-files").remove([upload.path]);
      await admin.from("submissions").update({ status: "upload_failed" }).eq("id", submissionId).eq("status", "uploading");
      return NextResponse.json({ error: `The ${upload.field} upload contents did not match the declared file type.` }, { status: 400 });
    }
    fileRows.push({ submission_id: submissionId, file_kind: upload.field, storage_path: upload.path, original_name: filename.replace(/^[0-9a-f-]{36}-/, ""), mime_type: mimetype, size_bytes: size, sha256: createHash("sha256").update(signatureBytes).digest("hex") });
  }
  const { data: recordedFiles, error: fileError } = await admin.from("submission_files").upsert(fileRows, { onConflict: "storage_path" }).select("id,file_kind,original_name");
  if (fileError || !recordedFiles) return NextResponse.json({ error: "Could not record the uploaded files." }, { status: 500 });
  const sourceManuscript = recordedFiles.find((file) => file.file_kind === "manuscript");
  if (!sourceManuscript) return NextResponse.json({ error: "Could not identify the source manuscript." }, { status: 500 });
  const submittedAuthors = Array.isArray(pendingSubmission.author_details) ? pendingSubmission.author_details.filter((author): author is Record<string, unknown> => Boolean(author && typeof author === "object" && !Array.isArray(author))) : [];
  const authorRows = submittedAuthors.map((author, index) => {
    const position = index + 1;
    const photo = recordedFiles.find((file) => file.file_kind === "authorPhoto" && file.original_name.toLowerCase().startsWith(`author-${String(position).padStart(3, "0")}`));
    return {
      submission_id: submissionId,
      position,
      first_name: String(author.firstName || ""),
      middle_initial: String(author.middleInitial || "") || null,
      surname: String(author.surname || ""),
      position_title: String(author.position || "") || null,
      academic_title: String(author.academicTitle || "") || null,
      email: String(author.email || ""),
      institution: String(author.institution || "") || null,
      affiliation: String(author.affiliation || author.institution || "") || null,
      location: String(author.location || "") || null,
      orcid: String(author.orcid || "") || null,
      photo_file_id: photo?.id || null,
    };
  });
  if (authorRows.length) {
    const { error: authorError } = await admin.from("submission_authors").upsert(authorRows, { onConflict: "submission_id,position" });
    if (authorError) return NextResponse.json({ error: "Could not securely record the submitted author details." }, { status: 500 });
  }
  const { error: pointerError } = await admin.from("submissions").update({ source_manuscript_file_id: sourceManuscript.id }).eq("id", submissionId).eq("status", "uploading");
  if (pointerError) return NextResponse.json({ error: "Could not link the source manuscript to the submission." }, { status: 500 });
  const { data: submission, error } = await admin.from("submissions").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", submissionId).eq("status", "uploading").select("reference").maybeSingle();
  if (error || !submission) return NextResponse.json({ error: "Could not finalize the submission." }, { status: 500 });
  await admin.from("submission_history").insert({ submission_id: submissionId, event_type: "submitted", message: "Submission files validated and record finalized." });

  const openingActivities = PROGRESS_OPENING[0] || [];
  for (let i = 0; i < openingActivities.length; i++) {
    await admin.from("workflow_events").insert({
      submission_id: submissionId,
      event_type: "progress_activity",
      internal_title: openingActivities[i].title,
      internal_description: openingActivities[i].description,
      public_title: openingActivities[i].title,
      public_description: openingActivities[i].description,
      visibility: "author",
      actor_type: "system",
      actor_id: null,
      metadata: { batch: "submission_received", batch_index: i }
    });
  }

  let confirmation: { status: "queued" | "failed"; recipientCount: number } = { status: "failed", recipientCount: 0 };
  try {
    const queued = await ensureSubmissionConfirmations(admin, submissionId);
    confirmation = { status: queued.status, recipientCount: queued.recipientCount };
    after(async () => { await deliverQueuedMessages(admin, queued.messageIds); });
  } catch (emailError) {
    await admin.from("audit_events").insert({ action: "submission_confirmation_queue_failed", entity_type: "submission", entity_id: submissionId, details: { error: emailError instanceof Error ? emailError.message : "Unknown email queue error" } });
  }

  return NextResponse.json({ reference: submission.reference, confirmation });
}
