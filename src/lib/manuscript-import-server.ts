import "server-only";

import JSZip from "jszip";
import mammoth from "mammoth";
import { manuscriptParagraphs, manuscriptWordCount, normalizeManuscriptText } from "@/lib/manuscript-editor-contract";

export type VerifiedManuscriptSource = {
  format: "docx" | "pdf";
  text: string;
  paragraphs: string[];
  words: number;
  pages: number;
  scanned: boolean;
};

export class UnsupportedManuscriptError extends Error {
  constructor(message: string, public readonly code: "LEGACY_DOC" | "SCANNED_PDF" | "ENCRYPTED_PDF" | "CORRUPT_FILE" | "UNSAFE_DOCX" | "UNSUPPORTED_FILE") {
    super(message);
    this.name = "UnsupportedManuscriptError";
  }
}

function isDocx(mimeType: string, fileName: string) {
  return mimeType.includes("wordprocessingml") || /\.docx$/i.test(fileName);
}

function isPdf(mimeType: string, fileName: string) {
  return mimeType === "application/pdf" || /\.pdf$/i.test(fileName);
}

async function validateDocxArchive(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false });
  const entries = Object.values(zip.files);
  if (entries.length > 4_000) throw new UnsupportedManuscriptError("This Word document contains too many embedded parts to import safely.", "UNSAFE_DOCX");
  let expandedBytes = 0;
  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, "/");
    if (name.startsWith("/") || name.split("/").includes("..")) throw new UnsupportedManuscriptError("This Word document contains an unsafe archive path.", "UNSAFE_DOCX");
    const internals = entry as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } };
    const uncompressed = internals._data?.uncompressedSize || 0;
    const compressed = internals._data?.compressedSize || 0;
    expandedBytes += uncompressed;
    if (uncompressed > 24 * 1024 * 1024 || (compressed > 0 && uncompressed / compressed > 150)) {
      throw new UnsupportedManuscriptError("This Word document contains an excessively large compressed part.", "UNSAFE_DOCX");
    }
  }
  if (expandedBytes > 80 * 1024 * 1024) throw new UnsupportedManuscriptError("This Word document expands beyond the safe import limit.", "UNSAFE_DOCX");
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new UnsupportedManuscriptError("The Word document is missing its main document content.", "CORRUPT_FILE");
  if (/<w:altChunk\b/i.test(documentXml)) throw new UnsupportedManuscriptError("This Word document contains embedded HTML content that cannot be imported safely. Ask for a clean .docx replacement.", "UNSAFE_DOCX");
  const relationships = await zip.file("word/_rels/document.xml.rels")?.async("string");
  if (relationships && /TargetMode=["']External["'][^>]+Type=["'][^"']*(?:oleObject|attachedTemplate|package)/i.test(relationships)) {
    throw new UnsupportedManuscriptError("This Word document links to an external object that cannot be imported safely.", "UNSAFE_DOCX");
  }
}

export async function extractManuscriptSource(bytes: Uint8Array, mimeType: string, fileName: string): Promise<VerifiedManuscriptSource> {
  if (mimeType === "application/msword" || /\.doc$/i.test(fileName)) {
    throw new UnsupportedManuscriptError("Legacy .doc files cannot be converted reliably. Ask the author for a .docx or searchable PDF replacement.", "LEGACY_DOC");
  }
  if (isDocx(mimeType, fileName)) {
    try {
      await validateDocxArchive(bytes);
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const text = normalizeManuscriptText(result.value || "");
      if (!text) throw new UnsupportedManuscriptError("The Word document contains no readable manuscript text.", "CORRUPT_FILE");
      return { format: "docx", text, paragraphs: manuscriptParagraphs(result.value || ""), words: manuscriptWordCount(text), pages: 0, scanned: false };
    } catch (error) {
      if (error instanceof UnsupportedManuscriptError) throw error;
      throw new UnsupportedManuscriptError("The Word document is corrupt or cannot be read safely. Ask the author for a fresh .docx file.", "CORRUPT_FILE");
    }
  }
  if (isPdf(mimeType, fileName)) {
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const loadingTask = pdfjs.getDocument({ data: bytes, disableFontFace: true, isEvalSupported: false, useSystemFonts: true });
      const document = await loadingTask.promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => "str" in item ? String(item.str || "") : "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pages.push(text);
        page.cleanup();
      }
      await document.destroy();
      const text = normalizeManuscriptText(pages.join("\n\n"));
      const visiblePages = pages.filter((page) => manuscriptWordCount(page) >= 10).length;
      const scanned = !text || visiblePages < Math.max(1, Math.ceil(pages.length * 0.5));
      if (scanned) throw new UnsupportedManuscriptError("This PDF appears to be scanned or image-only. Ask the author for a searchable PDF or .docx replacement.", "SCANNED_PDF");
      return { format: "pdf", text, paragraphs: manuscriptParagraphs(pages.join("\n\n")), words: manuscriptWordCount(text), pages: pages.length, scanned: false };
    } catch (error) {
      if (error instanceof UnsupportedManuscriptError) throw error;
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : "";
      if (/password/i.test(name) || /password|encrypted/i.test(message)) {
        throw new UnsupportedManuscriptError("Encrypted PDFs cannot be imported. Ask the author for an unlocked searchable PDF.", "ENCRYPTED_PDF");
      }
      throw new UnsupportedManuscriptError("The PDF is corrupt or cannot be read safely. Ask the author for a fresh searchable PDF.", "CORRUPT_FILE");
    }
  }
  throw new UnsupportedManuscriptError("Only .docx and searchable PDF manuscripts are supported.", "UNSUPPORTED_FILE");
}

export function calculateTextCoverage(sourceText: string, editorText: string) {
  const sourceTokens = normalizeManuscriptText(sourceText).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const editorTokens = normalizeManuscriptText(editorText).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (!sourceTokens.length) return 0;
  const remaining = new Map<string, number>();
  editorTokens.forEach((token) => remaining.set(token, (remaining.get(token) || 0) + 1));
  let matched = 0;
  sourceTokens.forEach((token) => {
    const count = remaining.get(token) || 0;
    if (count > 0) {
      matched += 1;
      remaining.set(token, count - 1);
    }
  });
  return Math.round((matched / sourceTokens.length) * 10000) / 10000;
}
