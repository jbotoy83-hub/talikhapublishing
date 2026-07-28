import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAuthorProgress, isWorkflowStage, deriveAuthorStatus } from "@/lib/editorial-workflow";
import { allowRequest, getRequestRateLimitKey } from "@/lib/rate-limit";

const lookupInput = z.object({
  reference: z.string().trim().min(3).max(120)
});

const AUTHOR_EVENT_TYPES = ["progress_activity", "author_request_responded", "editorial_update"];

type TrackedSubmission = {
  id: string;
  title: string;
  current_stage: string;
  tracking_number: string;
  reference: string;
};

export async function POST(request: NextRequest) {
  const ip = getRequestRateLimitKey(request.headers);
  if (!allowRequest(`track:${ip}`, 5, 15 * 60 * 1000)) return NextResponse.json({ error: "Too many lookup attempts. Please wait before trying again." }, { status: 429 });
  const parsed = lookupInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your submission reference." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Tracking is not available yet." }, { status: 503 });
  let submission: TrackedSubmission | null = null;

  const fields = "id, title, current_stage, tracking_number, reference";
  const { data: byReference } = await admin.from("submissions").select(fields).eq("reference", parsed.data.reference).maybeSingle();
  if (byReference) submission = byReference as TrackedSubmission;

  if (!submission) {
    const { data: byTrackingNumber } = await admin.from("submissions").select(fields).eq("tracking_number", parsed.data.reference).maybeSingle();
    if (byTrackingNumber) submission = byTrackingNumber as TrackedSubmission;
  }

  if (!submission) {
    const { data: receipt } = await admin.from("receipts").select("submission_id").eq("receipt_number", parsed.data.reference).maybeSingle();
    if (receipt?.submission_id) {
      const { data: receiptSubmission } = await admin.from("submissions").select(fields).eq("id", receipt.submission_id).maybeSingle();
      if (receiptSubmission) submission = receiptSubmission as TrackedSubmission;
    }
  }

  if (!submission || !isWorkflowStage(submission.current_stage)) return NextResponse.json({ error: "We could not find that submission reference. Check the number and try again." }, { status: 404 });

  const [{ data: events }, { data: requests }] = await Promise.all([
    admin.from("workflow_events").select("id, public_title, public_description, event_type, created_at, metadata").eq("submission_id", submission.id).eq("visibility", "author").in("event_type", AUTHOR_EVENT_TYPES).order("created_at", { ascending: true }).limit(100),
    admin.from("author_requests").select("id, title, description, request_type, status, due_at, response_choice, responded_at").eq("submission_id", submission.id).eq("visible_to_author", true).order("created_at", { ascending: false }).limit(20)
  ]);

  const hasOpenRevision = (requests || []).some((r) => r.request_type === "revision" && r.status === "open");

  const REPEATABLE_TITLES = new Set(["Publication information updated", "Certificate available"]);
  const allEvents = events || [];
  const seenTitles = new Set<string>();
  const dedupedEvents: typeof allEvents = [];
  for (const ev of allEvents) {
    const title = ev.public_title || "";
    if (!REPEATABLE_TITLES.has(title)) {
      if (seenTitles.has(title)) continue;
      seenTitles.add(title);
    }
    dedupedEvents.push(ev);
  }
  dedupedEvents.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    const ia = Number((a.metadata as Record<string, unknown> | null)?.batch_index ?? 0);
    const ib = Number((b.metadata as Record<string, unknown> | null)?.batch_index ?? 0);
    return ia - ib;
  });

  return NextResponse.json({
    trackingNumber: submission.tracking_number,
    reference: submission.reference,
    title: submission.title,
    currentStage: submission.current_stage,
    currentStageLabel: deriveAuthorStatus(submission.current_stage, hasOpenRevision),
    progress: getAuthorProgress(submission.current_stage),
    events: dedupedEvents,
    requests: requests || []
  }, { headers: { "Cache-Control": "private, no-store" } });
}
