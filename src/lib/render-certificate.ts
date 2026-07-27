import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { certificateBlockText, resolveCertificateContent, type CertificateBlock } from "@/lib/certificates";

type Template = { background_bucket?: string | null; background_path?: string | null } | null | undefined;
type Download = { data: Blob | null; error: unknown };
type Admin = { storage: { from: (bucket: string) => { download: (path: string) => Promise<Download> } } };

type RenderBlock = CertificateBlock & { pageNumber?: number; assetBucket?: string | null; assetPath?: string | null };
type RenderPage = { pageNumber: number; width: number; height: number; backgroundBucket?: string | null; backgroundPath?: string | null; backgroundMimeType?: string | null };

const hex = (value: unknown) => {
  const match = String(value || "#152b21").match(/^#([\da-f]{6})$/i);
  if (!match) return rgb(.08, .17, .13);
  const number = Number.parseInt(match[1], 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
};

function wrappedLines(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number) {
  return text.split(/\n/).flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean); const lines: string[] = []; let line = "";
    for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && font.widthOfTextAtSize(next, size) > maxWidth) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line); return lines.length ? lines : [""];
  });
}

export async function renderCertificatePdf({ admin, template, values, blocks = [], pages: renderPages, customFonts = [], recordId }: { admin: Admin; template: Template; values: Record<string, unknown>; blocks?: RenderBlock[]; pages?: RenderPage[]; customFonts?: Array<{ family: string; weight: number; storage_bucket: string; storage_path: string }>; recordId: string }) {
  const warnings: string[] = [];
  let pdf: PDFDocument;
  if (template?.background_path && template.background_bucket) {
    const { data, error } = await admin.storage.from(template.background_bucket).download(template.background_path);
    if (error || !data) warnings.push("The template background is unavailable.");
    pdf = !error && data ? await PDFDocument.load(await data.arrayBuffer()) : await PDFDocument.create();
  } else pdf = await PDFDocument.create();
  if (!pdf.getPageCount()) for (const item of renderPages?.length ? [...renderPages].sort((a, b) => a.pageNumber - b.pageNumber) : Array.from({ length: 6 }, (_, index) => ({ pageNumber: index + 1, width: 842, height: 595 }))) pdf.addPage([item.width * .75, item.height * .75]);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.registerFontkit(fontkit);
  const embeddedFonts = new Map<string, Awaited<ReturnType<typeof pdf.embedFont>>>();
  for (const custom of customFonts) {
    const { data } = await admin.storage.from(custom.storage_bucket).download(custom.storage_path);
    if (!data) { warnings.push(`${custom.family} is unavailable; Helvetica will be used.`); continue; }
    try { embeddedFonts.set(`${custom.family}:${custom.weight}`, await pdf.embedFont(await data.arrayBuffer(), { subset: true })); }
    catch { warnings.push(`${custom.family} could not be embedded; Helvetica will be used.`); }
  }
  const pages = pdf.getPages();
  if (renderPages?.length) for (const item of renderPages) {
    const page = pages[item.pageNumber - 1]; if (!page || !item.backgroundBucket || !item.backgroundPath) continue;
    const { data } = await admin.storage.from(item.backgroundBucket).download(item.backgroundPath);
    if (!data) { warnings.push(`Background for page ${item.pageNumber} is unavailable.`); continue; }
    const bytes = await data.arrayBuffer(); const image = item.backgroundMimeType === "image/jpeg" || /\.jpe?g$/i.test(item.backgroundPath) ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  for (const block of [...blocks].sort((a, b) => a.zIndex - b.zIndex)) {
    const pageIndex = Number(block.pageNumber || String(block.pageId).match(/(\d+)$/)?.[1]) - 1;
    const page = pages[pageIndex];
    if (!page) { warnings.push("A block is assigned to an unavailable page."); continue; }
    const logicalPage = renderPages?.find((item) => item.pageNumber === pageIndex + 1);
    const scale = logicalPage ? page.getWidth() / logicalPage.width : 1;
    if (block.x < 0 || block.y < 0 || block.x + block.width > (logicalPage?.width ?? page.getWidth()) || block.y + block.height > (logicalPage?.height ?? page.getHeight())) { warnings.push("A block extends beyond the certificate page."); continue; }
    const style = block.style || {};
    if (block.blockType === "image" && block.assetBucket && block.assetPath) {
      const { data } = await admin.storage.from(block.assetBucket).download(block.assetPath);
      if (!data) { warnings.push("An image block is unavailable."); continue; }
      const bytes = await data.arrayBuffer();
      const image = /\.jpe?g$/i.test(block.assetPath) ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      page.drawImage(image, { x: block.x * scale, y: page.getHeight() - (block.y + block.height) * scale, width: block.width * scale, height: block.height * scale, rotate: degrees(-block.rotation || 0), opacity: Number(style.opacity ?? 1) });
      continue;
    }
    const content = resolveCertificateContent(block.content, values).map((segment) => segment.text).join("").trim();
    if (!content) { warnings.push("A text block has no resolved content."); continue; }
    let size = Math.max(6, Number(style.fontSize || 24)) * scale;
    const requestedWeight = Number(style.fontWeight || 400) >= 600 ? 700 : 400;
    const font = embeddedFonts.get(`${String(style.fontFamily || "")}:${requestedWeight}`) || embeddedFonts.get(`${String(style.fontFamily || "")}:400`) || (requestedWeight >= 600 ? bold : regular);
    const lineHeight = Math.max(size * 1.1, Number(style.lineHeight || size * 1.25) * scale);
    let lines = wrappedLines(content, font, size, block.width * scale);
    while (lines.length * lineHeight > block.height * scale && size > 6 * scale) { size -= .5; lines = wrappedLines(content, font, size, block.width * scale); }
    if (lines.length * lineHeight > block.height * scale) warnings.push("A text block could not fit without clipping.");
    const visible = lines.slice(0, Math.floor((block.height * scale) / lineHeight));
    visible.forEach((line, index) => {
      const lineWidth = font.widthOfTextAtSize(line, size); const alignment = String(style.textAlign || "left");
      const x = block.x * scale + (alignment === "center" ? Math.max(0, (block.width * scale - lineWidth) / 2) : alignment === "right" ? Math.max(0, block.width * scale - lineWidth) : 0);
      page.drawText(line, { x, y: page.getHeight() - block.y * scale - size - index * lineHeight, size, font, color: hex(style.color), rotate: degrees(-block.rotation || 0), opacity: Number(style.opacity ?? 1) });
    });
  }
  const footer = `Certificate reference ${String(values.reference_number || values.certificate_number || recordId)}`;
  pdf.getPage(0).drawText(footer, { x: 28, y: 24, size: 7, font: regular, color: rgb(.4, .4, .4), opacity: .55 });
  return { pdfBytes: await pdf.save(), warnings };
}
