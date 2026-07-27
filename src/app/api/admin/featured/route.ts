import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

type PublicationRow = {
  id: string;
  title: string;
  slug: string;
  author_display: string | null;
  featured: boolean | null;
  status: string;
  journals: { title: string | null } | null;
};

export async function GET() {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
  const { data, error } = await admin
    .from("publications")
    .select("id, title, slug, author_display, featured, status, journals(title)")
    .order("title");
  if (error) return NextResponse.json({ error: "The publications could not be loaded." }, { status: 503 });
  const publications = ((data || []) as unknown as PublicationRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    author_display: row.author_display,
    featured: row.featured === true,
    status: row.status,
    journal: row.journals?.title ?? null,
  }));
  return NextResponse.json({ publications });
}

export async function POST(request: Request) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  try {
    const parsed = z.object({ publicationId: z.string().uuid(), featured: z.boolean() }).parse(body);
    const { error } = await admin.from("publications").update({ featured: parsed.featured }).eq("id", parsed.publicationId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "The featured state could not be saved.");
  }
}
