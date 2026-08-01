import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { CERTIFICATE_ASSET_BUCKET, loadCertificateTemplate } from "@/lib/certificate-editor";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function dimensions(bytes: Uint8Array, mime: string) {
  if (mime === "image/png" && bytes.length >= 24) return { width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) };
  if (mime === "image/jpeg") {
    for (let index = 2; index + 9 < bytes.length;) {
      if (bytes[index] !== 0xff) { index++; continue; }
      const marker = bytes[index + 1]; const length = (bytes[index + 2] << 8) + bytes[index + 3];
      if (marker >= 0xc0 && marker <= 0xc3) return { height: (bytes[index + 5] << 8) + bytes[index + 6], width: (bytes[index + 7] << 8) + bytes[index + 8] };
      index += 2 + length;
    }
  }
  throw new Error("The image dimensions could not be read.");
}

export async function POST(request: Request, { params }: { params: Promise<{ templateId: string; pageId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try {
    const form = await request.formData(); const image = form.get("image");
    if (!(image instanceof File) || !["image/png", "image/jpeg"].includes(image.type) || image.size > 10 * 1024 * 1024) throw new Error("Upload a PNG or JPEG image no larger than 10 MB.");
    const { templateId, pageId } = await params;
    const page = await admin.from("certificate_template_pages").select("id").eq("id", pageId).eq("template_id", templateId).maybeSingle();
    if (page.error || !page.data) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    const bytes = new Uint8Array(await image.arrayBuffer()); const size = dimensions(bytes, image.type);
    if (!size.width || !size.height || size.width > 20000 || size.height > 20000) throw new Error("The image dimensions are not supported.");
    const extension = image.type === "image/png" ? "png" : "jpg"; const path = `templates/${templateId}/pages/${pageId}-${crypto.randomUUID()}.${extension}`;
    const upload = await admin.storage.from(CERTIFICATE_ASSET_BUCKET).upload(path, bytes, { contentType: image.type, upsert: false }); if (upload.error) throw new Error(upload.error.message);
    const saved = await admin.from("certificate_template_pages").update({ background_bucket: CERTIFICATE_ASSET_BUCKET, background_path: path, background_mime_type: image.type, background_original_name: image.name, width: size.width, height: size.height }).eq("id", pageId);
    if (saved.error) throw new Error(saved.error.message);
    const template = await loadCertificateTemplate(admin, templateId); return NextResponse.json({ template, pageId });
  } catch (error) { return apiErrorResponse(error, "Could not upload the page background."); }
}

export async function GET(_: Request, { params }: { params: Promise<{ templateId: string; pageId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try {
    const { templateId, pageId } = await params;
    const result = await admin.from("certificate_template_pages").select("background_bucket,background_path").eq("id", pageId).eq("template_id", templateId).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.background_path) return NextResponse.json({ pageId, url: null }, { status: 404 });
    const signed = await admin.storage.from(result.data.background_bucket || CERTIFICATE_ASSET_BUCKET).createSignedUrl(result.data.background_path, 60 * 60);
    if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || "Could not refresh the background URL.");
    return NextResponse.json({ pageId, url: signed.data.signedUrl });
  } catch (error) { return apiErrorResponse(error, "Could not refresh the page background."); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ templateId: string; pageId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try {
    const { templateId, pageId } = await params;
    const page = await admin.from("certificate_template_pages").select("background_bucket,background_path").eq("id", pageId).eq("template_id", templateId).maybeSingle();
    if (page.error || !page.data) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    const cleared = await admin.from("certificate_template_pages").update({ background_bucket: null, background_path: null, background_mime_type: null, background_original_name: null }).eq("id", pageId);
    if (cleared.error) throw new Error(cleared.error.message);
    if (page.data.background_path) {
      await admin.storage.from(page.data.background_bucket || CERTIFICATE_ASSET_BUCKET).remove([page.data.background_path]);
    }
    const template = await loadCertificateTemplate(admin, templateId);
    return NextResponse.json({ template, pageId });
  } catch (error) { return apiErrorResponse(error, "Could not remove the page background."); }
}
