import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { renderCertificatePdf } from "@/lib/render-certificate";

export async function POST(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try {
    const recordId = (await params).recordId;
    const recordResult = await admin.from("certificate_records").select("id,template_id,publication_id,submission_id,field_values,layout_overrides,status,certificate_number").eq("id", recordId).single();
    if (recordResult.error || !recordResult.data) return NextResponse.json({ error: "Certificate record not found." }, { status: 404 });
    if (recordResult.data.status === "issued") return NextResponse.json({ error: "This certificate is already issued and immutable." }, { status: 409 });
    const required = ["author_name", "work_title", "certificate_number"];
    const values = (recordResult.data.field_values || {}) as Record<string, unknown>;
    if (required.some((key) => !String(values[key] || "").trim())) return NextResponse.json({ error: "Complete the author, work title, and certificate number before issuing." }, { status: 400 });
    const importWarnings = Array.isArray(values._import_warnings) ? values._import_warnings.filter((warning) => typeof warning === "string" && warning.trim()) : [];
    if (importWarnings.length) return NextResponse.json({ error: "Resolve the imported author-data warning before issuing.", warnings: importWarnings }, { status: 422 });
    const [templateResult, pagesResult, fontsResult] = await Promise.all([
      admin.from("certificate_templates").select("background_bucket,background_path").eq("id", recordResult.data.template_id).single(),
      admin.from("certificate_template_pages").select("id,page_number,width,height,background_bucket,background_path,background_mime_type").eq("template_id", recordResult.data.template_id).order("page_number"),
      admin.from("certificate_fonts").select("family,weight,storage_bucket,storage_path").eq("active", true).eq("embedding_allowed", true),
    ]);
    if (templateResult.error || pagesResult.error || fontsResult.error || pagesResult.data.length !== 6) throw new Error(templateResult.error?.message || pagesResult.error?.message || fontsResult.error?.message || "The certificate template must have six pages.");
    const pageNumbers = new Map(pagesResult.data.map((page) => [page.id, page.page_number]));
    const blocksResult = await admin.from("certificate_text_blocks").select("id,page_id,content,x,y,width,height,rotation,z_index,style,overflow_behavior,locked,block_type,asset_bucket,asset_path").in("page_id", pagesResult.data.map((page) => page.id));
    if (blocksResult.error) throw new Error(blocksResult.error.message);
    const blocks = (blocksResult.data || []).map((block) => ({ id: block.id, pageId: block.page_id, pageNumber: pageNumbers.get(block.page_id), content: block.content, x: Number(block.x), y: Number(block.y), width: Number(block.width), height: Number(block.height), rotation: Number(block.rotation), zIndex: block.z_index, style: block.style || {}, overflowBehavior: block.overflow_behavior, locked: block.locked, blockType: block.block_type, assetBucket: block.asset_bucket, assetPath: block.asset_path }));
    const { pdfBytes, warnings } = await renderCertificatePdf({ admin, template: templateResult.data, values, blocks, customFonts: fontsResult.data || [], pages: pagesResult.data.map((page) => ({ pageNumber: page.page_number, width: Number(page.width), height: Number(page.height), backgroundBucket: page.background_bucket, backgroundPath: page.background_path, backgroundMimeType: page.background_mime_type })), recordId });
    if (warnings.length) return NextResponse.json({ error: "The certificate has layout warnings and was not issued.", warnings }, { status: 422 });
    const latest = await admin.from("certificate_output_versions").select("version_number").eq("certificate_record_id", recordId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    if (latest.error) throw new Error(latest.error.message);
    const versionNumber = (latest.data?.version_number || 0) + 1; const pdfPath = `outputs/${recordId}/${versionNumber}-${randomUUID()}.pdf`;
    const upload = await admin.storage.from("certificate-assets").upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false }); if (upload.error) throw new Error(upload.error.message);
    const output = await admin.from("certificate_output_versions").insert({ certificate_record_id: recordId, version_number: versionNumber, field_values: values, layout_overrides: { ...(recordResult.data.layout_overrides || {}), issued_template_pages: pagesResult.data, issued_blocks: blocks }, pdf_path: pdfPath, created_by: user.id });
    if (output.error) throw new Error(output.error.message);
    const issued = await admin.from("certificate_records").update({ status: "issued", issued_at: new Date().toISOString(), issued_by: user.id }).eq("id", recordId); if (issued.error) throw new Error(issued.error.message);

    let certificateFileId: string | null = null;
    let previewFileId: string | null = null;
    if (recordResult.data.submission_id) {
      const submissionId = recordResult.data.submission_id;
      const { data: officialPdf, error: downloadError } = await admin.storage.from("certificate-assets").download(pdfPath);
      if (downloadError || !officialPdf) throw new Error(downloadError?.message || "Could not retrieve the issued certificate PDF.");
      const pdfName = `certificate-${recordResult.data.certificate_number}.pdf`;
      const storedPdfPath = `${submissionId}/publication_certificate/${randomUUID()}-${pdfName}`;
      const { error: certificateUploadError } = await admin.storage.from("certificates").upload(storedPdfPath, officialPdf, { contentType: "application/pdf", upsert: false });
      if (certificateUploadError) throw new Error(certificateUploadError.message);
      const { data: certificateFile, error: certificateFileError } = await admin.from("submission_files").insert({
        submission_id: submissionId, file_kind: "publication_certificate", storage_bucket: "certificates", storage_path: storedPdfPath,
        original_name: pdfName, mime_type: "application/pdf", size_bytes: officialPdf.size
      }).select("id").single();
      if (certificateFileError || !certificateFile) throw new Error(certificateFileError?.message || "Could not attach the certificate to the manuscript.");
      certificateFileId = certificateFile.id;

      const form = await request.formData().catch(() => null);
      const preview = form?.get("preview");
      if (preview instanceof File && preview.size > 0) {
        if (!['image/png', 'image/jpeg'].includes(preview.type) || preview.size > 10 * 1024 * 1024) throw new Error("The certificate preview must be a PNG or JPEG no larger than 10 MB.");
        const extension = preview.type === "image/png" ? "png" : "jpg";
        const previewName = `certificate-${recordResult.data.certificate_number}-preview.${extension}`;
        const previewPath = `${submissionId}/certificate_preview/${randomUUID()}-${previewName}`;
        const { error: previewUploadError } = await admin.storage.from("certificates").upload(previewPath, new Uint8Array(await preview.arrayBuffer()), { contentType: preview.type, upsert: false });
        if (previewUploadError) throw new Error(previewUploadError.message);
        const { data: previewFile, error: previewFileError } = await admin.from("submission_files").insert({
          submission_id: submissionId, file_kind: "certificate_preview", storage_bucket: "certificates", storage_path: previewPath,
          original_name: previewName, mime_type: preview.type, size_bytes: preview.size
        }).select("id").single();
        if (previewFileError || !previewFile) throw new Error(previewFileError?.message || "Could not attach the certificate preview.");
        previewFileId = previewFile.id;
        await admin.from("certificate_output_versions").update({ preview_path: previewPath }).eq("certificate_record_id", recordId).eq("version_number", versionNumber);
      }
      const { error: publicationUpdateError } = await admin.from("publication_records").update({ certificate_file_id: certificateFileId }).eq("submission_id", submissionId);
      if (publicationUpdateError) throw new Error(publicationUpdateError.message);
      await admin.from("workflow_events").insert({
        submission_id: submissionId, event_type: "publication_certificate_attached", internal_title: "Publication certificate attached",
        internal_description: "The issued certificate PDF and its preview were attached to this manuscript record.", visibility: "internal",
        actor_type: user.role, actor_id: user.id, metadata: { certificate_record_id: recordId, certificate_file_id: certificateFileId, preview_file_id: previewFileId }
      });
    }
    return NextResponse.json({ issued: true, versionNumber, certificateFileId, previewFileId, submissionId: recordResult.data.submission_id });
  } catch (error) { return apiErrorResponse(error, "Could not issue the certificate."); }
}
