import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { manuscriptApiError, readSizedJson, requireSameOrigin } from "@/lib/manuscript-api";
import { createOrOpenManuscript } from "@/lib/manuscripts";

const createSchema = z.object({ submissionId: z.string().uuid() });

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const input = createSchema.parse(await readSizedJson(request, 16 * 1024));
    return NextResponse.json({ manuscript: await createOrOpenManuscript(input.submissionId, user) }, { status: 201 });
  } catch (error) {
    return manuscriptApiError(error, "The manuscript workspace could not be opened.");
  }
}
