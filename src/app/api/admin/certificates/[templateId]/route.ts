import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, isApiError, readJsonBody, requireEditorApi } from "@/lib/admin-api";
import { loadCertificateTemplate, normalizeRichContent, PDF_SAFE_FONTS } from "@/lib/certificate-editor";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const pageSchema = z.object({ id: z.string().uuid(), width: z.number().min(100).max(10000), height: z.number().min(100).max(10000) });
const blockSchema = z.object({ id: z.string().uuid().optional(), pageId: z.string().uuid(), type: z.enum(["text", "image"]), content: z.unknown(), x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(), rotation: z.number().optional(), zIndex: z.number().int().optional(), style: z.record(z.string(), z.unknown()).optional(), overflowBehavior: z.enum(["auto_height", "auto_fit", "manual"]).optional(), locked: z.boolean().optional(), assetBucket: z.string().nullable().optional(), assetPath: z.string().nullable().optional() });
const saveSchema = z.object({ name: z.string().trim().min(1).max(160).optional(), pages: z.array(pageSchema).length(6), blocks: z.array(blockSchema) });

export async function GET(_: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  try { const template = await loadCertificateTemplate(admin, (await params).templateId); return template ? NextResponse.json({ template }) : NextResponse.json({ error: "Template not found." }, { status: 404 }); }
  catch (error) { return apiErrorResponse(error, "Could not load the certificate template."); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const user = await requireEditorApi(); if (isApiError(user)) return user;
  const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Certificate service is temporarily unavailable." }, { status: 503 });
  const body = await readJsonBody(request); if (body instanceof NextResponse) return body;
  try {
    const input = saveSchema.parse(body); const templateId = (await params).templateId;
    const existing = await admin.from("certificate_template_pages").select("id").eq("template_id", templateId);
    if (existing.error || existing.data?.length !== 6) throw new Error(existing.error?.message || "A General Template must always have six pages.");
    const allowedPages = new Set(existing.data.map((page) => page.id));
    if (input.pages.some((page) => !allowedPages.has(page.id)) || input.blocks.some((block) => !allowedPages.has(block.pageId))) throw new Error("A layout item belongs to a different template.");
    const unsafeFont = input.blocks.some((block) => typeof block.style?.fontFamily === "string" && !PDF_SAFE_FONTS.includes(block.style.fontFamily as typeof PDF_SAFE_FONTS[number]));
    if (unsafeFont) throw new Error("Use Helvetica, Times-Roman, or Courier so the official PDF can embed the selected font.");
    const updateTemplate = await admin.from("certificate_templates").update({ ...(input.name ? { name: input.name } : {}), version: (await admin.from("certificate_templates").select("version").eq("id", templateId).single()).data?.version + 1 }).eq("id", templateId);
    if (updateTemplate.error) throw new Error(updateTemplate.error.message);
    await Promise.all(input.pages.map((page) => admin.from("certificate_template_pages").update({ width: page.width, height: page.height }).eq("id", page.id)));
    const remove = await admin.from("certificate_text_blocks").delete().in("page_id", [...allowedPages]); if (remove.error) throw new Error(remove.error.message);
    if (input.blocks.length) {
      const inserted = await admin.from("certificate_text_blocks").insert(input.blocks.map((block) => ({
        page_id: block.pageId, block_type: block.type, content: normalizeRichContent(block.content), x: block.x, y: block.y, width: block.width, height: block.height, rotation: block.rotation ?? 0, z_index: block.zIndex ?? 0, style: block.style || {}, overflow_behavior: block.overflowBehavior ?? "auto_fit", locked: block.locked ?? false, asset_bucket: block.assetBucket || null, asset_path: block.assetPath || null,
      }))); if (inserted.error) throw new Error(inserted.error.message);
    }
    const template = await loadCertificateTemplate(admin, templateId); return NextResponse.json({ template });
  } catch (error) { return apiErrorResponse(error, "Could not save the certificate layout."); }
}
