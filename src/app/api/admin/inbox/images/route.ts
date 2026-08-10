import { NextResponse } from "next/server";
import sharp from "sharp";
import { apiErrorResponse, isApiError, requireAdminApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Email images must be smaller than 5 MB." }, { status: 413 });
    if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
    const source = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.width || !metadata.height) return NextResponse.json({ error: "The selected file is not a valid image." }, { status: 415 });
    const image = await sharp(source, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    const now = new Date();
    const path = `email-assets/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.webp`;
    const { error } = await admin.storage.from("editorial-media").upload(path, image, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (error) throw new Error("The email image could not be uploaded.");
    const { data } = admin.storage.from("editorial-media").getPublicUrl(path);
    await admin.from("audit_events").insert({ actor_id: user.id, action: "email_image_uploaded", entity_type: "storage_object", entity_id: path, details: { originalName: file.name, sourceBytes: file.size, storedBytes: image.length, width: metadata.width, height: metadata.height } });
    return NextResponse.json({ url: data.publicUrl, width: metadata.width, height: metadata.height });
  } catch (error) {
    return apiErrorResponse(error, "Could not upload the email image.");
  }
}
