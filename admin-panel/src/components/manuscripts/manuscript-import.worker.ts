/// <reference lib="webworker" />

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type {
  ImportWorkerRequest,
  ImportWorkerResponse,
  ManuscriptEditorState,
  ManuscriptImportPayload,
  ManuscriptImportWarning,
  ManuscriptJson,
  ManuscriptSourceParagraph,
} from "./types";
import { manuscriptWordCount, normalizeManuscriptText } from "./types";

type OrderedXml = Record<string, unknown>;
type NumberingInfo = { kind: "bullet" | "number"; level: number };

const xmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: false,
  parseTagValue: false,
});
const objectParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: false,
  parseTagValue: false,
  isArray: (name) => ["Relationship", "style", "abstractNum", "lvl", "num", "footnote"].includes(name),
});

function children(node: OrderedXml | OrderedXml[] | undefined, name: string): OrderedXml[] {
  const entries = Array.isArray(node) ? node : node ? [node] : [];
  for (const entry of entries) {
    const value = entry[name];
    if (Array.isArray(value)) return value as OrderedXml[];
  }
  return [];
}

function tag(node: OrderedXml | OrderedXml[] | undefined, name: string): OrderedXml | undefined {
  const entries = Array.isArray(node) ? node : node ? [node] : [];
  return entries.find((entry) => Array.isArray(entry[name]));
}

function attribute(node: OrderedXml | undefined, key: string) {
  const attrs = node?.[":@"];
  return attrs && typeof attrs === "object" ? String((attrs as Record<string, unknown>)[key] ?? "") : "";
}

function orderedText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(orderedText).join("");
  const record = node as OrderedXml;
  if (typeof record["#text"] === "string") return record["#text"] as string;
  return Object.entries(record).filter(([key]) => key !== ":@").map(([, value]) => orderedText(value)).join("");
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function attrObject(value: unknown, key: string) {
  return value && typeof value === "object" ? String((value as Record<string, unknown>)[key] ?? "") : "";
}

function pointsFromTwips(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round((parsed / 20) * 100) / 100 : 0;
}

function halfPoints(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 2 : 0;
}

function lexicalText(text: string, options: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; style?: string } = {}): ManuscriptJson {
  let format = 0;
  if (options.bold) format |= 1;
  if (options.italic) format |= 2;
  if (options.strike) format |= 4;
  if (options.underline) format |= 8;
  return { detail: 0, format, mode: "normal", style: options.style || "", text, type: "text", version: 1 };
}

function lexicalParagraph(childrenValue: ManuscriptJson[], paragraph: Partial<ManuscriptSourceParagraph> = {}): ManuscriptJson {
  return {
    children: childrenValue,
    direction: null,
    format: paragraph.alignment || "left",
    indent: 0,
    type: "manuscript-paragraph",
    version: 1,
    spacingBeforePt: paragraph.spacingBeforePt || 0,
    spacingAfterPt: paragraph.spacingAfterPt || 0,
    lineSpacing: paragraph.lineSpacing || 1,
    firstLineIndentPt: paragraph.firstLineIndentPt || 0,
    leftIndentPt: paragraph.leftIndentPt || 0,
    ...(paragraph.page === undefined ? {} : { sourcePage: paragraph.page }),
    ...(paragraph.confidence === undefined ? {} : { confidence: paragraph.confidence }),
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const stride = 0x8000;
  for (let index = 0; index < bytes.length; index += stride) binary += String.fromCharCode(...bytes.subarray(index, index + stride));
  return btoa(binary);
}

function imageMime(path: string) {
  const extension = path.toLowerCase().split(".").pop();
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "bmp") return "image/bmp";
  if (extension === "svg") return "image/svg+xml";
  return "image/jpeg";
}

export async function parseDocx(request: ImportWorkerRequest): Promise<ManuscriptImportPayload> {
  const bytes = new Uint8Array(request.bytes);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false });
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw Object.assign(new Error("The Word document is missing document.xml."), { code: "CORRUPT_FILE" });
  if (/<w:altChunk\b/i.test(documentXml)) throw Object.assign(new Error("This Word document contains embedded HTML. Ask the author for a clean .docx replacement."), { code: "UNSAFE_DOCX" });

  const warnings: ManuscriptImportWarning[] = [];
  const unsupported = new Set<string>();
  if (/<w:(?:ins|del)\b/i.test(documentXml)) { unsupported.add("tracked changes"); warnings.push({ code: "TRACKED_CHANGES", message: "Tracked changes were detected. Insertions are shown and deletions are omitted; compare them manually.", severity: "warning" }); }
  if (/<w:commentRangeStart\b/i.test(documentXml)) { unsupported.add("comments"); warnings.push({ code: "COMMENTS", message: "Word comments were detected and are not editable in this release.", severity: "warning" }); }
  if (/<m:oMath\b/i.test(documentXml)) { unsupported.add("complex equations"); warnings.push({ code: "EQUATIONS", message: "Complex equations are preserved as non-editable objects and require manual review.", severity: "warning" }); }

  const relationshipsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  const relationshipRoot = relationshipsXml ? objectParser.parse(relationshipsXml)?.Relationships : undefined;
  const relationships = new Map<string, string>();
  for (const relation of toArray(relationshipRoot?.Relationship)) {
    const id = attrObject(relation, "Id");
    const target = attrObject(relation, "Target");
    const mode = attrObject(relation, "TargetMode");
    if (id && target && mode !== "External") relationships.set(id, target.replace(/^\.\.\//, ""));
  }

  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  const stylesRoot = stylesXml ? objectParser.parse(stylesXml)?.styles : undefined;
  const styleNames = new Map<string, string>();
  for (const style of toArray(stylesRoot?.style)) {
    const id = attrObject(style, "styleId");
    const name = attrObject(style.name, "val");
    if (id) styleNames.set(id, name || id);
  }

  const numberingXml = await zip.file("word/numbering.xml")?.async("string");
  const numberingRoot = numberingXml ? objectParser.parse(numberingXml)?.numbering : undefined;
  const abstractKinds = new Map<string, Map<number, "bullet" | "number">>();
  for (const abstract of toArray(numberingRoot?.abstractNum)) {
    const levels = new Map<number, "bullet" | "number">();
    for (const level of toArray(abstract.lvl)) {
      const format = attrObject(level.numFmt, "val");
      levels.set(Number(attrObject(level, "ilvl") || 0), format === "bullet" ? "bullet" : "number");
    }
    abstractKinds.set(attrObject(abstract, "abstractNumId"), levels);
  }
  const numberings = new Map<string, Map<number, "bullet" | "number">>();
  for (const num of toArray(numberingRoot?.num)) numberings.set(attrObject(num, "numId"), abstractKinds.get(attrObject(num.abstractNumId, "val")) || new Map());

  const footnotesXml = await zip.file("word/footnotes.xml")?.async("string");
  const footnotesRoot = footnotesXml ? objectParser.parse(footnotesXml)?.footnotes : undefined;
  const footnotes = new Map<string, string>();
  for (const footnote of toArray(footnotesRoot?.footnote)) {
    const id = attrObject(footnote, "id");
    if (Number(id) >= 0) footnotes.set(id, normalizeManuscriptText(JSON.stringify(footnote).replace(/[^\p{L}\p{N}\p{P}\p{Zs}]+/gu, " ")));
  }

  const parsed = xmlParser.parse(documentXml) as OrderedXml[];
  const documentContent = children(parsed, "document");
  const bodyItems = children(documentContent, "body");
  if (!bodyItems.length) throw Object.assign(new Error("The Word document body could not be read."), { code: "CORRUPT_FILE" });

  const editorChildren: ManuscriptJson[] = [];
  const sourceParagraphs: ManuscriptSourceParagraph[] = [];
  let tableCount = 0;
  let imageCount = 0;
  let footnoteCount = 0;
  let pageBreaks = 0;
  let estimatedPage = 1;

  const parseRuns = async (items: OrderedXml[]) => {
    const output: ManuscriptJson[] = [];
    let paragraphText = "";
    for (const item of items) {
      if (children(item, "del").length) continue;
      if (children(item, "ins").length) {
        const nested = await parseRuns(children(item, "ins"));
        output.push(...nested.nodes);
        paragraphText += nested.text;
        continue;
      }
      if (children(item, "oMath").length || children(item, "oMathPara").length) {
        const equationText = normalizeManuscriptText(orderedText(item)) || "Complex equation preserved from source";
        output.push({ type: "equation", version: 1, label: equationText, sourceXml: equationText.slice(0, 2_000) });
        paragraphText += equationText;
        continue;
      }
      const run = children(item, "r");
      if (!run.length) {
        const hyperlink = children(item, "hyperlink");
        if (hyperlink.length) {
          const nested = await parseRuns(hyperlink);
          output.push(...nested.nodes);
          paragraphText += nested.text;
        }
        continue;
      }
      const runProperties = children(run, "rPr");
      let runStyle = "";
      const font = attribute(tag(runProperties, "rFonts"), "ascii") || attribute(tag(runProperties, "rFonts"), "hAnsi");
      const size = halfPoints(attribute(tag(runProperties, "sz"), "val"));
      const color = attribute(tag(runProperties, "color"), "val");
      const highlight = attribute(tag(runProperties, "highlight"), "val");
      if (font) runStyle += `font-family: ${font.replace(/[;{}]/g, "")};`;
      if (size) runStyle += `font-size: ${size}pt;`;
      if (/^[0-9a-f]{6}$/i.test(color)) runStyle += `color: #${color};`;
      if (highlight && highlight !== "none") runStyle += `background-color: ${highlight.replace(/[^a-z]/gi, "")};`;
      const options = { bold: Boolean(tag(runProperties, "b")), italic: Boolean(tag(runProperties, "i")), underline: Boolean(tag(runProperties, "u")), strike: Boolean(tag(runProperties, "strike")), style: runStyle };
      for (const part of run) {
        const textElement = children(part, "t").length ? children(part, "t") : children(part, "delText");
        if (textElement.length) {
          const text = orderedText(textElement);
          if (text) { output.push(lexicalText(text, options)); paragraphText += text; }
        }
        if (tag(part, "tab")) { output.push(lexicalText("\t", options)); paragraphText += "\t"; }
        if (tag(part, "br")) {
          const breakType = attribute(tag(part, "br"), "type");
          if (breakType === "page") { output.push({ type: "page-break", version: 1 }); pageBreaks += 1; estimatedPage += 1; }
          else { output.push({ type: "linebreak", version: 1 }); paragraphText += "\n"; }
        }
        const footnoteReference = tag(part, "footnoteReference");
        if (footnoteReference) {
          const id = attribute(footnoteReference, "id");
          const number = Math.max(1, Number(id) || footnoteCount + 1);
          output.push({ detail: 0, format: 0, mode: "normal", style: "font-size: 9pt; vertical-align: super;", text: footnotes.get(id) || `Footnote ${number}`, type: "footnote", version: 1, noteNumber: number });
          footnoteCount += 1;
        }
        const drawing = children(part, "drawing").length ? children(part, "drawing") : children(part, "pict");
        if (drawing.length) {
          const serialized = JSON.stringify(drawing);
          const relationshipId = serialized.match(/"embed":"([^"]+)"/)?.[1] || serialized.match(/"id":"(rId\d+)"/)?.[1];
          const target = relationshipId ? relationships.get(relationshipId) : undefined;
          const normalizedTarget = target ? `word/${target.replace(/^word\//, "")}` : "";
          const media = normalizedTarget ? zip.file(normalizedTarget) : null;
          if (media) {
            const imageBytes = await media.async("uint8array");
            const src = `data:${imageMime(normalizedTarget)};base64,${bytesToBase64(imageBytes)}`;
            output.push({ type: "image", version: 1, src, altText: "Imported manuscript image", caption: "", width: 480, height: 320 });
            imageCount += 1;
            paragraphText += "[Image]";
          }
        }
      }
    }
    return { nodes: output, text: paragraphText };
  };

  const parseParagraph = async (item: OrderedXml, insideTable = false) => {
    const p = children(item, "p").length ? children(item, "p") : [item];
    const properties = children(p, "pPr");
    const spacing = tag(properties, "spacing");
    const indentation = tag(properties, "ind");
    const lineRaw = Number(attribute(spacing, "line"));
    const lineRule = attribute(spacing, "lineRule");
    const lineSpacing = lineRaw ? (lineRule === "auto" || !lineRule ? Math.round((lineRaw / 240) * 100) / 100 : Math.round((lineRaw / 20 / 12) * 100) / 100) : 1;
    const alignmentValue = attribute(tag(properties, "jc"), "val");
    const alignment = (["left", "center", "right", "justify"].includes(alignmentValue) ? alignmentValue : "left") as ManuscriptSourceParagraph["alignment"];
    const styleId = attribute(tag(properties, "pStyle"), "val");
    const styleName = styleNames.get(styleId) || styleId;
    const paragraphMeta: ManuscriptSourceParagraph = {
      index: sourceParagraphs.length,
      text: "",
      page: estimatedPage,
      style: styleName || "Normal",
      alignment,
      spacingBeforePt: pointsFromTwips(attribute(spacing, "before")),
      spacingAfterPt: pointsFromTwips(attribute(spacing, "after")),
      lineSpacing,
      firstLineIndentPt: pointsFromTwips(attribute(indentation, "firstLine")) || -pointsFromTwips(attribute(indentation, "hanging")),
      leftIndentPt: pointsFromTwips(attribute(indentation, "left") || attribute(indentation, "start")),
      confidence: 1,
    };
    const parsedRuns = await parseRuns(p);
    paragraphMeta.text = parsedRuns.text;
    sourceParagraphs.push(paragraphMeta);
    const listProperties = children(properties, "numPr");
    const numId = attribute(tag(listProperties, "numId"), "val");
    const level = Number(attribute(tag(listProperties, "ilvl"), "val") || 0);
    const numbering: NumberingInfo | null = numId ? { kind: numberings.get(numId)?.get(level) || "number", level } : null;
    const isHeading = /heading\s*1|title/i.test(styleName) ? "h1" : /heading\s*2/i.test(styleName) ? "h2" : /heading\s*3/i.test(styleName) ? "h3" : null;
    const node = isHeading
      ? { children: parsedRuns.nodes, direction: null, format: alignment || "left", indent: 0, tag: isHeading, type: "heading", version: 1 }
      : lexicalParagraph(parsedRuns.nodes, paragraphMeta);
    if (numbering && !insideTable) {
      return { node: { children: [{ children: parsedRuns.nodes, direction: null, format: "", indent: numbering.level, value: 1, type: "listitem", version: 1 }], direction: null, format: "", indent: 0, listType: numbering.kind, start: 1, tag: numbering.kind === "bullet" ? "ul" : "ol", type: "list", version: 1 }, text: parsedRuns.text };
    }
    return { node, text: parsedRuns.text };
  };

  for (const item of bodyItems) {
    if (children(item, "p").length) {
      const parsedParagraph = await parseParagraph(item);
      editorChildren.push(parsedParagraph.node);
    } else if (children(item, "tbl").length) {
      tableCount += 1;
      const table = children(item, "tbl");
      const rows: ManuscriptJson[] = [];
      for (const rowItem of table.filter((entry) => children(entry, "tr").length)) {
        const row = children(rowItem, "tr");
        const cells: ManuscriptJson[] = [];
        for (const cellItem of row.filter((entry) => children(entry, "tc").length)) {
          const cell = children(cellItem, "tc");
          const cellParagraphs: ManuscriptJson[] = [];
          for (const paragraphItem of cell.filter((entry) => children(entry, "p").length)) cellParagraphs.push((await parseParagraph(paragraphItem, true)).node);
          cells.push({ children: cellParagraphs.length ? cellParagraphs : [lexicalParagraph([])], direction: null, format: "", indent: 0, colSpan: 1, rowSpan: 1, headerState: 0, type: "tablecell", version: 1 });
        }
        rows.push({ children: cells, direction: null, format: "", indent: 0, type: "tablerow", version: 1 });
      }
      editorChildren.push({ children: rows, direction: null, format: "", indent: 0, type: "table", version: 1 });
    }
  }

  if (!sourceParagraphs.length) throw Object.assign(new Error("The Word document contains no readable paragraphs."), { code: "CORRUPT_FILE" });
  const sourceText = sourceParagraphs.map((paragraph) => paragraph.text).join("\n");
  const editorState: ManuscriptEditorState = { root: { children: editorChildren, direction: null, format: "", indent: 0, type: "root", version: 1 } };
  const report = {
    format: "docx" as const,
    importedAt: new Date().toISOString(),
    sourceFileName: request.fileName,
    sourceBytes: bytes.byteLength,
    sourcePages: Math.max(estimatedPage, 0),
    sourceParagraphs: sourceParagraphs.length,
    editorParagraphs: sourceParagraphs.length,
    sourceWords: manuscriptWordCount(sourceText),
    editorWords: manuscriptWordCount(sourceText),
    tables: tableCount,
    images: imageCount,
    footnotes: footnoteCount,
    pageBreaks,
    normalizedTextCoverage: 1,
    unsupportedConstructs: Array.from(unsupported),
    lowConfidencePages: [],
    warnings,
    paragraphs: sourceParagraphs,
  };
  return { editorState, contentText: sourceText, sourceSnapshot: { text: sourceText, paragraphs: sourceParagraphs }, report };
}

type PdfTextItem = { str: string; x: number; y: number; width: number; height: number; fontName: string };

export async function parsePdf(request: ImportWorkerRequest): Promise<ManuscriptImportPayload> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(request.bytes), disableFontFace: true, isEvalSupported: false, useSystemFonts: true });
  let pdf;
  try { pdf = await loadingTask.promise; }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/password|encrypted/i.test(message)) throw Object.assign(new Error("Encrypted PDFs cannot be imported. Ask the author for an unlocked searchable PDF."), { code: "ENCRYPTED_PDF" });
    throw Object.assign(new Error("The PDF is corrupt or cannot be read."), { code: "CORRUPT_FILE" });
  }
  const pageCount = pdf.numPages;
  const editorChildren: ManuscriptJson[] = [];
  const sourceParagraphs: ManuscriptSourceParagraph[] = [];
  const warnings: ManuscriptImportWarning[] = [];
  const lowConfidencePages: number[] = [];
  let readablePages = 0;
  let pageBreaks = 0;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent({ includeMarkedContent: true });
    const items: PdfTextItem[] = content.items.flatMap((item) => {
      if (!("str" in item) || !String(item.str || "").trim()) return [];
      const transform = item.transform;
      return [{ str: String(item.str), x: Number(transform[4]), y: Number(transform[5]), width: Number(item.width || 0), height: Math.abs(Number(transform[3] || item.height || 10)), fontName: String(item.fontName || "") }];
    });
    const wordCount = manuscriptWordCount(items.map((item) => item.str).join(" "));
    if (wordCount >= 10) readablePages += 1;
    const center = viewport.width / 2;
    const left = items.filter((item) => item.x < center * 0.82).length;
    const right = items.filter((item) => item.x > center * 1.05).length;
    const crossing = items.filter((item) => item.x < center && item.x + item.width > center).length;
    const multiColumn = items.length > 25 && left / items.length > 0.25 && right / items.length > 0.25 && crossing / items.length < 0.08;
    const overlapping = items.some((item, index) => items.slice(index + 1, index + 25).some((other) => Math.abs(item.y - other.y) < 1.5 && other.x < item.x + item.width - 2 && item.x < other.x + other.width - 2));
    const sparse = wordCount < 20;
    const confidence = multiColumn || overlapping ? 0.55 : sparse ? 0.7 : 0.96;
    if (confidence < 0.75) {
      lowConfidencePages.push(pageNumber);
      warnings.push({ code: multiColumn ? "MULTI_COLUMN" : overlapping ? "OVERLAPPING_TEXT" : "SPARSE_TEXT", message: multiColumn ? `Page ${pageNumber} appears to use multiple columns; verify reading order.` : overlapping ? `Page ${pageNumber} contains overlapping positioned text.` : `Page ${pageNumber} contains sparse searchable text.`, severity: "warning", page: pageNumber });
    }

    const sorted = [...items].sort((a, b) => Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x);
    const lines: Array<{ y: number; x: number; height: number; text: string; fontName: string }> = [];
    for (const item of sorted) {
      const current = lines.find((line) => Math.abs(line.y - item.y) <= Math.max(2, item.height * 0.28));
      if (current) {
        const needsSpace = current.text && !/[-–—\s]$/.test(current.text) && !/^[,.;:!?)]/.test(item.str);
        current.text += `${needsSpace ? " " : ""}${item.str}`;
        current.x = Math.min(current.x, item.x);
        current.height = Math.max(current.height, item.height);
      } else lines.push({ y: item.y, x: item.x, height: item.height, text: item.str, fontName: item.fontName });
    }
    lines.sort((a, b) => b.y - a.y || a.x - b.x);
    const gaps = lines.slice(1).map((line, index) => Math.max(0, lines[index].y - line.y)).filter(Boolean).sort((a, b) => a - b);
    const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;
    const paragraphLines: typeof lines[] = [];
    for (const line of lines) {
      const current = paragraphLines.at(-1);
      if (!current?.length) { paragraphLines.push([line]); continue; }
      const previous = current.at(-1)!;
      const gap = previous.y - line.y;
      const indentShift = Math.abs(line.x - current[0].x);
      if (gap > medianGap * 1.55 || (indentShift > 24 && /[.!?:]$/.test(previous.text))) paragraphLines.push([line]);
      else current.push(line);
    }
    for (const linesInParagraph of paragraphLines) {
      const paragraphText = linesInParagraph.map((line, index) => index && linesInParagraph[index - 1].text.endsWith("-") && /^[a-z]/.test(line.text) ? line.text : `${index ? " " : ""}${line.text}`).join("");
      const meta: ManuscriptSourceParagraph = { index: sourceParagraphs.length, text: paragraphText, page: pageNumber, style: linesInParagraph[0].fontName || "PDF source font", alignment: "left", spacingBeforePt: 0, spacingAfterPt: Math.max(0, medianGap - linesInParagraph[0].height), lineSpacing: 1, firstLineIndentPt: 0, leftIndentPt: 0, confidence };
      sourceParagraphs.push(meta);
      editorChildren.push(lexicalParagraph([lexicalText(paragraphText, { style: `font-family: ${linesInParagraph[0].fontName.replace(/[^a-z0-9 _+-]/gi, "") || "Liberation Serif"}; font-size: ${Math.max(8, Math.min(24, linesInParagraph[0].height))}pt;` })], meta));
    }
    if (pageNumber < pageCount) { editorChildren.push({ type: "page-break", version: 1 }); pageBreaks += 1; }
    page.cleanup();
  }
  await pdf.destroy();
  const sourceText = sourceParagraphs.map((paragraph) => paragraph.text).join("\n");
  if (!sourceText || readablePages < Math.max(1, Math.ceil(pageCount * 0.5))) throw Object.assign(new Error("This PDF appears scanned or image-only. Ask the author for a searchable PDF or .docx replacement."), { code: "SCANNED_PDF" });
  const editorState: ManuscriptEditorState = { root: { children: editorChildren, direction: null, format: "", indent: 0, type: "root", version: 1 } };
  const report = {
    format: "pdf" as const,
    importedAt: new Date().toISOString(), sourceFileName: request.fileName, sourceBytes: request.bytes.byteLength, sourcePages: pageCount,
    sourceParagraphs: sourceParagraphs.length, editorParagraphs: sourceParagraphs.length, sourceWords: manuscriptWordCount(sourceText), editorWords: manuscriptWordCount(sourceText),
    tables: 0, images: 0, footnotes: 0, pageBreaks, normalizedTextCoverage: 1, unsupportedConstructs: multiColumnUnsupported(lowConfidencePages, warnings), lowConfidencePages, warnings, paragraphs: sourceParagraphs,
  };
  return { editorState, contentText: sourceText, sourceSnapshot: { text: sourceText, paragraphs: sourceParagraphs }, report };
}

function multiColumnUnsupported(lowConfidencePages: number[], warnings: ManuscriptImportWarning[]) {
  const values: string[] = [];
  if (warnings.some((warning) => warning.code === "MULTI_COLUMN")) values.push("multi-column reading order");
  if (warnings.some((warning) => warning.code === "OVERLAPPING_TEXT")) values.push("overlapping positioned text");
  if (lowConfidencePages.length) values.push("low-confidence PDF pages");
  return values;
}

export async function convertImportRequest(request: ImportWorkerRequest) {
  const legacyDoc = request.mimeType === "application/msword" || /\.doc$/i.test(request.fileName);
  if (legacyDoc) throw Object.assign(new Error("Legacy .doc files are not supported. Ask the author for a .docx or searchable PDF replacement."), { code: "LEGACY_DOC" });
  return request.mimeType === "application/pdf" || /\.pdf$/i.test(request.fileName) ? parsePdf(request) : parseDocx(request);
}

const isWorkerRuntime = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (isWorkerRuntime) self.onmessage = async (event: MessageEvent<ImportWorkerRequest>) => {
  try {
    const payload = await convertImportRequest(event.data);
    const response: ImportWorkerResponse = { ok: true, payload };
    self.postMessage(response);
  } catch (error) {
    const value = error as Error & { code?: string };
    const response: ImportWorkerResponse = { ok: false, code: value.code || "IMPORT_FAILED", message: value.message || "The manuscript could not be converted." };
    self.postMessage(response);
  }
};

export {};
