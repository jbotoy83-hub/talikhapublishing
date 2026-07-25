import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { certificateBlockText, resolveCertificateText, type CertificateBlock } from "@/lib/certificates";

type Template = { background_bucket?: string | null; background_path?: string | null } | null | undefined;
type Download = { data: Blob | null; error: unknown };
type Admin = { storage: { from: (bucket: string) => { download: (path: string) => Promise<Download> } } };

type RenderBlock = CertificateBlock & { pageNumber?: number; assetBucket?: string | null; assetPath?: string | null };

const hex = (value: unknown) => {
  const match = String(value || "#152b21").match(/^#([\da-f]{6})$/i);
  if (!match) return rgb(.08, .17, .13);
  const number = Number.parseInt(match[1], 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
};

export async function renderCertificatePdf({ admin, template, values, blocks = [], recordId }: { admin: Admin; template: Template; values: Record<string, unknown>; blocks?: RenderBlock[]; recordId: string }) {
  const warnings: string[] = [];
  let pdf: PDFDocument;
  if (template?.background_path && template.background_bucket) {
    const { data, error } = await admin.storage.from(template.background_bucket).download(template.background_path);
    if (error || !data) warnings.push("The template background is unavailable.");
    pdf = !error && data ? await PDFDocument.load(await data.arrayBuffer()) : await PDFDocument.create();
  } else pdf = await PDFDocument.create();
  if (!pdf.getPageCount()) for (let i = 0; i < 6; i += 1) pdf.addPage([595, 842]);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  for (const block of [...blocks].sort((a, b) => a.zIndex - b.zIndex)) {
    const pageIndex = Number(block.pageNumber || String(block.pageId).match(/(\d+)$/)?.[1]) - 1;
    const page = pages[pageIndex];
    if (!page) { warnings.push("A block is assigned to an unavailable page."); continue; }
    if (block.x < 0 || block.y < 0 || block.x + block.width > page.getWidth() || block.y + block.height > page.getHeight()) { warnings.push("A block extends beyond the certificate page."); continue; }
    const style = block.style || {};
    if (block.blockType === "image" && block.assetBucket && block.assetPath) {
      const { data } = await admin.storage.from(block.assetBucket).download(block.assetPath);
      if (!data) { warnings.push("An image block is unavailable."); continue; }
      const bytes = await data.arrayBuffer();
      const image = /\.jpe?g$/i.test(block.assetPath) ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      page.drawImage(image, { x: block.x, y: page.getHeight() - block.y - block.height, width: block.width, height: block.height, rotate: degrees(-block.rotation || 0), opacity: Number(style.opacity ?? 1) });
      continue;
    }
    const content = resolveCertificateText(certificateBlockText(block.content), values).trim();
    if (!content) { warnings.push("A text block has no resolved content."); continue; }
    const size = Math.max(6, Number(style.fontSize || 24));
    const font = Number(style.fontWeight || 400) >= 600 ? bold : regular;
    page.drawText(content, { x: block.x, y: page.getHeight() - block.y - size, size, maxWidth: block.width, lineHeight: Number(style.lineHeight || size * 1.25), font, color: hex(style.color), rotate: degrees(-block.rotation || 0), opacity: Number(style.opacity ?? 1) });
  }
  const footer = `Certificate reference ${String(values.reference_number || values.certificate_number || recordId)}`;
  pdf.getPage(0).drawText(footer, { x: 28, y: 24, size: 7, font: regular, color: rgb(.4, .4, .4), opacity: .55 });
  return { pdfBytes: await pdf.save(), warnings };
}
