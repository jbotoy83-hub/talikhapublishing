import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { manuscriptApiError } from "@/lib/manuscript-api";
import { getManuscriptDetail } from "@/lib/manuscripts";

const idSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    return NextResponse.json({ manuscript: await getManuscriptDetail(idSchema.parse(id), user) });
  } catch (error) {
    return manuscriptApiError(error, "The manuscript workspace could not be loaded.");
  }
}
