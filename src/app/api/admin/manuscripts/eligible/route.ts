import { NextResponse } from "next/server";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { manuscriptApiError } from "@/lib/manuscript-api";
import { listEligibleManuscripts } from "@/lib/manuscripts";

export async function GET() {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    return NextResponse.json({ manuscripts: await listEligibleManuscripts() });
  } catch (error) {
    return manuscriptApiError(error, "Eligible manuscripts could not be loaded.");
  }
}
