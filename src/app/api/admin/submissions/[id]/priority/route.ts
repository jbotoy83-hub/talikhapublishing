import { NextResponse } from "next/server";
import { setSubmissionPriority } from "@/lib/editorial-workflow-server";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const { id } = await params;
  try {
    await setSubmissionPriority({ submissionId: id, priority: body.priority as "normal" | "high" | "urgent" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "The priority could not be updated.");
  }
}
