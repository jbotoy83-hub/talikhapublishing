import { NextResponse } from "next/server";
import { apiErrorResponse, isApiError, requireEditorApi } from "@/lib/admin-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadCertificateTemplate } from "@/lib/certificate-editor";

export async function GET() {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try {
    const templates = await admin.from("certificate_templates")
      .select("id,name,status,is_default,version,updated_at")
      .order("is_default", { ascending: false }).order("updated_at", { ascending: false });
    if (templates.error) throw new Error(templates.error.message);
    return NextResponse.json({ templates: templates.data || [] });
  } catch (error) {
    return apiErrorResponse(error, "Could not load certificate templates.");
  }
}

export async function POST() {
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try {
    const source = await admin.from("certificate_templates").select("*").eq("is_default", true).maybeSingle();
    if (source.error || !source.data) throw new Error(source.error?.message || "General Template is not available. Apply the certificate migration first.");
    const inserted = await admin.from("certificate_templates").insert({
      name: `Certificate Template ${new Date().toLocaleDateString("en-CA")}`,
      status: "draft", page_count: 6, is_default: false, created_by: user.id,
    }).select("id").single();
    if (inserted.error) throw new Error(inserted.error.message);
    const sourcePages = await admin.from("certificate_template_pages").select("*").eq("template_id", source.data.id).order("page_number");
    const sourceFields = await admin.from("certificate_template_fields").select("*").eq("template_id", source.data.id);
    if (sourcePages.error || sourceFields.error || sourcePages.data.length !== 6) throw new Error(sourcePages.error?.message || sourceFields.error?.message || "General Template must have six pages.");
    const pageInsert = await admin.from("certificate_template_pages").insert(sourcePages.data.map((page) => ({
      template_id: inserted.data.id, page_number: page.page_number, width: page.width, height: page.height, page_type: page.page_type,
      background_bucket: page.background_bucket, background_path: page.background_path, background_mime_type: page.background_mime_type, background_original_name: page.background_original_name,
    }))).select("id,page_number");
    if (pageInsert.error || pageInsert.data.length !== 6) throw new Error(pageInsert.error?.message || "Could not create the six template pages.");
    const pageIds = new Map(pageInsert.data.map((page) => [page.page_number, page.id]));
    const sourceBlocks = await admin.from("certificate_text_blocks").select("*").in("page_id", sourcePages.data.map((page) => page.id));
    if (sourceBlocks.error) throw new Error(sourceBlocks.error.message);
    const sourcePageNumbers = new Map(sourcePages.data.map((page) => [page.id, page.page_number]));
    const fieldsInsert = await admin.from("certificate_template_fields").insert(sourceFields.data.map((field) => ({
      template_id: inserted.data.id, field_key: field.field_key, label: field.label, field_type: field.field_type, required: field.required, default_value: field.default_value, validation_rule: field.validation_rule, source_key: field.source_key, section: field.section,
    })));
    if (fieldsInsert.error) throw new Error(fieldsInsert.error.message);
    if (sourceBlocks.data.length) {
      const blocksInsert = await admin.from("certificate_text_blocks").insert(sourceBlocks.data.map((block) => ({
        page_id: pageIds.get(sourcePageNumbers.get(block.page_id)), content: block.content, x: block.x, y: block.y, width: block.width, height: block.height, rotation: block.rotation, z_index: block.z_index, style: block.style, overflow_behavior: block.overflow_behavior, locked: block.locked, block_type: block.block_type, asset_bucket: block.asset_bucket, asset_path: block.asset_path,
      })));
      if (blocksInsert.error) throw new Error(blocksInsert.error.message);
    }
    const template = await loadCertificateTemplate(admin, inserted.data.id);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Could not create a template.");
  }
}
