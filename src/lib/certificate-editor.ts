import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const CERTIFICATE_ASSET_BUCKET = "certificate-assets";
export const PDF_SAFE_FONTS = ["Helvetica", "Times-Roman", "Courier", "Oswald", "Glacial Indifference"] as const;

type Row = Record<string, unknown>;

function number(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function normalizeRichContent(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const input = value as { type?: unknown; segments?: unknown };
    if (input.type === "rich_text" && Array.isArray(input.segments)) {
      const segments: Array<{ t: "s"; v: string; style?: object } | { t: "f"; k: string; style?: object }> = [];
      for (const segment of input.segments) {
        if (!segment || typeof segment !== "object" || Array.isArray(segment)) continue;
        const item = segment as { t?: unknown; v?: unknown; k?: unknown; style?: unknown };
        if (item.t === "s" && typeof item.v === "string") segments.push({ t: "s", v: item.v.slice(0, 20000), ...(item.style && typeof item.style === "object" ? { style: item.style } : {}) });
        if (item.t === "f" && typeof item.k === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(item.k)) segments.push({ t: "f", k: item.k, ...(item.style && typeof item.style === "object" ? { style: item.style } : {}) });
      }
      return {
        type: "rich_text",
        segments,
      };
    }
  }
  return { type: "rich_text", segments: [{ t: "s", v: text(value) }] };
}

export function mapTemplate(template: Row, pages: Row[], fields: Row[], blocks: Row[], signedUrls: Map<string, string>, fonts: Row[] = []) {
  const mappedPages = pages.map((page) => ({
    id: text(page.id),
    pageNumber: number(page.page_number, 1),
    name: `Page ${number(page.page_number, 1)}`,
    pageType: text(page.page_type, "certificate"),
    width: number(page.width, 842),
    height: number(page.height, 595),
    safeMargin: 32,
    backgroundImageUrl: page.background_path ? signedUrls.get(`${text(page.background_bucket, CERTIFICATE_ASSET_BUCKET)}:${text(page.background_path)}`) : undefined,
    backgroundBucket: page.background_bucket ?? null,
    backgroundPath: page.background_path ?? null,
    backgroundMimeType: page.background_mime_type ?? null,
    backgroundOriginalName: page.background_original_name ?? null,
  }));

  return {
    id: text(template.id),
    name: text(template.name),
    status: text(template.status, "draft"),
    isDefault: Boolean(template.is_default),
    version: number(template.version, 1),
    updatedAt: text(template.updated_at),
    pages: mappedPages,
    fields: fields.map((field) => ({
      key: text(field.field_key), label: text(field.label), type: text(field.field_type, "text"),
      required: Boolean(field.required), section: text(field.section, "custom"), defaultValue: text(field.default_value),
    })),
    blocks: blocks.map((block) => {
      const content = normalizeRichContent(block.content);
      const rawStyle = block.style && typeof block.style === "object" ? block.style as Record<string, unknown> : {};
      const fontSize = number(rawStyle.fontSize, 18);
      const rawLineHeight = number(rawStyle.lineHeight, 1.4);
      // Older seeded blocks stored a pixel line height; the canvas uses the CSS
      // unitless multiplier form, so convert values such as 25px at 18px text.
      const lineHeight = rawLineHeight > 4 ? Math.max(1.1, rawLineHeight / fontSize) : rawLineHeight;
      return {
      id: text(block.id), pageId: text(block.page_id), type: text(block.block_type, "text"),
      content: content.segments.map((segment) => segment.t === "f" ? `{{${"k" in segment ? segment.k : ""}}}` : ("v" in segment ? segment.v : "")).join(""), segments: content.segments, x: number(block.x, 0), y: number(block.y, 0),
      width: number(block.width, 300), height: number(block.height, 48), rotation: number(block.rotation, 0),
      zIndex: number(block.z_index, 0), style: { ...rawStyle, lineHeight },
      overflowBehavior: text(block.overflow_behavior, "auto_fit"), locked: Boolean(block.locked),
      hidden: false, name: text(block.name, "Text"), imageShape: rawStyle.imageShape === "circle" ? "circle" : "rectangle", assetBucket: block.asset_bucket ?? null,
      assetPath: block.asset_path ?? null, assetUrl: block.asset_path ? signedUrls.get(`${text(block.asset_bucket, CERTIFICATE_ASSET_BUCKET)}:${text(block.asset_path)}`) : undefined,
    };
    }),
    fonts: fonts.map((font) => ({ family: text(font.family), weight: number(font.weight, 400), style: text(font.style, "normal"), url: signedUrls.get(`${text(font.storage_bucket, CERTIFICATE_ASSET_BUCKET)}:${text(font.storage_path)}`) || "" })).filter((font) => font.url),
  };
}

export async function loadCertificateTemplate(admin: SupabaseClient, templateId: string) {
  const templateResult = await admin.from("certificate_templates").select("*").eq("id", templateId).maybeSingle();
  if (templateResult.error) throw new Error(templateResult.error.message);
  if (!templateResult.data) return null;
  const [pagesResult, fieldsResult, fontsResult] = await Promise.all([
    admin.from("certificate_template_pages").select("*").eq("template_id", templateId).order("page_number"),
    admin.from("certificate_template_fields").select("*").eq("template_id", templateId).order("label"),
    admin.from("certificate_fonts").select("family,weight,style,storage_bucket,storage_path").eq("active", true).eq("embedding_allowed", true),
  ]);
  if (pagesResult.error || fieldsResult.error || fontsResult.error) throw new Error(pagesResult.error?.message || fieldsResult.error?.message || fontsResult.error?.message);
  const pageIds = (pagesResult.data || []).map((page) => page.id);
  const blocksResult = pageIds.length
    ? await admin.from("certificate_text_blocks").select("*").in("page_id", pageIds).order("z_index")
    : { data: [], error: null };
  if (blocksResult.error) throw new Error(blocksResult.error.message);
  const assets = [...(pagesResult.data || []), ...(blocksResult.data || []), ...(fontsResult.data || [])]
    .flatMap((row) => row.background_path ? [[text(row.background_bucket, CERTIFICATE_ASSET_BUCKET), text(row.background_path)]] : row.asset_path ? [[text(row.asset_bucket, CERTIFICATE_ASSET_BUCKET), text(row.asset_path)]] : row.storage_path ? [[text(row.storage_bucket, CERTIFICATE_ASSET_BUCKET), text(row.storage_path)]] : []) as [string, string][];
  const signedUrls = new Map<string, string>();
  await Promise.all(assets.map(async ([bucket, path]) => {
    const result = await admin.storage.from(bucket).createSignedUrl(path, 60 * 30);
    if (result.data?.signedUrl) signedUrls.set(`${bucket}:${path}`, result.data.signedUrl);
  }));
  return mapTemplate(templateResult.data, pagesResult.data || [], fieldsResult.data || [], blocksResult.data || [], signedUrls, fontsResult.data || []);
}
