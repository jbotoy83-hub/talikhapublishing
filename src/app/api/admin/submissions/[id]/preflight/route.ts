import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { getPublicationPreflight, runPublicationPreflight } from "@/lib/publication-preflight";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const { id } = await params;
  try {
    return NextResponse.json(await getPublicationPreflight(id, user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error, "Quality control could not be loaded.");
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const { id } = await params;
  try {
    return NextResponse.json(await runPublicationPreflight(id, user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error, "Quality control could not be run.");
  }
}
