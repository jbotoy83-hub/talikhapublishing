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
  if (!await allowRequest(`track:${ip}`, 5, 15 * 60 * 1000)) return NextResponse.json({ error: "Too many lookup attempts. Please wait before trying again." }, { status: 429 });
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

  const [{ data: events }, { data: requests }, { data: files }, { data: certRecords }] = await Promise.all([
    admin.from("workflow_events").select("id, public_title, public_description, event_type, created_at, metadata").eq("submission_id", submission.id).eq("visibility", "author").in("event_type", AUTHOR_EVENT_TYPES).order("created_at", { ascending: true }).limit(100),
    admin.from("author_requests").select("id, title, description, request_type, status, due_at, response_choice, responded_at").eq("submission_id", submission.id).eq("visible_to_author", true).order("created_at", { ascending: false }).limit(20),
    admin.from("submission_files").select("id, file_kind, original_name, mime_type, size_bytes, storage_path, storage_bucket").eq("submission_id", submission.id).neq("file_kind", "paymentProof").order("file_kind"),
    admin.from("certificate_records").select("id, certificate_number, status, issued_at, field_values").eq("submission_id", submission.id).order("created_at", { ascending: false }).limit(5)
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

  const isPeerReviewEvent = (event: (typeof dedupedEvents)[number]) =>
    event.event_type === "editorial_update" && /peer|reviewer|review comments|review decision/i.test(event.public_title || "");
  const reviewEvents = dedupedEvents.filter(isPeerReviewEvent);
  const activityEvents = dedupedEvents.filter((event) => !isPeerReviewEvent(event));

  const signedFiles: Array<{ id: string; file_kind: string; original_name: string; mime_type: string; size_bytes: number; url: string }> = [];
  if (files?.length) {
    await Promise.all(files.map(async (f) => {
      const bucket = f.storage_bucket || "submission-files";
      const signed = await admin.storage.from(bucket).createSignedUrl(f.storage_path, 3600);
      if (signed.data?.signedUrl) signedFiles.push({ id: f.id, file_kind: f.file_kind, original_name: f.original_name || "File", mime_type: f.mime_type || "", size_bytes: f.size_bytes || 0, url: signed.data.signedUrl });
    }));
  }

  const certificates: Array<{ certificate_number: string; status: string; issued_at: string | null; holder_name: string; work_title: string; download_url: string | null }> = [];
  if (certRecords?.length) {
    for (const cr of certRecords) {
      const fv = (cr.field_values || {}) as Record<string, unknown>;
      let downloadUrl: string | null = null;
      if (cr.status === "issued") {
        const { data: link } = await admin.from("certificate_access_links").select("token_hash, expires_at, revoked_at, output_version_id").eq("certificate_record_id", cr.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (link?.output_version_id) {
          const { data: ver } = await admin.from("certificate_output_versions").select("pdf_path").eq("id", link.output_version_id).maybeSingle();
          if (ver?.pdf_path) {
            const signed = await admin.storage.from("certificate-assets").createSignedUrl(ver.pdf_path, 3600);
            if (signed.data?.signedUrl) downloadUrl = signed.data.signedUrl;
          }
        }
      }
      certificates.push({ certificate_number: cr.certificate_number, status: cr.status, issued_at: cr.issued_at, holder_name: String(fv.author_name || ""), work_title: String(fv.work_title || ""), download_url: downloadUrl });
    }
  }

  return NextResponse.json({
    trackingNumber: submission.tracking_number,
    reference: submission.reference,
    title: submission.title,
    currentStage: submission.current_stage,
    currentStageLabel: deriveAuthorStatus(submission.current_stage, hasOpenRevision),
    progress: getAuthorProgress(submission.current_stage),
    events: activityEvents,
    requests: requests || [],
    files: signedFiles,
    certificates,
    reviewEvents
  }, { headers: { "Cache-Control": "private, no-store" } });
}
