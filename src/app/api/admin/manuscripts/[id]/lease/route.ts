import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { manuscriptApiError, readSizedJson, requireSameOrigin } from "@/lib/manuscript-api";
import { updateManuscriptLease } from "@/lib/manuscripts";

const leaseSchema = z.object({ action: z.enum(["acquire", "heartbeat", "release", "takeover"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const { action } = leaseSchema.parse(await readSizedJson(request, 16 * 1024));
    return NextResponse.json({ manuscript: await updateManuscriptLease(z.string().uuid().parse(id), user, action) });
  } catch (error) {
    return manuscriptApiError(error, "The editing lease could not be updated.");
  }
}
