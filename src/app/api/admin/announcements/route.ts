import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { announcementInput, toPayload, toSettings, type AnnouncementRow } from "@/lib/announcements";

export async function GET() {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
  const { data, error } = await admin
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "The announcement could not be loaded." }, { status: 503 });
  return NextResponse.json({ announcement: data ? toSettings(data as AnnouncementRow) : null });
}

export async function PUT(request: Request) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  try {
    const parsed = announcementInput.parse(body);
    const payload = toPayload(parsed, user.id);
    const { data: existing } = await admin
      .from("announcements")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await admin.from("announcements").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("announcements").insert(payload);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "The announcement could not be saved.");
  }
}
