import { NextResponse } from "next/server";
import { createAuthorRequest } from "@/lib/editorial-workflow-server";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const body = await readJsonBody(request);
  if (isApiError(body)) return body;
  const { id } = await params;
  try {
    await createAuthorRequest({
      submissionId: id,
      requestType: (String(body.requestType || "revision")) as "revision" | "proof_approval" | "information" | "consent" | "other",
      title: String(body.title || "Revision required"),
      description: String(body.description || ""),
      dueAt: body.dueAt ? String(body.dueAt) : undefined
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "The author request could not be created.");
  }
}
