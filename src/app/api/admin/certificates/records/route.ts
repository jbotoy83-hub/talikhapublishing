import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { CERTIFICATE_ASSET_BUCKET } from "@/lib/certificate-editor";
import { importPublicationCertificates } from "@/lib/certificate-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const inputSchema = z.object({ templateId: z.string().uuid(), publicationId: z.string().uuid() });

export async function GET(request: Request) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  const templateId = new URL(request.url).searchParams.get("templateId");
  if (!templateId || !z.string().uuid().safeParse(templateId).success) return NextResponse.json({ error: "A valid template is required." }, { status: 400 });
  try {
    const [result, fieldsResult] = await Promise.all([
      admin.from("certificate_records").select("id,author_id,status,field_values,certificate_number,created_at,updated_at,template_id,publication_id,submission_id")
        .eq("template_id", templateId).order("created_at", { ascending: false }),
      admin.from("certificate_template_fields").select("field_key,field_type").eq("template_id", templateId),
    ]);
    if (result.error) throw new Error(result.error.message);
    if (fieldsResult.error) throw new Error(fieldsResult.error.message);
    const imageKeys = new Set((fieldsResult.data || []).filter((f) => f.field_type === "image").map((f) => f.field_key));
    const records = result.data || [];
    const pathsToSign: Array<{ recordIdx: number; key: string; path: string }> = [];
    records.forEach((record, recordIdx) => {
      const fv = (record.field_values || {}) as Record<string, unknown>;
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
    return NextResponse.json({ records: enriched });
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
