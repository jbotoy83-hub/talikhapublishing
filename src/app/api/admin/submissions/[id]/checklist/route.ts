import { NextResponse } from "next/server";
import { setWorkflowChecklistItem } from "@/lib/editorial-workflow-server";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

export async function POST(request: Request) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  try {
    const data = await setWorkflowChecklistItem({
      checklistItemId: String(body.checklistItemId || ""),
      completed: Boolean(body.completed)
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return apiErrorResponse(error, "The checklist could not be updated.");
  }
}
