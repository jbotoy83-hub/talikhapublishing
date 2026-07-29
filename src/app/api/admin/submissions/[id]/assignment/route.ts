import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const { id: submissionId } = await params;
  const issueId = typeof body.issueId === "string" && body.issueId.trim() ? body.issueId.trim() : null;
  if (issueId && !UUID.test(issueId)) return NextResponse.json({ error: "The selected issue is invalid." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The editorial database is not configured." }, { status: 503 });

  try {
    const { data: submission } = await admin.from("submissions").select("id, preferred_journal_id").eq("id", submissionId).maybeSingle();
    if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

    let volumeSnapshot = "";
    let issueSnapshot = "";
    if (issueId) {
      const { data: issue } = await admin.from("issues").select("id, journal_id, volume, issue_number").eq("id", issueId).maybeSingle();
      if (!issue) return NextResponse.json({ error: "The selected issue was not found." }, { status: 404 });
      if (submission.preferred_journal_id && submission.preferred_journal_id !== issue.journal_id) return NextResponse.json({ error: "The selected issue does not belong to this submission's journal." }, { status: 409 });
      volumeSnapshot = issue.volume;
      issueSnapshot = issue.issue_number;
    }

    const { error } = await admin.from("submissions").update({ assigned_issue_id: issueId, volume_snapshot: volumeSnapshot, issue_snapshot: issueSnapshot }).eq("id", submissionId);
    if (error) throw error;
    return NextResponse.json({ ok: true, assignedIssueId: issueId, volume: volumeSnapshot, issue: issueSnapshot });
  } catch (error) {
    return apiErrorResponse(error, "The submission issue assignment could not be saved.");
  }
}
