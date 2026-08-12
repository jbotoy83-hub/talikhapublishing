import { beforeAll, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  Document as DocxDocument,
  FootnoteReferenceRun,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import mammoth from "mammoth";
import { compareManuscriptParagraphs } from "../../admin-panel/src/components/manuscripts/comparison";
import { convertImportRequest } from "../../admin-panel/src/components/manuscripts/manuscript-import.worker";
import {
  defaultManuscriptPageSettings,
  manuscriptPlainTextFromState,
  type ManuscriptEditorState,
} from "@/lib/manuscript-editor-contract";

vi.mock("server-only", () => ({}));

const wordMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const pixelPng = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const asArrayBuffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer as ArrayBuffer;

async function academicDocx() {
  const document = new DocxDocument({
    footnotes: { 1: { children: [new Paragraph({ children: [new TextRun("A preserved footnote.")] })] } },
    sections: [{ children: [
      new Paragraph({ heading: HeadingLevel.TITLE, alignment: "center", children: [new TextRun({ text: "A Structured Academic Manuscript", bold: true })] }),
      new Paragraph(""),
      new Paragraph({ spacing: { before: 120, after: 160, line: 360 }, indent: { firstLine: 720 }, children: [new TextRun("First paragraph with retained spacing and indentation.")] }),
      new Paragraph({ children: [new TextRun({ text: "Second paragraph includes emphasis", italics: true }), new TextRun(" and a footnote"), new FootnoteReferenceRun(1), new TextRun(".")] }),
      new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph("Variable")] }), new TableCell({ children: [new Paragraph("Value")] })] }), new TableRow({ children: [new TableCell({ children: [new Paragraph("Coverage")] }), new TableCell({ children: [new Paragraph("100 percent")] })] })] }),
      new Paragraph({ children: [new ImageRun({ type: "png", data: pixelPng, transformation: { width: 24, height: 24 }, altText: { title: "Fixture", description: "One pixel fixture", name: "Fixture" } })] }),
      new Paragraph({ children: [new PageBreak(), new TextRun("Text after a deliberate page break.")] }),
    ] }],
  });
  return Packer.toBuffer(document);
}

async function searchablePdf(twoColumns = false) {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.TimesRoman);
  page.drawText("A Searchable Academic Manuscript", { x: 72, y: 790, size: 16, font });
  for (let index = 0; index < 16; index += 1) page.drawText(`Left reading line ${index + 1} contains selectable publication text.`, { x: 72, y: 754 - index * 18, size: 10, font });
  if (twoColumns) for (let index = 0; index < 16; index += 1) page.drawText(`Right column line ${index + 1} requires reading-order review.`, { x: 330, y: 754 - index * 18, size: 10, font });
  return document.save();
}

async function longAcademicDocx(pageCount = 100) {
  const children: Paragraph[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Section page ${page}`)] }));
    for (let paragraph = 1; paragraph <= 4; paragraph += 1) {
      children.push(new Paragraph({ spacing: { after: 120, line: 360 }, indent: { firstLine: 720 }, children: [new TextRun(`Page ${page}, paragraph ${paragraph}. Representative academic manuscript text retained for off-thread import and structured serialization.`)] }));
    }
    if (page < pageCount) children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return Packer.toBuffer(new DocxDocument({ sections: [{ children }] }));
}

beforeAll(() => {
  Object.defineProperty(globalThis, "WorkerGlobalScope", { value: undefined, configurable: true });
});

describe("manuscript import pipeline", () => {
  it("reconstructs DOCX paragraphs, blank lines, spacing, tables, images, footnotes, and page breaks", async () => {
    const bytes = await academicDocx();
    const result = await convertImportRequest({ bytes: asArrayBuffer(bytes), fileName: "fixture.docx", mimeType: wordMime });
    expect(result.report.format).toBe("docx");
    expect(result.report.sourceParagraphs).toBeGreaterThanOrEqual(9);
    expect(result.report.tables).toBe(1);
    expect(result.report.images).toBe(1);
    expect(result.report.footnotes).toBe(1);
    expect(result.report.pageBreaks).toBe(1);
    expect(result.contentText).toContain("First paragraph with retained spacing");
    expect(result.editorState.root.children.some((node) => typeof node === "object" && !Array.isArray(node) && node?.type === "table")).toBe(true);
    const paragraphs = result.editorState.root.children.filter((node) => typeof node === "object" && !Array.isArray(node) && node?.type === "manuscript-paragraph") as Array<Record<string, unknown>>;
    expect(paragraphs.some((paragraph) => Number(paragraph.firstLineIndentPt) >= 35)).toBe(true);
    expect(JSON.parse(JSON.stringify(result.editorState))).toEqual(result.editorState);
  });

  it("reconstructs searchable PDFs and flags uncertain multi-column reading order", async () => {
    const bytes = await searchablePdf(true);
    const result = await convertImportRequest({ bytes: asArrayBuffer(bytes), fileName: "columns.pdf", mimeType: "application/pdf" });
    expect(result.report.format).toBe("pdf");
    expect(result.report.sourcePages).toBe(1);
    expect(result.report.sourceWords).toBeGreaterThan(100);
    expect(result.report.lowConfidencePages).toContain(1);
    expect(result.report.warnings.some((warning) => warning.code === "MULTI_COLUMN")).toBe(true);
  });

  it("rejects legacy Word, scanned PDF, and corrupt source files with replacement guidance", async () => {
    await expect(convertImportRequest({ bytes: new ArrayBuffer(8), fileName: "legacy.doc", mimeType: "application/msword" })).rejects.toMatchObject({ code: "LEGACY_DOC" });
    const blank = await PDFDocument.create();
    blank.addPage([595, 842]);
    const blankBytes = await blank.save();
    await expect(convertImportRequest({ bytes: asArrayBuffer(blankBytes), fileName: "scan.pdf", mimeType: "application/pdf" })).rejects.toMatchObject({ code: "SCANNED_PDF" });
    await expect(convertImportRequest({ bytes: new Uint8Array([1, 2, 3, 4]).buffer, fileName: "broken.docx", mimeType: wordMime })).rejects.toBeTruthy();
  });

  it("rejects DOCX embedded HTML before semantic extraction", async () => {
    const bytes = await academicDocx();
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")!.async("string");
    zip.file("word/document.xml", xml.replace("<w:body>", '<w:body><w:altChunk r:id="rIdUnsafe"/>'));
    const hostile = await zip.generateAsync({ type: "uint8array" });
    const { extractManuscriptSource } = await import("@/lib/manuscript-import-server");
    await expect(extractManuscriptSource(hostile, wordMime, "unsafe.docx")).rejects.toMatchObject({ code: "UNSAFE_DOCX" });
  });

  it("converts a representative 100-page manuscript without full-document rendering", async () => {
    const bytes = await longAcademicDocx();
    const startedAt = performance.now();
    const result = await convertImportRequest({ bytes: asArrayBuffer(bytes), fileName: "long-manuscript.docx", mimeType: wordMime });
    const elapsedMs = performance.now() - startedAt;
    expect(result.report.sourcePages).toBe(100);
    expect(result.report.pageBreaks).toBe(99);
    expect(result.report.sourceParagraphs).toBeGreaterThanOrEqual(500);
    expect(result.contentText).toContain("Page 100, paragraph 4");
    expect(elapsedMs).toBeLessThan(15_000);
  }, 30_000);
});

describe("manuscript comparison and output", () => {
  it("classifies missing, extra, and changed paragraphs without quadratic document comparison", () => {
    const source = [
      { index: 0, text: "Exact title" },
      { index: 1, text: "Paragraph retained" },
      { index: 2, text: "Paragraph missing" },
      { index: 3, text: "Original wording" },
    ];
    const findings = compareManuscriptParagraphs(source, "Exact title\nExtra editor paragraph\nParagraph retained\nChanged wording");
    expect(findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining(["extra", "missing", "changed"]));
  });

  it("treats an unimported draft without source paragraphs as an empty comparison", () => {
    expect(compareManuscriptParagraphs(undefined, "Draft title\nDraft paragraph")).toEqual([
      { id: "extra-0", kind: "extra", editorIndex: 0, editorText: "Draft title" },
      { id: "extra-1", kind: "extra", editorIndex: 1, editorText: "Draft paragraph" },
    ]);
  });

  it("serializes linked fields as copyable plain text", () => {
    const state: ManuscriptEditorState = { root: { children: [{ children: [{ detail: 0, format: 0, mode: "normal", style: "", text: "Dr. Maria Santos", type: "linked-field", version: 1, fieldKey: "author.1.name", fieldLabel: "Author 1 name", sourcePath: "submission_authors[position=1]", sourceValue: "Dr. Maria Santos", overridden: false, frozen: false, private: false }], direction: null, format: "left", indent: 0, type: "manuscript-paragraph", version: 1, spacingBeforePt: 0, spacingAfterPt: 6, lineSpacing: 1.5, firstLineIndentPt: 0, leftIndentPt: 0 }], direction: null, format: "", indent: 0, type: "root", version: 1 } };
    expect(manuscriptPlainTextFromState(state)).toBe("Dr. Maria Santos");
  });

  it("generates reopenable DOCX and searchable PDF outputs from one editor snapshot", async () => {
    const state: ManuscriptEditorState = { root: { children: [
      { children: [{ detail: 0, format: 1, mode: "normal", style: "font-family: Tinos; font-size: 16pt;", text: "Publication-ready title", type: "text", version: 1 }], direction: null, format: "center", indent: 0, tag: "h1", type: "heading", version: 1 },
      { children: [{ detail: 0, format: 0, mode: "normal", style: "font-family: Tinos; font-size: 12pt;", text: "Selectable manuscript body text with preserved paragraph spacing.", type: "text", version: 1 }], direction: null, format: "justify", indent: 0, type: "manuscript-paragraph", version: 1, spacingBeforePt: 0, spacingAfterPt: 6, lineSpacing: 1.5, firstLineIndentPt: 36, leftIndentPt: 0 },
      { type: "page-break", version: 1 },
      { children: [{ detail: 0, format: 0, mode: "normal", style: "", text: "Text on the second page.", type: "text", version: 1 }], direction: null, format: "left", indent: 0, type: "manuscript-paragraph", version: 1, spacingBeforePt: 0, spacingAfterPt: 6, lineSpacing: 1.5, firstLineIndentPt: 0, leftIndentPt: 0 },
    ], direction: null, format: "", indent: 0, type: "root", version: 1 } };
    const { renderManuscriptDocx, renderManuscriptPdf } = await import("@/lib/manuscript-export");
    const input = { title: "Publication-ready title", reference: "TP-TEST-001", editorState: state, pageSettings: defaultManuscriptPageSettings };
    const [docxBytes, pdfBytes] = await Promise.all([renderManuscriptDocx(input), renderManuscriptPdf(input)]);
    expect(docxBytes.subarray(0, 2).toString()).toBe("PK");
    expect(pdfBytes.subarray(0, 4).toString()).toBe("%PDF");
    const reopenedWord = await mammoth.extractRawText({ buffer: docxBytes });
    expect(reopenedWord.value).toContain("Selectable manuscript body text");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableFontFace: true, isEvalSupported: false }).promise;
    expect(pdf.numPages).toBeGreaterThanOrEqual(2);
    let extracted = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      extracted += content.items.map((item) => "str" in item ? item.str : "").join(" ");
    }
    await pdf.destroy();
    expect(extracted).toContain("Selectable manuscript body text");
    expect(extracted).toContain("Text on the second page");
  }, 30_000);
});
