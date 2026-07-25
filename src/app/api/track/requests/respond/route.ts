import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { allowRequest, getRequestRateLimitKey } from "@/lib/rate-limit";

const responseInput = z.object({
  reference: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(254),
  requestId: z.string().uuid(),
  choice: z.enum(["yes", "no"])
});

type TrackedSubmission = {
  id: string;
  author_email: string;
};

async function findTrackedSubmission(reference: string, email: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return { admin: null, submission: null };

  const normalizedEmail = email.toLocaleLowerCase();
  const { data: direct } = await admin
    .from("submissions")
    .select("id, author_email")
    .eq("tracking_number", reference)
    .maybeSingle();
  if (direct && String(direct.author_email).toLocaleLowerCase() === normalizedEmail) {
    return { admin, submission: direct as TrackedSubmission };
  }

  const { data: receipt } = await admin
    .from("receipts")
    .select("submission_id")
    .eq("receipt_number", reference)
    .maybeSingle();
  if (!receipt?.submission_id) return { admin, submission: null };

  const { data: receiptSubmission } = await admin
    .from("submissions")
    .select("id, author_email")
    .eq("id", receipt.submission_id)
    .maybeSingle();
  if (receiptSubmission && String(receiptSubmission.author_email).toLocaleLowerCase() === normalizedEmail) {
    return { admin, submission: receiptSubmission as TrackedSubmission };
  }

  return { admin, submission: null };
}

export async function POST(request: NextRequest) {
  const ip = getRequestRateLimitKey(request.headers);
  if (!allowRequest(`track-response:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many response attempts. Please wait before trying again." }, { status: 429 });
  }

  const parsed = responseInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your tracking or receipt number, author email, and response." }, { status: 400 });
  }

  const { admin, submission } = await findTrackedSubmission(parsed.data.reference, parsed.data.email);
  if (!admin) return NextResponse.json({ error: "Tracking is not available yet." }, { status: 503 });
  if (!submission) {
    return NextResponse.json({ error: "We could not match those details. Check the number and author email, then try again." }, { status: 404 });
  }

  const { data, error } = await admin.rpc("respond_to_author_request", {
    p_submission_id: submission.id,
    p_request_id: parsed.data.requestId,
    p_response_choice: parsed.data.choice
  });
  if (error) {
    const message = error.message.includes("already been answered")
      ? "This request has already been answered or closed."
      : "We could not record that response. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    request: {
      id: data.id,
      status: data.status,
      response_choice: data.response_choice,
      responded_at: data.responded_at
    }
  }, { headers: { "Cache-Control": "private, no-store" } });
}
