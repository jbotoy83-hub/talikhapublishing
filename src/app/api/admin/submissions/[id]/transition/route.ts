import { NextResponse } from "next/server";
import { transitionSubmission } from "@/lib/editorial-workflow-server";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const { id } = await params;
  try {
    const data = await transitionSubmission({ ...body, submissionId: id } as Parameters<typeof transitionSubmission>[0]);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return apiErrorResponse(error, "The workflow could not be updated.");
  }
}
