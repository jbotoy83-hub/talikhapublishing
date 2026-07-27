import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { importPublicationCertificates } from "@/lib/certificate-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const inputSchema = z.object({ templateId: z.string().uuid(), publicationId: z.string().uuid() });

export async function GET(request: Request) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  const templateId = new URL(request.url).searchParams.get("templateId");
  if (!templateId || !z.string().uuid().safeParse(templateId).success) return NextResponse.json({ error: "A valid template is required." }, { status: 400 });
  try {
    const result = await admin.from("certificate_records").select("id,author_id,status,field_values,certificate_number,created_at,updated_at,template_id,publication_id,submission_id")
      .eq("template_id", templateId).order("created_at", { ascending: false });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ records: result.data || [] });
  } catch (error) { return apiErrorResponse(error, "Could not load certificate records."); }
}

export async function POST(request: Request) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  const body = await readJsonBody(request); if (body instanceof NextResponse) return body;
  try {
    const input = inputSchema.parse(body);
    const records = await importPublicationCertificates(admin, input.templateId, input.publicationId);
    return NextResponse.json({ records }, { status: 201 });
  } catch (error) { return apiErrorResponse(error, "Could not create author certificate records."); }
}
