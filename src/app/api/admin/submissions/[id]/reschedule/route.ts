import { NextResponse } from "next/server";
import { rescheduleSubmission } from "@/lib/editorial-workflow-server";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const { id } = await params;
  try {
    await rescheduleSubmission({ submissionId: id, scheduledFor: String(body.scheduledFor) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "The schedule could not be updated.");
  }
}
