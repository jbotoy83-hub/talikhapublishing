import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { manuscriptApiError, readSizedJson, requireSameOrigin } from "@/lib/manuscript-api";
import { checkpointManuscript, restoreManuscriptVersion } from "@/lib/manuscripts";

const versionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("checkpoint"), changeSummary: z.string().trim().max(500).optional().default("Manual checkpoint") }),
  z.object({ action: z.literal("restore"), versionId: z.string().uuid() }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const documentId = z.string().uuid().parse(id);
    const input = versionSchema.parse(await readSizedJson(request, 64 * 1024));
    return NextResponse.json(input.action === "checkpoint" ? await checkpointManuscript(documentId, user, input.changeSummary) : await restoreManuscriptVersion(documentId, input.versionId, user));
  } catch (error) {
    return manuscriptApiError(error, "The manuscript version action could not be completed.");
  }
}
