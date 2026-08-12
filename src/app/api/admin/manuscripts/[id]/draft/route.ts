import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import type { LinkedFieldBinding, ManuscriptEditorState, ManuscriptFieldValue, ManuscriptImportReport, ManuscriptManualConfirmations, ManuscriptPageSettings } from "@/lib/manuscript-editor-contract";
import { manuscriptApiError, readSizedJson, requireSameOrigin } from "@/lib/manuscript-api";
import { saveManuscriptDraft } from "@/lib/manuscripts";

const draftSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  editorState: z.record(z.string(), z.unknown()),
  contentText: z.string().max(4 * 1024 * 1024),
  pageSettings: z.record(z.string(), z.unknown()).optional(),
  fieldBindings: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  fieldSnapshot: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  importReport: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
  sourceSnapshot: z.record(z.string(), z.unknown()).optional(),
  manualConfirmations: z.record(z.string(), z.boolean()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const input = draftSchema.parse(await readSizedJson(request));
    const result = await saveManuscriptDraft(z.string().uuid().parse(id), user, {
      baseRevision: input.baseRevision,
      editorState: input.editorState as unknown as ManuscriptEditorState,
      contentText: input.contentText,
      pageSettings: input.pageSettings as unknown as ManuscriptPageSettings | undefined,
      fieldBindings: input.fieldBindings as unknown as LinkedFieldBinding[] | undefined,
      fieldSnapshot: input.fieldSnapshot as unknown as Record<string, ManuscriptFieldValue> | undefined,
      importReport: input.importReport as unknown as ManuscriptImportReport | null | undefined,
      sourceSnapshot: input.sourceSnapshot as never,
      manualConfirmations: input.manualConfirmations as ManuscriptManualConfirmations | undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return manuscriptApiError(error, "The manuscript draft could not be saved.");
  }
}
