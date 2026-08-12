import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { manuscriptApiError, readSizedJson, requireSameOrigin } from "@/lib/manuscript-api";
import { syncManuscriptFields } from "@/lib/manuscripts";

const syncSchema = z.object({ action: z.enum(["preview", "apply"]), baseRevision: z.number().int().nonnegative().optional(), selectedKeys: z.array(z.string().min(1).max(180)).max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    return NextResponse.json(await syncManuscriptFields(z.string().uuid().parse(id), user, syncSchema.parse(await readSizedJson(request, 64 * 1024))));
  } catch (error) {
    return manuscriptApiError(error, "Linked manuscript fields could not be synchronized.");
  }
}
