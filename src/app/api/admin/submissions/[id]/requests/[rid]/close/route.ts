import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
  const { id, rid } = await params;
  try {
    const { error } = await admin.from("author_requests").update({ status: "closed" }).eq("id", rid).eq("submission_id", id).eq("status", "open");
    if (error) throw new Error("The author request could not be closed.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "The author request could not be closed.");
  }
}
