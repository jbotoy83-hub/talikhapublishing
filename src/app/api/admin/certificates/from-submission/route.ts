import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { importPublicationCertificates } from "@/lib/certificate-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const inputSchema = z.object({ submissionId: z.string().uuid() });

export async function POST(request: Request) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  const body = await readJsonBody(request); if (isApiError(body)) return body;
  try {
    const { submissionId } = inputSchema.parse(body);
    const [publicationRecord, template] = await Promise.all([
      admin.from("publication_records").select("publication_id").eq("submission_id", submissionId).not("publication_id", "is", null).maybeSingle(),
      admin.from("certificate_templates").select("id").eq("is_default", true).maybeSingle()
    ]);
    if (publicationRecord.error || !publicationRecord.data?.publication_id) throw new Error("Complete the publication record before creating its certificate.");
    if (template.error || !template.data) throw new Error("The default certificate template is unavailable.");
    const records = await importPublicationCertificates(admin, template.data.id, publicationRecord.data.publication_id);
    return NextResponse.json({ templateId: template.data.id, records });
  } catch (error) { return apiErrorResponse(error, "Could not load the certificate for this publication record."); }
}
