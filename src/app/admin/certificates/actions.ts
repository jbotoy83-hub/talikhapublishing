"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { certificateFieldCatalog, normalizeDoi, validDoi } from "@/lib/certificates";
import { certificateNumber, certificateToken } from "@/lib/certificate-security";
import { renderCertificatePdf } from "@/lib/render-certificate";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const text = (formData: FormData, key: string, limit = 5000) => String(formData.get(key) || "").trim().slice(0, limit);

export async function createCertificateTemplate(formData: FormData) {
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  const name = text(formData, "name", 160);
  if (!admin || !name) return;
  const { data: template, error } = await admin.from("certificate_templates").insert({ name, created_by: user.id }).select("id").single();
  if (error || !template) return;
  await admin.from("certificate_template_pages").insert(Array.from({ length: 6 }, (_, index) => ({ template_id: template.id, page_number: index + 1 })));
  await admin.from("certificate_template_fields").insert(certificateFieldCatalog.map(([field_key, label, field_type]) => ({ template_id: template.id, field_key, label, field_type, required: ["author_name", "work_title", "certificate_number"].includes(field_key) })));
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_template.created", entity_type: "certificate_template", entity_id: template.id, details: { name } });
  redirect(`/admin/certificates/templates/${template.id}`);
}

export async function uploadCertificateBackground(formData: FormData) {
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  const templateId = text(formData, "templateId", 64);
  const upload = formData.get("background");
  if (!admin || !templateId || !(upload instanceof File) || upload.type !== "application/pdf" || upload.size < 1 || upload.size > 25 * 1024 * 1024) return;
  const path = `templates/${templateId}/${randomUUID()}.pdf`;
  const { error: storageError } = await admin.storage.from("certificate-assets").upload(path, Buffer.from(await upload.arrayBuffer()), { contentType: "application/pdf", upsert: false });
  if (storageError) return;
  await admin.from("certificate_templates").update({ background_path: path, background_bucket: "certificate-assets" }).eq("id", templateId);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_template.background_uploaded", entity_type: "certificate_template", entity_id: templateId, details: { path } });
  revalidatePath(`/admin/certificates/templates/${templateId}`);
}

export async function uploadCertificateImage(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin();
  const templateId = text(formData, "templateId", 64); const upload = formData.get("image");
  if (!admin || !templateId || !(upload instanceof File) || !["image/png", "image/jpeg"].includes(upload.type) || upload.size < 1 || upload.size > 10 * 1024 * 1024) return;
  const extension = upload.type === "image/png" ? "png" : "jpg";
  const path = `templates/${templateId}/images/${randomUUID()}.${extension}`;
  const { error } = await admin.storage.from("certificate-assets").upload(path, Buffer.from(await upload.arrayBuffer()), { contentType: upload.type, upsert: false });
  if (error) return;
  const { data: signed } = await admin.storage.from("certificate-assets").createSignedUrl(path, 60 * 60);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_template.image_uploaded", entity_type: "certificate_template", entity_id: templateId, details: { path } });
  return { bucket: "certificate-assets", path, url: signed?.signedUrl };
}

export async function setDefaultCertificateTemplate(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); const templateId = text(formData, "templateId", 64);
  if (!admin || !templateId) return;
  await admin.from("certificate_templates").update({ is_default: false }).eq("is_default", true);
  await admin.from("certificate_templates").update({ is_default: true, status: "published" }).eq("id", templateId);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_template.default_set", entity_type: "certificate_template", entity_id: templateId, details: {} });
  revalidatePath("/admin/certificates");
}

export async function saveCertificateLayout(formData: FormData) {
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  const templateId = text(formData, "templateId", 64);
  const raw = text(formData, "blocks", 200000);
  if (!admin || !templateId || !raw) return;
  let blocks: Array<Record<string, unknown>>;
  try { blocks = JSON.parse(raw); } catch { return; }
  if (!Array.isArray(blocks) || blocks.length > 250) return;
  const { data: pages } = await admin.from("certificate_template_pages").select("id").eq("template_id", templateId);
  const pageIds = new Set((pages || []).map((page) => page.id));
  const rows = blocks.filter((block) => typeof block.pageId === "string" && pageIds.has(block.pageId)).map((block, index) => ({
    page_id: block.pageId, content: block.content || { type: "doc", content: [] }, x: Number(block.x) || 0, y: Number(block.y) || 0,
    width: Math.max(1, Number(block.width) || 200), height: Math.max(1, Number(block.height) || 40), rotation: Number(block.rotation) || 0,
    z_index: Number(block.zIndex) || index, style: block.style || {}, overflow_behavior: ["auto_height", "auto_fit", "manual"].includes(String(block.overflowBehavior)) ? block.overflowBehavior : "auto_height", locked: Boolean(block.locked),
    block_type: block.blockType === "image" ? "image" : "text", asset_bucket: typeof block.assetBucket === "string" ? block.assetBucket : null, asset_path: typeof block.assetPath === "string" ? block.assetPath : null
  }));
  await admin.from("certificate_text_blocks").delete().in("page_id", [...pageIds]);
  if (rows.length) await admin.from("certificate_text_blocks").insert(rows);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_template.layout_saved", entity_type: "certificate_template", entity_id: templateId, details: { blockCount: rows.length } });
  revalidatePath(`/admin/certificates/templates/${templateId}`);
}

export async function createCertificateRecord(formData: FormData) {
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  let templateId = text(formData, "templateId", 64); const publicationId = text(formData, "publicationId", 64);
  if (!admin || !publicationId) return;
  if (!templateId) {
    const { data: defaultTemplate } = await admin.from("certificate_templates").select("id").eq("is_default", true).eq("status", "published").maybeSingle();
    templateId = defaultTemplate?.id || "";
  }
  if (!templateId) return;
  const { data: publication } = await admin.from("publications").select("source_submission_id, title, doi, publication_date, journal:journals(title), issue:issues(volume, issue_number)").eq("id", publicationId).maybeSingle();
  if (!publication) return;
  const { data: submission } = publication.source_submission_id ? await admin.from("submissions").select("reference,current_stage,author_name").eq("id", publication.source_submission_id).maybeSingle() : { data: null };
  if (submission?.current_stage !== "production_scheduled") return;
  const { data: authorRows } = await admin.from("publication_authors").select("author:authors(name)").eq("publication_id", publicationId);
  const authorNames = (authorRows || []).map((row) => { const author = Array.isArray(row.author) ? row.author[0] : row.author; return author?.name || ""; }).filter(Boolean).join(", ") || submission?.author_name || "Authors";
  const journal = Array.isArray(publication.journal) ? publication.journal[0] : publication.journal;
  const issue = Array.isArray(publication.issue) ? publication.issue[0] : publication.issue;
  const reference = submission?.reference || certificateNumber();
  const field_values = { author_name: authorNames, author_role: "Authors", work_title: publication.title, publication_name: journal?.title || "", volume_number: issue?.volume || "", issue_number: issue?.issue_number || "", date_issued: new Date().toISOString().slice(0, 10), doi: normalizeDoi(publication.doi || ""), certificate_number: certificateNumber(), reference_number: reference, publisher_name: "Talikha Publishing", issuing_city: "", issue_date: publication.publication_date || "" };
  const { data: record, error } = await admin.from("certificate_records").upsert({ template_id: templateId, publication_id: publicationId, submission_id: publication.source_submission_id || null, reference_number: reference, certificate_number: field_values.certificate_number, field_values, status: "draft" }, { onConflict: "publication_id" }).select("id").single();
  if (error || !record) return;
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_record.created", entity_type: "certificate_record", entity_id: record.id, details: { publicationId, reference } });
  redirect(`/admin/certificates/records/${record.id}`);
}

export async function issueCertificateRecord(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); const recordId = text(formData, "recordId", 64);
  if (!admin || !recordId) return;
  const { data: record } = await admin.from("certificate_records").select("id, certificate_number, field_values, layout_overrides, status, template_id, template:certificate_templates(background_bucket, background_path)").eq("id", recordId).maybeSingle();
  if (!record || record.status === "issued") return;
  const values = record.field_values as Record<string, string>;
  if (!values.author_name || !values.work_title || !values.certificate_number || !validDoi(values.doi || "")) return;
  const { data: latest } = await admin.from("certificate_output_versions").select("version_number").eq("certificate_record_id", recordId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const versionNumber = (latest?.version_number || 0) + 1;
  const template = Array.isArray(record.template) ? record.template[0] : record.template;
  const { data: pageRows } = await admin.from("certificate_template_pages").select("id,page_number").eq("template_id", record.template_id);
  const pageNumber = new Map((pageRows || []).map((page) => [page.id, page.page_number]));
  const { data: blocks } = pageRows?.length ? await admin.from("certificate_text_blocks").select("id,page_id,content,x,y,width,height,rotation,z_index,style,overflow_behavior,locked,block_type,asset_bucket,asset_path").in("page_id", pageRows.map((page) => page.id)) : { data: [] };
  const renderedBlocks = (blocks || []).map((block) => ({ id: block.id, pageId: block.page_id, pageNumber: pageNumber.get(block.page_id), content: block.content, x: Number(block.x), y: Number(block.y), width: Number(block.width), height: Number(block.height), rotation: Number(block.rotation), zIndex: block.z_index, style: block.style || {}, overflowBehavior: block.overflow_behavior, locked: block.locked, blockType: block.block_type, assetBucket: block.asset_bucket, assetPath: block.asset_path }));
  const { pdfBytes, warnings } = await renderCertificatePdf({ admin, template, values, blocks: renderedBlocks, recordId });
  if (warnings.length) return;
  const pdfPath = `outputs/${recordId}/${versionNumber}-${randomUUID()}.pdf`;
  const { error: uploadError } = await admin.storage.from("certificate-assets").upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) return;
  await admin.from("certificate_output_versions").insert({ certificate_record_id: recordId, version_number: versionNumber, field_values: record.field_values, layout_overrides: record.layout_overrides, pdf_path: pdfPath, created_by: user.id });
  await admin.from("certificate_records").update({ status: "issued", issued_at: new Date().toISOString(), issued_by: user.id }).eq("id", recordId);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_record.issued", entity_type: "certificate_record", entity_id: recordId, details: { certificateNumber: record.certificate_number } });
  revalidatePath(`/admin/certificates/records/${recordId}`);
}

export async function createCertificateAccessLink(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); const recordId = text(formData, "recordId", 64);
  if (!admin || !recordId) return;
  const { data: output } = await admin.from("certificate_output_versions").select("id").eq("certificate_record_id", recordId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  if (!output) return;
  const token = certificateToken(); const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  await admin.from("certificate_access_links").insert({ certificate_record_id: recordId, output_version_id: output.id, token_hash: token.tokenHash, expires_at: expiresAt, created_by: user.id });
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_access_link.created", entity_type: "certificate_record", entity_id: recordId, details: { expiresAt } });
  revalidatePath(`/admin/certificates/records/${recordId}`);
}

export async function revokeCertificateAccessLink(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); const linkId = text(formData, "linkId", 64);
  if (!admin || !linkId) return;
  await admin.from("certificate_access_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "certificate_access_link.revoked", entity_type: "certificate_access_link", entity_id: linkId, details: {} });
}
