import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { submitPublicationPreflight } from "@/lib/publication-preflight";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const { id } = await params;
  try {
    return NextResponse.json(await submitPublicationPreflight(id, user));
  } catch (error) {
    return apiErrorResponse(error, "The publication could not be submitted for approval.");
  }
}
