import type {
  CertificateTemplate,
  CertificatePage,
  CertificateBlock,
  CertificateRecord,
  CertificateField,
  ValidationResult,
  ValidationCheck,
  TextTransform,
  BlockStyle,
  TextSegment,
} from "./types";
import { DEFAULT_FIELDS, DEFAULT_PAGE_NAMES, DEFAULT_BLOCK_STYLE, A4_LANDSCAPE, STORAGE_KEYS, CERT_FONTS } from "./types";

let _idCounter = 0;
export function uid(): string {
  return `cb-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}

/* ── Text resolution ── */

export function applyTransform(text: string, transform: TextTransform): string {
  switch (transform) {
    case "uppercase": return text.toUpperCase();
    case "lowercase": return text.toLowerCase();
    case "titlecase": return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default: return text;
  }
}

export function formatValue(
  raw: string,
  transform?: TextTransform,
  prefix?: string,
  suffix?: string,
): string {
  let out = raw;
  if (transform && transform !== "none") out = applyTransform(out, transform);
  if (prefix) out = prefix + out;
  if (suffix) out = out + suffix;
  return out;
}

export function contentToSegments(content: string): TextSegment[] {
  const segs: TextSegment[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) segs.push({ t: "s", v: content.slice(last, m.index) });
    segs.push({ t: "f", k: m[1] });
    last = m.index + m[0].length;
  }
  if (last < content.length) segs.push({ t: "s", v: content.slice(last) });
  if (segs.length === 0) segs.push({ t: "s", v: "" });
  return segs;
}

export function segmentsToContent(segs: TextSegment[]): string {
  return segs.map((s) => (s.t === "f" ? `{{${s.k}}}` : s.v)).join("");
}

export function segmentsToPlainText(segs: TextSegment[], fieldValues: Record<string, string>): string {
  return segs.map((s) => (s.t === "f" ? (fieldValues[s.k] ?? "") : s.v)).join("");
}

export function segmentsToBuilderText(segs: TextSegment[], labelOf: (k: string) => string): string {
  return segs.map((s) => (s.t === "f" ? `«${labelOf(s.k)}»` : s.v)).join("");
}

export function normalizeSegments(segs: TextSegment[]): TextSegment[] {
  const out: TextSegment[] = [];
  for (const s of segs) {
    if (s.t === "s") {
      if (s.v === "") continue;
      const prev = out[out.length - 1];
      const sk = s.style ? JSON.stringify(s.style) : "";
      const pk = prev && prev.t === "s" ? (prev.style ? JSON.stringify(prev.style) : "") : null;
      if (prev && prev.t === "s" && pk === sk) prev.v += s.v;
      else out.push({ t: "s", v: s.v, style: s.style });
    } else {
      out.push({ t: "f", k: s.k });
    }
  }
  return out.length ? out : [{ t: "s", v: "" }];
}

export function resolveText(
  content: string,
  fieldValues: Record<string, string>,
  block?: CertificateBlock,
): string {
  if (block?.segments && block.segments.length) {
    let text = segmentsToPlainText(block.segments, fieldValues);
    if (block.linkedFieldKey) {
      const val = fieldValues[block.linkedFieldKey] ?? "";
      text = formatValue(val, block.style.textTransform, block.prefix, block.suffix);
    }
    return text;
  }
  let text = content;
  text = text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = fieldValues[key] ?? "";
    return val;
  });
  if (block?.linkedFieldKey) {
    const val = fieldValues[block.linkedFieldKey] ?? "";
    text = formatValue(val, block.style.textTransform, block.prefix, block.suffix);
  }
  return text;
}

export function resolveAllBlocks(
  blocks: CertificateBlock[],
  fieldValues: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of blocks) {
    if (b.type === "text") {
      map.set(b.id, resolveText(b.content, fieldValues, b));
    }
  }
  return map;
}

export function resolveSegments(
  segs: TextSegment[],
  fieldValues: Record<string, string>,
): { text: string; style?: Partial<BlockStyle> }[] {
  const out: { text: string; style?: Partial<BlockStyle> }[] = [];
  for (const s of segs) {
    if (s.t === "f") {
      const val = fieldValues[s.k] ?? "";
      out.push({ text: val, style: undefined });
    } else {
      out.push({ text: s.v, style: s.style });
    }
  }
  return out;
}

/* ── Auto-fit ──
   measureTextFit runs for every text block on every canvas render, so it is on the
   hot path. Two cheap wins that keep the result bit-identical:
   1. Reuse ONE offscreen canvas + 2D context for the lifetime of the page instead of
      allocating a fresh <canvas> per call (the old code created + GC'd one each time).
   2. Memoize by the full input set. When one block is edited, every OTHER block's
      inputs are unchanged, so they resolve from cache with zero measurement work.
   The cache is bounded (FIFO) so it cannot grow without limit. */

let _measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!_measureCtx) {
    const c = document.createElement("canvas");
    _measureCtx = c.getContext("2d");
  }
  return _measureCtx;
}

type FitResult = { fittedSize: number; overflows: boolean; lines: number };
const _fitCache = new Map<string, FitResult>();
const _FIT_CACHE_MAX = 512;

export function measureTextFit(
  text: string,
  maxWidth: number,
  maxHeight: number,
  fontSize: number,
  lineHeight: number,
  fontFamily: string,
  fontWeight: number,
  fontStyle: string,
  letterSpacing: number,
  minFontSize: number = 8,
): FitResult {
  const ctx = getMeasureCtx();
  if (!ctx) return { fittedSize: fontSize, overflows: false, lines: 1 };

  const key =
    maxWidth + "|" + maxHeight + "|" + fontSize + "|" + lineHeight + "|" +
    fontFamily + "|" + fontWeight + "|" + fontStyle + "|" + letterSpacing + "|" + minFontSize + "|" + text;
  const cached = _fitCache.get(key);
  if (cached) return cached;

  const words = text.split(/\s+/);
  let size = fontSize;
  let result: FitResult = { fittedSize: minFontSize, overflows: true, lines: 0 };
  while (size >= minFontSize) {
    ctx.font = (fontStyle === "italic" ? "italic " : "") + fontWeight + " " + size + "px " + fontFamily;
    let lines = 1;
    let currentLine = "";
    for (const word of words) {
      const test = currentLine ? currentLine + " " + word : word;
      const metrics = ctx.measureText(test);
      const w = metrics.width + (test.length - 1) * letterSpacing;
      if (w > maxWidth && currentLine) {
        lines++;
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (lines * size * lineHeight <= maxHeight) {
      result = { fittedSize: size, overflows: false, lines };
      break;
    }
    size -= 0.5;
  }

  if (_fitCache.size >= _FIT_CACHE_MAX) {
    const first = _fitCache.keys().next().value;
    if (first !== undefined) _fitCache.delete(first);
  }
  _fitCache.set(key, result);
  return result;
}

export function validateDoi(doi: string): boolean {
  if (!doi) return true;
  return /^10\.\d{4,9}\/[^\s]+$/.test(doi.trim());
}

export function validateCertificate(
  template: CertificateTemplate,
  fieldValues: Record<string, string>,
  currentPageId?: string,
): ValidationResult {
  const checks: ValidationCheck[] = [];
  const pages = currentPageId ? template.pages.filter((p) => p.id === currentPageId) : template.pages;
  const blocks = currentPageId ? template.blocks.filter((b) => b.pageId === currentPageId) : template.blocks;

  for (const field of template.fields) {
    if (field.required && !fieldValues[field.key]?.trim()) {
      checks.push({ id: `req-${field.key}`, label: `Required: ${field.label}`, status: "error", message: `"${field.label}" is empty.` });
    }
  }

  const doiVal = fieldValues["doi"];
  if (doiVal && !validateDoi(doiVal)) {
    checks.push({ id: "doi-format", label: "DOI format", status: "error", message: `DOI "${doiVal}" does not match the expected format (10.XXXX/...).` });
  }

  const certNum = fieldValues["certificate_number"];
  if (certNum && certNum.trim().length < 3) {
    checks.push({ id: "cert-num", label: "Certificate number", status: "warn", message: "Certificate number seems too short." });
  }

  for (const page of pages) {
    if (!page.backgroundImageUrl && !page.backgroundPdfPage && page.pageNumber > 0) {
      checks.push({ id: `bg-${page.id}`, label: `Background: ${page.name}`, status: "warn", message: `Page "${page.name}" has no background image.`, pageId: page.id });
    }
  }

  for (const block of blocks) {
    if (block.type === "text" && block.linkedFieldKey && !fieldValues[block.linkedFieldKey]?.trim()) {
      checks.push({ id: `empty-link-${block.id}`, label: `Empty linked field on ${block.name}`, status: "warn", message: `Block "${block.name}" links to "{{${block.linkedFieldKey}}}" which is empty.`, pageId: block.pageId, blockId: block.id });
    }
    if (block.autoFitWarning) {
      checks.push({ id: `overflow-${block.id}`, label: `Overflow: ${block.name}`, status: "warn", message: block.autoFitWarning, pageId: block.pageId, blockId: block.id });
    }
    const margin = pages.find((p) => p.id === block.pageId)?.safeMargin ?? 0;
    if (margin > 0) {
      const page = pages.find((p) => p.id === block.pageId);
      if (page && (block.x < margin || block.y < margin || block.x + block.width > page.width - margin || block.y + block.height > page.height - margin)) {
        checks.push({ id: `margin-${block.id}`, label: `Safe margin: ${block.name}`, status: "warn", message: `Block "${block.name}" extends beyond the safe margin.`, pageId: block.pageId, blockId: block.id });
      }
    }
  }

  const fieldKeys = new Set(template.fields.map((f) => f.key));
  for (const block of blocks) {
    if (block.type === "text") {
      const tokens = block.content.match(/\{\{(\w+)\}\}/g) || [];
      for (const t of tokens) {
        const key = t.slice(2, -2);
        if (!fieldKeys.has(key)) {
          checks.push({ id: `unknown-${block.id}-${key}`, label: `Unknown field: ${key}`, status: "error", message: `Block "${block.name}" references "{{${key}}}" which is not a defined field.`, pageId: block.pageId, blockId: block.id });
        }
      }
      if (block.segments) {
        for (const seg of block.segments) {
          if (seg.t === "f" && !fieldKeys.has(seg.k)) {
            checks.push({ id: `unknown-seg-${block.id}-${seg.k}`, label: `Unknown field: ${seg.k}`, status: "error", message: `Block "${block.name}" references an undefined field "${seg.k}".`, pageId: block.pageId, blockId: block.id });
          }
        }
      }
    }
  }

  const errors = checks.filter((c) => c.status === "error").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const passed = checks.filter((c) => c.status === "pass").length;

  return { checks, errors, warnings, passed, canExport: errors === 0 };
}

/* ── Certificate numbering ── */

export function generateCertificateNumber(prefix: string, sequence: number, year: number): string {
  const seq = String(sequence).padStart(4, "0");
  const yr = String(year).slice(-2);
  return `${prefix}-${seq}${yr}`;
}

export function parseCertificateNumber(num: string): { prefix: string; sequence: number; year: number } | null {
  const m = num.match(/^([A-Z]+)-(\d+)(\d{2})$/);
  if (!m) return null;
  return { prefix: m[1], sequence: parseInt(m[2], 10), year: 2000 + parseInt(m[3], 10) };
}

/* ── Field usage ── */

export function getFieldUsage(template: CertificateTemplate, fieldKey: string): { count: number; pages: string[] } {
  const pages = new Set<string>();
  let count = 0;
  for (const block of template.blocks) {
    if (block.linkedFieldKey === fieldKey) {
      count++;
      pages.add(block.pageId);
    }
    if (block.type === "text" && block.content.includes(`{{${fieldKey}}}`)) {
      count++;
      pages.add(block.pageId);
    }
  }
  return { count, pages: Array.from(pages) };
}

/* ── Factory functions ── */

export function createDefaultTemplate(name: string, publication: string, pageCount: number = 6): CertificateTemplate {
  const pages: CertificatePage[] = [];
  for (let i = 0; i < pageCount; i++) {
    const def = DEFAULT_PAGE_NAMES[i] || { name: `Page ${i + 1}`, type: "certificate" as const };
    pages.push({
      id: uid(),
      pageNumber: i + 1,
      name: def.name,
      pageType: def.type,
      width: A4_LANDSCAPE.width,
      height: A4_LANDSCAPE.height,
      safeMargin: 36,
    });
  }
  return {
    id: uid(),
    name,
    publication,
    version: 1,
    status: "draft",
    pages,
    fields: [...DEFAULT_FIELDS],
    blocks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    certificateNumberPrefix: publication.slice(0, 3).toUpperCase() || "CRT",
    certificateNumberSequence: 1,
    certificateNumberYear: new Date().getFullYear(),
  };
}

export function createDefaultRecord(template: CertificateTemplate, submissionId?: string, reference?: string): CertificateRecord {
  const fieldValues: Record<string, string> = {};
  for (const f of template.fields) {
    fieldValues[f.key] = f.defaultValue || "";
  }
  const certNum = generateCertificateNumber(
    template.certificateNumberPrefix,
    template.certificateNumberSequence,
    template.certificateNumberYear,
  );
  fieldValues["certificate_number"] = certNum;
  fieldValues["date_issued"] = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return {
    id: uid(),
    templateId: template.id,
    templateVersion: template.version,
    submissionId,
    reference,
    fieldValues,
    status: "draft",
    certificateNumber: certNum,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* ── localStorage persistence ── */

export function loadTemplates(): CertificateTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.templates);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).map((t: CertificateTemplate) => ({
      ...t,
      pages: Array.isArray(t.pages) ? t.pages : [],
      blocks: Array.isArray(t.blocks) ? t.blocks : [],
      fields: Array.isArray(t.fields) && t.fields.length ? t.fields : [...DEFAULT_FIELDS],
    }));
  } catch { return []; }
}

export function saveTemplates(templates: CertificateTemplate[]): void {
  localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
}

export function loadRecords(): CertificateRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.records);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveRecords(records: CertificateRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
}

/* ── Block helpers ── */

export function createTextBlock(pageId: string, x: number, y: number, content: string = "New text"): CertificateBlock {
  return {
    id: uid(),
    pageId,
    type: "text",
    content,
    segments: [{ t: "s", v: content }],
    linkedFieldKey: null,
    x, y,
    width: 240,
    height: 48,
    rotation: 0,
    zIndex: 1,
    style: { ...DEFAULT_BLOCK_STYLE },
    overflowBehavior: "keep",
    locked: false,
    hidden: false,
    name: "Text",
    minFontSize: 8,
  };
}

export function createLinkedBlock(pageId: string, fieldKey: string, x: number, y: number): CertificateBlock {
  const field = DEFAULT_FIELDS.find((f) => f.key === fieldKey);
  return {
    id: uid(),
    pageId,
    type: "text",
    content: `{{${fieldKey}}}`,
    segments: [{ t: "f", k: fieldKey }],
    linkedFieldKey: fieldKey,
    x, y,
    width: 300,
    height: 40,
    rotation: 0,
    zIndex: 1,
    style: { ...DEFAULT_BLOCK_STYLE, fontWeight: 700, fontSize: 18 },
    overflowBehavior: "auto_fit",
    locked: false,
    hidden: false,
    name: field?.label || fieldKey,
    minFontSize: 8,
  };
}

export function duplicateBlock(block: CertificateBlock, newPageId?: string): CertificateBlock {
  return {
    ...block,
    id: uid(),
    pageId: newPageId || block.pageId,
    x: block.x + 20,
    y: block.y + 20,
    name: block.name + " (copy)",
    style: { ...block.style },
  };
}

export function getMaxZIndex(blocks: CertificateBlock[], pageId: string): number {
  return blocks.filter((b) => b.pageId === pageId).reduce((max, b) => Math.max(max, b.zIndex), 0);
}

export function createImageBlock(pageId: string, x: number, y: number, assetUrl: string = "", width: number = 200, height: number = 200): CertificateBlock {
  return {
    id: uid(),
    pageId,
    type: "image",
    content: "",
    linkedFieldKey: null,
    x, y,
    width,
    height,
    rotation: 0,
    zIndex: 1,
    style: { ...DEFAULT_BLOCK_STYLE, objectFit: "contain", padding: 0 },
    overflowBehavior: "keep",
    locked: false,
    hidden: false,
    name: "Image",
    assetUrl,
  };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 200, height: 200 });
    img.src = src;
  });
}
