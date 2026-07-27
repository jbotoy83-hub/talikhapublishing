
export const certificateFieldCatalog = [
  ["author_name", "Author name", "text"], ["author_role", "Author role", "text"],
  ["work_title", "Work title", "text"], ["publication_name", "Publication name", "text"],
  ["volume_number", "Volume", "text"], ["issue_number", "Issue", "text"],
  ["issue_date", "Issue date", "text"], ["date_issued", "Date issued", "date"],
  ["doi", "DOI", "doi"], ["certificate_number", "Certificate number", "certificate_number"],
  ["publisher_name", "Publisher", "text"], ["issuing_city", "Issuing city", "text"]
] as const;

export type CertificateFieldKey = (typeof certificateFieldCatalog)[number][0];
export type TextTransform = "none" | "uppercase" | "lowercase" | "titlecase";
export type OverflowBehavior = "auto_height" | "auto_fit" | "manual";
export type LinkedField = { fieldKey: CertificateFieldKey; prefix?: string; suffix?: string; textTransform?: TextTransform };
export type CertificateBlockType = "text" | "image";
export type CertificateBlock = { id: string; pageId: string; content: unknown; x: number; y: number; width: number; height: number; rotation: number; zIndex: number; style: Record<string, unknown>; overflowBehavior: OverflowBehavior; locked: boolean; blockType?: CertificateBlockType; assetBucket?: string | null; assetPath?: string | null };
export type CertificateTextSegment = { t: "s"; v: string; style?: Record<string, unknown> } | { t: "f"; k: string; style?: Record<string, unknown> };

export function certificateSegments(content: unknown): CertificateTextSegment[] {
  const rich = content as { type?: string; segments?: CertificateTextSegment[] };
  if (rich?.type === "rich_text" && Array.isArray(rich.segments)) return rich.segments;
  const text = certificateBlockText(content);
  const segments: CertificateTextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/gi)) {
    if (match.index! > cursor) segments.push({ t: "s", v: text.slice(cursor, match.index) });
    segments.push({ t: "f", k: match[1] });
    cursor = match.index! + match[0].length;
  }
  if (cursor < text.length) segments.push({ t: "s", v: text.slice(cursor) });
  return segments.length ? segments : [{ t: "s", v: text }];
}

export function certificateBlockText(content: unknown) {
  const rich = content as { type?: string; segments?: CertificateTextSegment[] };
  if (rich?.type === "rich_text" && Array.isArray(rich.segments)) return rich.segments.map((segment) => segment.t === "f" ? `{{${segment.k}}}` : segment.v).join("");
  const document = content as { content?: Array<{ content?: Array<{ text?: string }> }> };
  return document?.content?.flatMap((paragraph) => paragraph.content || []).map((node) => node.text || "").join(" ") || "";
}

export function resolveCertificateText(value: string, fields: Record<string, unknown>) {
  return value.replace(/\{\{([a-z][a-z0-9_]*)\}\}/gi, (_, key: string) => String(fields[key] ?? ""));
}

export function resolveCertificateContent(content: unknown, fields: Record<string, unknown>) {
  return certificateSegments(content).map((segment) => ({
    text: segment.t === "f" ? String(fields[segment.k] ?? "") : segment.v,
    style: segment.style || {}
  }));
}

export function normalizeDoi(value: string) {
  return value.trim().replace(/^https?:\/\/doi\.org\//i, "").replace(/\s+/g, "");
}

export function validDoi(value: string) {
  return !value || /^10\.\d{4,9}\/.+$/i.test(normalizeDoi(value));
}

export function formatCertificateValue(value: string, rule: LinkedField) {
  const transformed = rule.textTransform === "uppercase" ? value.toLocaleUpperCase() : rule.textTransform === "lowercase" ? value.toLocaleLowerCase() : rule.textTransform === "titlecase" ? value.toLocaleLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase()) : value;
  return `${rule.prefix || ""}${transformed}${rule.suffix || ""}`;
}

export function blockOverflows(block: Pick<CertificateBlock, "x" | "y" | "width" | "height">, pageWidth: number, pageHeight: number) {
  return block.x < 0 || block.y < 0 || block.x + block.width > pageWidth || block.y + block.height > pageHeight;
}
