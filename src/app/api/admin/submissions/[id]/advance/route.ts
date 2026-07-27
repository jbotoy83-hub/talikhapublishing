import { NextResponse } from "next/server";
import { advanceSubmissionProgress } from "@/lib/editorial-workflow-server";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const { id } = await params;
  try {
    const data = await advanceSubmissionProgress({ submissionId: id, targetProgress: Number(body.targetProgress) });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return apiErrorResponse(error, "The workflow could not be advanced.");
  }
}
