import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const fileKinds = new Set([
  "production_manuscript",
  "author_proof",
  "editorial_comment",
  "final_pdf",
  "author_certificate",
  "publication_certificate"
]);

const allowedDocumentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function safeName(name: string) {
  const clean = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[.-]+/, "").slice(-140);
  return clean || "document";
}

function redirectToRecord(request: Request, submissionId: string, key: "workflowError" | "workflowSuccess", message: string) {
  const url = new URL(`/admin/submissions/${submissionId}?tab=files`, request.url);
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Cross-site file upload is not allowed." }, { status: 403 });
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const submissionId = String(form?.get("submissionId") || "").trim();
  const fileKind = String(form?.get("fileKind") || "").trim();
  const upload = form?.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !fileKinds.has(fileKind) || !(upload instanceof File)) return redirectToRecord(request, submissionId || "unknown", "workflowError", "Choose a valid document and file type.");
  if (!upload.size || upload.size > 15 * 1024 * 1024 || !allowedDocumentTypes.has(upload.type)) return redirectToRecord(request, submissionId, "workflowError", "Upload a PDF, Word, or DOCX document no larger than 15 MB.");
  if (["final_pdf", "author_certificate", "publication_certificate"].includes(fileKind) && upload.type !== "application/pdf") return redirectToRecord(request, submissionId, "workflowError", "Final PDFs and certificates must be uploaded as PDF files.");

  const bucket = fileKind === "author_proof" ? "submission-proofs" : fileKind.includes("certificate") ? "certificates" : "submission-files";
  const path = `${submissionId}/${fileKind}/${randomUUID()}-${safeName(upload.name)}`;
  const bytes = Buffer.from(await upload.arrayBuffer());
  const { error: storageError } = await admin.storage.from(bucket).upload(path, bytes, { contentType: upload.type, upsert: false });
  if (storageError) return redirectToRecord(request, submissionId, "workflowError", "The file could not be stored securely. Please try again.");

  const { data: file, error: recordError } = await admin.from("submission_files").insert({
    submission_id: submissionId,
    file_kind: fileKind,
    storage_bucket: bucket,
    storage_path: path,
    original_name: safeName(upload.name),
    mime_type: upload.type,
    size_bytes: upload.size
  }).select("id").single();
  if (recordError || !file) {
    await admin.storage.from(bucket).remove([path]);
    return redirectToRecord(request, submissionId, "workflowError", "The file was stored but could not be attached to the submission. Please try again.");
  }

  await admin.from("workflow_events").insert({
    submission_id: submissionId,
    event_type: "file_attached",
    internal_title: "Production file attached",
    internal_description: `${safeName(upload.name)} was attached as ${fileKind.replaceAll("_", " ")}.`,
    visibility: "internal",
    actor_type: user.role,
    actor_id: user.id,
    metadata: { file_id: file.id, file_kind: fileKind, storage_bucket: bucket }
  });

  return redirectToRecord(request, submissionId, "workflowSuccess", "Production file attached.");
}
