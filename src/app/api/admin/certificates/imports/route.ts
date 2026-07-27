import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { listCertificateImportCandidates } from "@/lib/certificate-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try { return NextResponse.json({ candidates: await listCertificateImportCandidates(admin) }); }
  catch (error) { return apiErrorResponse(error, "Could not load For-approval manuscripts."); }
}
