
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

export function certificateBlockText(content: unknown) {
  const document = content as { content?: Array<{ content?: Array<{ text?: string }> }> };
  return document?.content?.flatMap((paragraph) => paragraph.content || []).map((node) => node.text || "").join(" ") || "";
}

export function resolveCertificateText(value: string, fields: Record<string, unknown>) {
  return value.replace(/\{\{([a-z][a-z0-9_]*)\}\}/gi, (_, key: string) => String(fields[key] ?? ""));
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
