import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, requireAdminApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runPublicationPreflight } from "@/lib/publication-preflight";

const inputSchema = z.object({
  action: z.enum(["return", "schedule", "reschedule", "publish"]),
  reason: z.string().trim().max(2000).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminApi();
  if (isApiError(user)) return user;
  const { id } = await params;
  try {
    const input = inputSchema.parse(await request.json());
    if (input.action === "return" && !input.reason) throw new Error("Add an internal return reason.");
    if ((input.action === "schedule" || input.action === "reschedule") && (!input.scheduledFor || new Date(input.scheduledFor) <= new Date())) {
      throw new Error("Choose a future publication date and time.");
    }
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("The editorial database is not configured.");
    const detail = input.action === "publish" ? await runPublicationPreflight(id, user) : null;
    let submittedRunId: string | null = null;
    if (detail) {
      if (detail.run?.status !== "ready") throw new Error(detail.blockers[0]?.message || "The final publication recheck is blocked.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = admin as any;
      const { data: publicationRecord } = await db.from("publication_records").select("submitted_preflight_run_id").eq("submission_id", id).maybeSingle();
      submittedRunId = publicationRecord?.submitted_preflight_run_id || null;
      const { data: submittedRun } = submittedRunId ? await db.from("publication_preflight_runs").select("source_fingerprint,status,invalidated_at").eq("id", submittedRunId).maybeSingle() : { data: null };
      if (!submittedRun || submittedRun.status !== "submitted" || submittedRun.invalidated_at || submittedRun.source_fingerprint !== detail.run.source_fingerprint) {
        throw new Error("The publication changed after approval. Rerun quality control and submit a new evidence snapshot.");
      }
    }
    const target = input.action === "return" ? "production_records" : input.action === "publish" ? "published" : "production_scheduled";
    // The migration adds this service-role-only RPC. Keep the cast local until generated types are refreshed after deployment.
    const { data, error } = await (admin.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("admin_transition_publication", {
      p_submission_id: id,
      p_to_stage: target,
      p_actor_id: user.id,
      p_reason: input.reason || "",
      p_scheduled_for: input.scheduledFor || null,
      p_preflight_run_id: submittedRunId || null,
    });
    if (error) throw new Error(error.message);
    if (input.action === "return") {
      await admin.from("submissions").update({ priority: "high" }).eq("id", id);
    }
    return NextResponse.json({ ok: true, submission: data });
  } catch (error) {
    return apiErrorResponse(error, "The administrator publication action failed.");
  }
}
