import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const fileKinds = new Set([
  "production_manuscript",
  "author_proof",
  "peer_review",
  "editorial_comment",
  "final_pdf",
  "author_certificate",
  "publication_certificate",
  "social_media_artwork",
  "authorPhoto"
]);

const allowedDocumentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function safeName(name: string) {
  const clean = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[.-]+/, "").slice(-140);
  return clean || "document";
}

function respondToRecord(request: Request, submissionId: string, key: "workflowError" | "workflowSuccess", message: string, status = 400) {
  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json(key === "workflowError" ? { error: message } : { message }, { status });
  }
  const url = new URL(`/admin/submissions/${submissionId}?tab=files`, request.url);
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Cross-site file upload is not allowed." }, { status: 403 });
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const submissionId = String(form?.get("submissionId") || "").trim();
  const fileKind = String(form?.get("fileKind") || "").trim();
  const upload = form?.get("file");
  const authorPosition = Number(form?.get("authorPosition") || 0);
  if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !fileKinds.has(fileKind) || !(upload instanceof File)) return respondToRecord(request, submissionId || "unknown", "workflowError", "Choose a valid document and file type.");
  if (fileKind === "authorPhoto" && (!Number.isInteger(authorPosition) || authorPosition < 1 || authorPosition > 12)) return respondToRecord(request, submissionId, "workflowError", "Choose a valid author before uploading a profile photo.");
  const maxSize = fileKind === "authorPhoto" ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
  if (!upload.size || upload.size > maxSize || !allowedDocumentTypes.has(upload.type)) return respondToRecord(request, submissionId, "workflowError", fileKind === "authorPhoto" ? "Upload a JPG or PNG profile photo no larger than 5 MB." : "Upload a supported PDF, Word, JPG, or PNG file no larger than 15 MB.");
  if (fileKind === "authorPhoto" && !["image/jpeg", "image/png"].includes(upload.type)) return respondToRecord(request, submissionId, "workflowError", "Profile photos must be uploaded as JPG or PNG images.");
  if (["final_pdf", "author_certificate", "publication_certificate"].includes(fileKind) && upload.type !== "application/pdf") return respondToRecord(request, submissionId, "workflowError", "Final PDFs and certificates must be uploaded as PDF files.");
  if (fileKind === "social_media_artwork" && !["image/jpeg", "image/png"].includes(upload.type)) return respondToRecord(request, submissionId, "workflowError", "Social-media artwork must be a JPG or PNG image.");

  const bucket = fileKind === "author_proof" ? "submission-proofs" : fileKind.includes("certificate") || fileKind === "social_media_artwork" ? "certificates" : "submission-files";
  const authorPrefix = fileKind === "authorPhoto" ? `author-${String(authorPosition).padStart(3, "0")}-editorial-` : "";
  const originalName = `${authorPrefix}${safeName(upload.name)}`;
  const path = `${submissionId}/${fileKind}/${randomUUID()}-${originalName}`;
  const bytes = Buffer.from(await upload.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let previousQuery = admin
    .from("submission_files")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("file_kind", fileKind);
  if (fileKind === "authorPhoto") previousQuery = previousQuery.like("original_name", `${authorPrefix}%`);
  const { data: previous } = await previousQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
  let countQuery = admin
    .from("submission_files")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId)
    .eq("file_kind", fileKind);
  if (fileKind === "authorPhoto") countQuery = countQuery.like("original_name", `${authorPrefix}%`);
  const { count } = await countQuery;
  const { error: storageError } = await admin.storage.from(bucket).upload(path, bytes, { contentType: upload.type, upsert: false });
  if (storageError) return respondToRecord(request, submissionId, "workflowError", "The file could not be stored securely. Please try again.");

  const { data: file, error: recordError } = await admin.from("submission_files").insert({
    submission_id: submissionId,
    file_kind: fileKind,
    storage_bucket: bucket,
    storage_path: path,
    original_name: originalName,
    mime_type: upload.type,
    size_bytes: upload.size,
    sha256,
    version_number: (count || 0) + 1,
    supersedes_file_id: previous?.id || null,
    validation_status: "pending",
    created_by: user.id
  }).select("id,file_kind,storage_path,storage_bucket,original_name,mime_type,size_bytes,sha256,version_number,supersedes_file_id,validation_status").single();
  if (recordError || !file) {
    await admin.storage.from(bucket).remove([path]);
    return respondToRecord(request, submissionId, "workflowError", "The file was stored but could not be attached to the submission. Please try again.");
  }

  await admin.from("workflow_events").insert({
    submission_id: submissionId,
    event_type: "file_attached",
    internal_title: fileKind === "authorPhoto" ? "Publication author photo updated" : "Production file attached",
    internal_description: `${originalName} was attached as ${fileKind.replaceAll("_", " ")}.`,
    visibility: "internal",
    actor_type: user.role,
    actor_id: user.id,
    metadata: { file_id: file.id, file_kind: fileKind, storage_bucket: bucket, ...(fileKind === "authorPhoto" ? { author_position: authorPosition, supersedes_file_id: previous?.id || null } : {}) }
  });

  if (fileKind === "authorPhoto") {
    const { data: publicationRecord } = await admin.from("publication_records").select("id,metadata").eq("submission_id", submissionId).maybeSingle();
    if (publicationRecord) {
      const metadata = (publicationRecord.metadata as Record<string, unknown>) || {};
      const authorMetadata = Array.isArray(metadata.authorMetadata) ? [...metadata.authorMetadata] as Array<Record<string, unknown>> : [];
      const index = authorPosition - 1;
      authorMetadata[index] = { ...(authorMetadata[index] || {}), position: authorPosition, photoFileId: file.id };
      await admin.from("publication_records").update({ metadata: { ...metadata, authorMetadata } }).eq("id", publicationRecord.id);
    }
  }

  if (["final_pdf", "publication_certificate", "social_media_artwork", "peer_review"].includes(fileKind)) {
    const pointer: Record<string, unknown> = {};
    if (fileKind === "final_pdf") pointer.final_pdf_file_id = file.id;
    if (fileKind === "publication_certificate") pointer.certificate_file_id = file.id;
    const { data: record } = await admin.from("publication_records").select("id,metadata,submitted_preflight_run_id").eq("submission_id", submissionId).maybeSingle();
    if (record) {
      if (fileKind === "social_media_artwork") {
        pointer.metadata = { ...((record.metadata as Record<string, unknown>) || {}), socialMediaFileId: file.id };
      }
      await admin.from("publication_records").update(pointer).eq("id", record.id);
      if (record.submitted_preflight_run_id) {
        const now = new Date().toISOString();
        // New table is added by the publication preflight migration.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("publication_preflight_runs").update({ status: "stale", invalidated_at: now, updated_at: now }).eq("id", record.submitted_preflight_run_id);
        await admin.from("workflow_checklist_items").update({ completed_at: null, completed_by: null }).eq("submission_id", submissionId).in("stage", ["production_records", "production_ready_to_publish"]);
      }
    }
  }

  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ file, message: "Production file attached." }, { status: 201 });
  }
  return respondToRecord(request, submissionId, "workflowSuccess", "Production file attached.", 201);
}
