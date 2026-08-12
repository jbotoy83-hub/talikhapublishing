import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import type { ManuscriptManualConfirmations } from "@/lib/manuscript-editor-contract";
import { manuscriptApiError, readSizedJson, requireSameOrigin } from "@/lib/manuscript-api";
import { finalizeManuscript } from "@/lib/manuscripts";

const finalizeSchema = z.object({ confirmations: z.record(z.string(), z.boolean()), changeSummary: z.string().trim().max(500).optional().default("Final DOCX and PDF attached") });

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const input = finalizeSchema.parse(await readSizedJson(request, 64 * 1024));
    return NextResponse.json(await finalizeManuscript(z.string().uuid().parse(id), user, input.confirmations as ManuscriptManualConfirmations, input.changeSummary), { status: 201 });
  } catch (error) {
    return manuscriptApiError(error, "The manuscript could not be finalized.");
  }
}
