import { NextResponse } from "next/server";
import { confirmSubmissionPayment } from "@/lib/editorial-workflow-server";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Only the administrator can confirm a payment." }, { status: 403 });
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const { id } = await params;
  try {
    let paymentId = String(body.paymentId || "");
    if (!paymentId) {
      const admin = getSupabaseAdmin();
      if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });
      const { data, error } = await admin.from("payments").select("id").eq("submission_id", id).in("status", ["pending", "awaiting_match"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error || !data?.id) return NextResponse.json({ error: "A pending payment record is required before confirmation." }, { status: 400 });
      paymentId = data.id;
    }
    await confirmSubmissionPayment({ paymentId, submissionId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "The payment could not be confirmed.");
  }
}
