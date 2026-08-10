import { NextResponse } from "next/server";
import sharp from "sharp";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
type ImageKind = "avatar" | "cover";

function parseKind(value: FormDataEntryValue | string | null): ImageKind | null {
  return value === "avatar" || value === "cover" ? value : null;
}

export async function POST(request: Request) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  try {
    const form = await request.formData();
    const file = form.get("image");
    const kind = parseKind(form.get("kind"));
    if (!kind) return NextResponse.json({ error: "Choose whether this is a profile or cover image." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Profile images must be smaller than 5 MB." }, { status: 413 });
    if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });

    const source = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.width || !metadata.height) return NextResponse.json({ error: "The selected file is not a valid image." }, { status: 415 });
    const dimensions = kind === "avatar" ? { width: 512, height: 512 } : { width: 1500, height: 500 };
    const image = await sharp(source, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ ...dimensions, fit: "cover", position: "attention" })
      .webp({ quality: 88 })
      .toBuffer();
    const path = `profile-assets/${user.id}/${kind}-${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await admin.storage.from("editorial-media").upload(path, image, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw new Error("The image could not be uploaded.");
    const { data: publicData } = admin.storage.from("editorial-media").getPublicUrl(path);
    const profileUpdate = kind === "avatar" ? { avatar_url: publicData.publicUrl } : { cover_url: publicData.publicUrl };
    const { error: profileError } = await admin.from("profiles").update({ ...profileUpdate, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (profileError) throw new Error("The image was uploaded but could not be attached to your profile.");
    await admin.from("audit_events").insert({
      actor_id: user.id,
      action: "admin_profile_image_updated",
      entity_type: "profile",
      entity_id: user.id,
      details: { kind, path, sourceBytes: file.size, storedBytes: image.length },
    });
    return NextResponse.json({ kind, url: publicData.publicUrl });
  } catch (error) {
    return apiErrorResponse(error, "The profile image could not be uploaded.");
  }
}

export async function DELETE(request: Request) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const kind = parseKind(new URL(request.url).searchParams.get("kind"));
  if (!kind) return NextResponse.json({ error: "Choose the image to remove." }, { status: 400 });
  const profileUpdate = kind === "avatar" ? { avatar_url: null } : { cover_url: null };
  const { error } = await admin.from("profiles").update({ ...profileUpdate, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "The image could not be removed from your profile." }, { status: 400 });
  await admin.from("audit_events").insert({ actor_id: user.id, action: "admin_profile_image_removed", entity_type: "profile", entity_id: user.id, details: { kind } });
  return NextResponse.json({ kind, url: null });
}
