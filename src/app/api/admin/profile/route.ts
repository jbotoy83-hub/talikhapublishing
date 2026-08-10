import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter at least 2 characters.").max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,31}$/, "Use 3–32 lowercase letters, numbers, dots, underscores, or hyphens."),
  headline: z.string().trim().max(80),
  bio: z.string().trim().max(300),
  location: z.string().trim().max(80),
  website: z.string().trim().max(160).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a complete website address beginning with http:// or https://."),
  pronouns: z.string().trim().max(30),
}).strict();

const profileSelect = "id, email, display_name, role, username, headline, bio, location, website, pronouns, avatar_url, cover_url, created_at, last_signed_in_at";

function mapProfile(profile: Record<string, unknown>) {
  return {
    id: String(profile.id || ""),
    email: String(profile.email || ""),
    displayName: String(profile.display_name || ""),
    role: String(profile.role || "editor"),
    username: typeof profile.username === "string" ? profile.username : "",
    headline: String(profile.headline || ""),
    bio: String(profile.bio || ""),
    location: String(profile.location || ""),
    website: String(profile.website || ""),
    pronouns: String(profile.pronouns || ""),
    avatarUrl: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    coverUrl: typeof profile.cover_url === "string" ? profile.cover_url : null,
    createdAt: typeof profile.created_at === "string" ? profile.created_at : undefined,
    lastSignedInAt: typeof profile.last_signed_in_at === "string" ? profile.last_signed_in_at : null,
  };
}

export async function GET() {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data, error } = await admin.from("profiles").select(profileSelect).eq("id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Your profile could not be loaded." }, { status: 404 });
  return NextResponse.json({ profile: mapProfile(data) });
}

export async function PATCH(request: Request) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const body = await readJsonBody(request);
  if (body instanceof NextResponse) return body;

  try {
    const input = profileSchema.parse(body);
    const updates = {
      display_name: input.displayName,
      username: input.username,
      headline: input.headline,
      bio: input.bio,
      location: input.location,
      website: input.website,
      pronouns: input.pronouns,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await admin.from("profiles").update(updates).eq("id", user.id).select(profileSelect).single();
    if (error?.code === "23505") return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    if (error || !data) throw new Error("Your profile could not be saved.");
    const changedFields = Object.keys(updates).filter((field) => field !== "updated_at");
    await admin.from("audit_events").insert({
      actor_id: user.id,
      action: "admin_profile_updated",
      entity_type: "profile",
      entity_id: user.id,
      details: { changedFields },
    });
    return NextResponse.json({ profile: mapProfile(data) });
  } catch (error) {
    return apiErrorResponse(error, "Your profile could not be saved.");
  }
}
