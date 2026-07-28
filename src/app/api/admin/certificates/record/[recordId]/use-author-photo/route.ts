import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { CERTIFICATE_ASSET_BUCKET } from "@/lib/certificate-editor";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  const { recordId } = await params;
  try {
    const recordResult = await admin.from("certificate_records").select("id,submission_id,author_id,template_id").eq("id", recordId).maybeSingle();
    if (recordResult.error) throw new Error(recordResult.error.message);
    if (!recordResult.data) return NextResponse.json({ error: "Certificate record not found." }, { status: 404 });
    const { submission_id: submissionId, author_id: authorId, template_id: templateId } = recordResult.data;
    if (!submissionId || !authorId) return NextResponse.json({ error: "This certificate is not linked to a submission author." }, { status: 404 });

    const authorsResult = await admin.from("submission_authors").select("id").eq("submission_id", submissionId).order("position");
    if (authorsResult.error) throw new Error(authorsResult.error.message);
    const authorIndex = (authorsResult.data || []).findIndex((a) => a.id === authorId);
    if (authorIndex < 0) return NextResponse.json({ error: "The author could not be matched to this submission." }, { status: 404 });

    const filesResult = await admin.from("submission_files").select("id,original_name,storage_bucket,storage_path,mime_type").eq("submission_id", submissionId).eq("file_kind", "authorPhoto");
    if (filesResult.error) throw new Error(filesResult.error.message);
    const files = filesResult.data || [];
    const expectedName = `author-${String(authorIndex + 1).padStart(3, "0")}`;
    const file = files.find((f) => f.original_name.startsWith(expectedName)) || files[authorIndex] || files[0];
    if (!file) return NextResponse.json({ error: "No author photo was submitted for this author." }, { status: 404 });

    const download = await admin.storage.from(file.storage_bucket).download(file.storage_path);
    if (download.error || !download.data) return NextResponse.json({ error: "The author photo could not be downloaded." }, { status: 404 });
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const ext = file.mime_type === "image/png" ? "png" : "jpg";
    const destPath = `templates/${templateId}/images/${randomUUID()}.${ext}`;
    const upload = await admin.storage.from(CERTIFICATE_ASSET_BUCKET).upload(destPath, bytes, { contentType: file.mime_type || "image/jpeg", upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    const signed = await admin.storage.from(CERTIFICATE_ASSET_BUCKET).createSignedUrl(destPath, 60 * 60);
    if (!signed.data?.signedUrl) throw new Error("Could not sign the uploaded photo.");
    return NextResponse.json({ path: destPath, url: signed.data.signedUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not copy the author photo." }, { status: 500 });
  }
}
