import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

function authorSlug(name: string) {
  return name
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "author";
}

export async function POST(request: Request) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });

  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Author name is required." }, { status: 400 });
  const baseSlug = authorSlug(name);

  try {
    let created: { id: string; slug: string } | null = null;
    for (let attempt = 0; attempt < 50 && !created; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const { data, error } = await admin
        .from("authors")
        .insert({
          name,
          slug,
          bio: String(body.bio || ""),
          affiliation: body.affiliation ? String(body.affiliation) : null,
          credentials: body.credentials ? String(body.credentials) : null,
          orcid: body.orcid ? String(body.orcid) : null,
          status: body.status === "draft" ? "draft" : "published"
        })
        .select("id, slug")
        .maybeSingle();
      if (!error && data) created = data;
    }
    if (!created) return NextResponse.json({ error: "The author profile could not be created." }, { status: 400 });
    return NextResponse.json({ ok: true, data: created });
  } catch (error) {
    return apiErrorResponse(error, "The author profile could not be created.");
  }
}
