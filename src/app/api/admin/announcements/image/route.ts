import { NextResponse } from "next/server";
import sharp from "sharp";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an announcement image." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Announcement images must be smaller than 8 MB." }, { status: 413 });
    if (!/^image\/(?:jpeg|png|webp|gif)$/i.test(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or GIF image." }, { status: 415 });

    const source = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.width || !metadata.height) return NextResponse.json({ error: "The selected file is not a valid image." }, { status: 415 });
    const image = await sharp(source, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1000, fit: "cover", position: "attention" })
      .webp({ quality: 88 })
      .toBuffer();
    const path = `announcement-assets/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.webp`;
    const uploadBody = new Blob([new Uint8Array(image)], { type: "image/webp" });
    const { error: uploadError } = await admin.storage.from("editorial-media").upload(path, uploadBody, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw new Error("The announcement image could not be uploaded.");
    const { data: storedFile, error: storedFileError } = await admin.storage.from("editorial-media").download(path);
    if (storedFileError || !storedFile) {
      await admin.storage.from("editorial-media").remove([path]);
      throw new Error("The announcement image could not be verified after upload.");
    }
    const storedBytes = Buffer.from(await storedFile.arrayBuffer());
    if (!storedBytes.equals(image)) {
      await admin.storage.from("editorial-media").remove([path]);
      throw new Error("The uploaded announcement image changed during storage. Please try again.");
    }
    try {
      await sharp(storedBytes, { limitInputPixels: 40_000_000 }).metadata();
    } catch {
      await admin.storage.from("editorial-media").remove([path]);
      throw new Error("The uploaded announcement image was not readable. Please try another image.");
    }
    const { data } = admin.storage.from("editorial-media").getPublicUrl(path);
    await admin.from("audit_events").insert({
      actor_id: user.id,
      action: "announcement_image_uploaded",
      entity_type: "storage_object",
      entity_id: path,
      details: { originalName: file.name, sourceBytes: file.size, storedBytes: storedBytes.length, width: metadata.width, height: metadata.height },
    });
    return NextResponse.json({ url: data.publicUrl, width: 1600, height: 1000 });
  } catch (error) {
    return apiErrorResponse(error, "The announcement image could not be uploaded.");
  }
}
