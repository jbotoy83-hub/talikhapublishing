import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { updatePublicationPreflightCheck } from "@/lib/publication-preflight";

const inputSchema = z.object({
  status: z.enum(["not_reviewed", "confirmed", "fail"]),
  issueNote: z.string().trim().max(1000).optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; checkId: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const { id, checkId } = await params;
  try {
    const input = inputSchema.parse(await request.json());
    return NextResponse.json(await updatePublicationPreflightCheck({ submissionId: id, checkId, actor: user, ...input }));
  } catch (error) {
    return apiErrorResponse(error, "The quality-control check could not be saved.");
  }
}
