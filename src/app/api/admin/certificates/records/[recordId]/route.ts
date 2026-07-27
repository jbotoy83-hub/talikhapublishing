import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { refreshCertificateRecord } from "@/lib/certificate-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const valueSchema = z.record(z.string().max(64), z.string().max(20000));

export async function PATCH(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  const body = await readJsonBody(request); if (body instanceof NextResponse) return body;
  try {
    const values = valueSchema.parse(body.fieldValues);
    const recordId = (await params).recordId;
    const current = await admin.from("certificate_records").select("status,field_values").eq("id", recordId).single();
    if (current.error || !current.data) return NextResponse.json({ error: "Certificate record not found." }, { status: 404 });
    if (current.data.status === "issued") return NextResponse.json({ error: "Issued certificates are immutable." }, { status: 409 });
    const protectedValues = current.data.field_values && typeof current.data.field_values === "object" ? current.data.field_values as Record<string, unknown> : {};
    const fieldValues = { ...values, certificate_number: String(protectedValues.certificate_number || ""), reference_number: String(protectedValues.reference_number || ""), date_issued: String(protectedValues.date_issued || ""), ...(Array.isArray(protectedValues._import_warnings) ? { _import_warnings: protectedValues._import_warnings } : {}) };
    const update = await admin.from("certificate_records").update({ field_values: fieldValues }).eq("id", recordId).select("id,author_id,status,field_values,certificate_number,created_at,updated_at,template_id,publication_id,submission_id").single();
    if (update.error || !update.data) throw new Error(update.error?.message || "Could not save certificate data.");
    return NextResponse.json({ record: update.data });
  } catch (error) { return apiErrorResponse(error, "Could not save certificate data."); }
}

export async function POST(_: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try { return NextResponse.json({ record: await refreshCertificateRecord(admin, (await params).recordId) }); }
  catch (error) { return apiErrorResponse(error, "Could not refresh certificate data from the manuscript."); }
}
