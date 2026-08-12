import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import type { ManuscriptImportPayload } from "@/lib/manuscript-editor-contract";
import { manuscriptApiError, readSizedJson, requireSameOrigin } from "@/lib/manuscript-api";
import { importManuscriptDraft } from "@/lib/manuscripts";

const importSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  payload: z.object({
    editorState: z.record(z.string(), z.unknown()),
    contentText: z.string().max(4 * 1024 * 1024),
    sourceSnapshot: z.record(z.string(), z.unknown()),
    report: z.record(z.string(), z.unknown()),
  }),
});

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const input = importSchema.parse(await readSizedJson(request, 32 * 1024 * 1024));
    return NextResponse.json(await importManuscriptDraft(z.string().uuid().parse(id), user, input.baseRevision, input.payload as unknown as ManuscriptImportPayload));
  } catch (error) {
    return manuscriptApiError(error, "The source manuscript could not be imported.");
  }
}
