import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { CERTIFICATE_ASSET_BUCKET } from "@/lib/certificate-editor";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try {
    const image = (await request.formData()).get("image");
    if (!(image instanceof File) || !["image/png", "image/jpeg"].includes(image.type) || image.size > 10 * 1024 * 1024) throw new Error("Upload a PNG or JPEG image no larger than 10 MB.");
    const { templateId } = await params;
    const extension = image.type === "image/png" ? "png" : "jpg";
    const path = `templates/${templateId}/images/${crypto.randomUUID()}.${extension}`;
    const upload = await admin.storage.from(CERTIFICATE_ASSET_BUCKET).upload(path, new Uint8Array(await image.arrayBuffer()), { contentType: image.type, upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    const signed = await admin.storage.from(CERTIFICATE_ASSET_BUCKET).createSignedUrl(path, 60 * 30);
    if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || "Could not prepare the image.");
    return NextResponse.json({ bucket: CERTIFICATE_ASSET_BUCKET, path, url: signed.data.signedUrl });
  } catch (error) { return apiErrorResponse(error, "Could not upload the certificate image."); }
}
