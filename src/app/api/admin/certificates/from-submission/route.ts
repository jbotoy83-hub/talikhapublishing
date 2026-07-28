import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { CERTIFICATE_ASSET_BUCKET } from "@/lib/certificate-editor";
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
    const fieldsResult = await admin.from("certificate_template_fields").select("field_key,field_type").eq("template_id", template.data.id);
    if (fieldsResult.error) throw new Error(fieldsResult.error.message);
    const imageKeys = new Set((fieldsResult.data || []).filter((f) => f.field_type === "image").map((f) => f.field_key));
    const pathsToSign: Array<{ recordIdx: number; key: string; path: string }> = [];
    records.forEach((record, recordIdx) => {
      const fv = (record?.field_values || {}) as Record<string, unknown>;
      for (const key of imageKeys) {
        const val = fv[key];
        if (typeof val === "string" && val.trim()) pathsToSign.push({ recordIdx, key, path: val });
      }
    });
    const fieldUrlsList: Array<Record<string, string>> = records.map(() => ({}));
    await Promise.all(pathsToSign.map(async ({ recordIdx, key, path }) => {
      const signed = await admin.storage.from(CERTIFICATE_ASSET_BUCKET).createSignedUrl(path, 60 * 60);
      if (signed.data?.signedUrl) fieldUrlsList[recordIdx][key] = signed.data.signedUrl;
    }));
    const enriched = records.map((record, i) => ({ ...record, field_urls: fieldUrlsList[i] }));
    return NextResponse.json({ templateId: template.data.id, records: enriched });
  } catch (error) { return apiErrorResponse(error, "Could not load the certificate for this publication record."); }
}
