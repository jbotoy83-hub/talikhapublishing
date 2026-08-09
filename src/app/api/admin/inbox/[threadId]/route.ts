import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireAdminApi } from "@/lib/admin-api";
import { getInboxThread } from "@/lib/email/inbox";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  try {
    return NextResponse.json(await getInboxThread(admin, (await params).threadId));
  } catch (error) {
    return apiErrorResponse(error, "Could not load the thread.");
  }
}
