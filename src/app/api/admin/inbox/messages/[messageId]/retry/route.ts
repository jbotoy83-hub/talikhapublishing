import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireAdminApi } from "@/lib/admin-api";
import { retryMessage } from "@/lib/email/correspondence";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  try {
    return NextResponse.json({ ok: true, result: await retryMessage(admin, (await params).messageId, user.id) });
  } catch (error) {
    return apiErrorResponse(error, "Could not retry the email.");
  }
}
