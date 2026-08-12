import "server-only";

import React from "react";
import {
  AlignmentType,
  convertMillimetersToTwip,
  Document as DocxDocument,
  ExternalHyperlink,
  Footer,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import { Document, Image as PdfGraphic, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ManuscriptEditorState, ManuscriptPageSettings } from "@/lib/manuscript-editor-contract";

type SerializedNode = Record<string, unknown>;
type ImageAsset = { data: Uint8Array; mimeType: string; width?: number; height?: number };

export type ManuscriptExportInput = {
  title: string;
  reference: string;
  editorState: ManuscriptEditorState;
  pageSettings: ManuscriptPageSettings;
  imageAssets?: Record<string, ImageAsset>;
};

const childNodes = (node: SerializedNode) => Array.isArray(node.children) ? node.children.filter((child): child is SerializedNode => Boolean(child && typeof child === "object" && !Array.isArray(child))) : [];
const nodeType = (node: SerializedNode) => String(node.type || "");
const nodeText = (node: SerializedNode): string => {
  if (typeof node.text === "string") return node.text;
  if (nodeType(node) === "linebreak") return "\n";
  return childNodes(node).map(nodeText).join("");
};

function cssValue(style: string, property: string) {
  const match = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function numericCss(style: string, property: string) {
  const raw = cssValue(style, property);
  const match = raw.match(/^(-?\d+(?:\.\d+)?)(pt|px)?$/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return match[2]?.toLowerCase() === "px" ? value * 0.75 : value;
}

function hexColor(raw: string) {
  const value = raw.trim();
  const short = value.match(/^#([0-9a-f]{3})$/i);
  if (short) return short[1].split("").map((part) => `${part}${part}`).join("").toUpperCase();
  const full = value.match(/^#([0-9a-f]{6})$/i);
  return full ? full[1].toUpperCase() : undefined;
}

function docxFont(name: string) {
  const cleaned = name.replace(/["'{};]/g, "").split(",")[0].trim();
  const normalized = cleaned.toLowerCase();
  if (normalized.includes("liberation sans") || normalized.includes("arial")) return "Liberation Sans";
  if (normalized.includes("arimo")) return "Liberation Sans";
  if (normalized.includes("tinos")) return "Liberation Serif";
  if (normalized.includes("carlito") || normalized.includes("calibri")) return "Carlito";
  if (normalized.includes("caladea") || normalized.includes("cambria")) return "Caladea";
  if (normalized.includes("garamond")) return "EB Garamond";
  if (normalized.includes("courier")) return "Courier Prime";
  return cleaned || "Liberation Serif";
}

function pdfFont(name: string, format: number) {
  const normalized = name.replace(/["']/g, "").trim().toLowerCase();
  const mono = normalized.includes("courier");
  const sans = normalized.includes("sans") || normalized.includes("arial") || normalized.includes("carlito") || normalized.includes("calibri");
  const base = mono ? "Courier" : sans ? "Helvetica" : "Times-Roman";
  const bold = Boolean(format & 1);
  const italic = Boolean(format & 2);
  if (base === "Courier") return bold && italic ? "Courier-BoldOblique" : bold ? "Courier-Bold" : italic ? "Courier-Oblique" : "Courier";
  if (base === "Helvetica") return bold && italic ? "Helvetica-BoldOblique" : bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica";
  return bold && italic ? "Times-BoldItalic" : bold ? "Times-Bold" : italic ? "Times-Italic" : "Times-Roman";
}

function imageType(mimeType: string): "jpg" | "png" | "gif" | "bmp" {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("bmp")) return "bmp";
  return "jpg";
}

function imageKey(node: SerializedNode) {
  return String(node.fileId || node.sourceId || node.src || "");
}

function textRun(node: SerializedNode): TextRun {
  const style = String(node.style || "");
  const format = Number(node.format || 0);
  const fontSize = numericCss(style, "font-size") || 12;
  return new TextRun({
    text: String(node.text || ""),
    bold: Boolean(format & 1),
    italics: Boolean(format & 2),
    strike: Boolean(format & 4),
    underline: format & 8 ? {} : undefined,
    subScript: Boolean(format & 32),
    superScript: Boolean(format & 64),
    font: docxFont(cssValue(style, "font-family")),
    size: Math.max(8, Math.min(144, Math.round(fontSize * 2))),
    color: hexColor(cssValue(style, "color")),
  });
}

function docxRuns(node: SerializedNode, footnotes: Map<number, string>, assets: Record<string, ImageAsset>): ParagraphChild[] {
  const type = nodeType(node);
  if (type === "text" || type === "linked-field") return [textRun(node)];
  if (type === "linebreak") return [new TextRun({ break: 1 })];
  if (type === "tab") return [new TextRun({ text: "\t" })];
  if (type === "page-break") return [new PageBreak()];
  if (type === "footnote") {
    const id = Number(node.noteNumber || node.footnoteId || footnotes.size + 1);
    footnotes.set(id, String(node.text || node.note || ""));
    return [new FootnoteReferenceRun(id)];
  }
  if (type === "equation") return [new TextRun({ text: String(node.label || "[Equation preserved from source]"), italics: true, color: "7A4C15" })];
  if (type === "image" || type === "linked-image") {
    const asset = assets[imageKey(node)];
    if (!asset) return [new TextRun({ text: `[Figure: ${String(node.altText || node.alt || "image")}]`, italics: true, color: "667085" })];
    const sourceWidth = Number(node.width || asset.width || 640);
    const sourceHeight = Number(node.height || asset.height || 420);
    const width = Math.min(560, Math.max(80, sourceWidth));
    const height = Math.max(50, Math.round(width * (sourceHeight / Math.max(1, sourceWidth))));
    return [new ImageRun({ type: imageType(asset.mimeType), data: asset.data, transformation: { width, height }, altText: { title: String(node.altText || "Figure"), description: String(node.altText || "Manuscript figure"), name: String(node.altText || "Figure") } })];
  }
  if (type === "link" || type === "autolink") {
    const runs = childNodes(node).flatMap((child) => docxRuns(child, footnotes, assets));
    const url = String(node.url || "");
    return /^https?:\/\//i.test(url) ? [new ExternalHyperlink({ link: url, children: runs })] : runs;
  }
  return childNodes(node).flatMap((child) => docxRuns(child, footnotes, assets));
}

function alignment(value: unknown) {
  if (value === "center") return AlignmentType.CENTER;
  if (value === "right") return AlignmentType.RIGHT;
  if (value === "justify") return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function heading(value: unknown) {
  if (value === "h1") return HeadingLevel.HEADING_1;
  if (value === "h2") return HeadingLevel.HEADING_2;
  if (value === "h3") return HeadingLevel.HEADING_3;
  if (value === "h4") return HeadingLevel.HEADING_4;
  if (value === "h5") return HeadingLevel.HEADING_5;
  if (value === "h6") return HeadingLevel.HEADING_6;
  return undefined;
}

function paragraphOptions(node: SerializedNode) {
  const before = Number(node.spacingBeforePt || 0);
  const after = Number(node.spacingAfterPt ?? 6);
  const line = Number(node.lineSpacing || 1.15);
  const firstLine = Number(node.firstLineIndentPt || 0);
  const left = Number(node.leftIndentPt || 0);
  return {
    alignment: alignment(node.format),
    heading: nodeType(node) === "heading" ? heading(node.tag) : undefined,
    spacing: {
      before: Math.max(0, Math.round(before * 20)),
      after: Math.max(0, Math.round(after * 20)),
      line: Math.max(180, Math.round(line * 240)),
    },
    indent: firstLine || left ? { ...(firstLine < 0 ? { hanging: Math.round(Math.abs(firstLine) * 20) } : { firstLine: Math.round(firstLine * 20) }), left: Math.round(left * 20) } : undefined,
  };
}

function docxBlocks(nodes: SerializedNode[], footnotes: Map<number, string>, assets: Record<string, ImageAsset>): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];
  for (const node of nodes) {
    const type = nodeType(node);
    if (type === "table") {
      const rows = childNodes(node).map((row) => new TableRow({ children: childNodes(row).map((cell) => {
        const cellBlocks = docxBlocks(childNodes(cell), footnotes, assets);
        return new TableCell({ children: cellBlocks.length ? cellBlocks : [new Paragraph("")] });
      }) }));
      blocks.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.AUTOFIT }));
      continue;
    }
    if (type === "list") {
      const ordered = String(node.listType || "") === "number";
      childNodes(node).forEach((item, index) => {
        const level = Math.max(0, Math.min(5, Number(item.indent || 0)));
        blocks.push(new Paragraph({
          ...paragraphOptions(item),
          children: docxRuns(item, footnotes, assets),
          ...(ordered ? { numbering: { reference: "manuscript-numbered", level, instance: Number(node.start || 1) } } : { bullet: { level } }),
        }));
        if (index === childNodes(node).length - 1 && !node.tight) blocks.push(new Paragraph({ text: "", spacing: { after: 40 } }));
      });
      continue;
    }
    if (type === "page-break") {
      blocks.push(new Paragraph({ children: [new PageBreak()] }));
      continue;
    }
    if (["paragraph", "manuscript-paragraph", "heading", "quote"].includes(type)) {
      blocks.push(new Paragraph({ ...paragraphOptions(node), children: docxRuns(node, footnotes, assets), style: type === "quote" ? "Quote" : undefined }));
      continue;
    }
    const runs = docxRuns(node, footnotes, assets);
    if (runs.length) blocks.push(new Paragraph({ children: runs }));
  }
  return blocks;
}

export async function renderManuscriptDocx(input: ManuscriptExportInput) {
  const root = input.editorState.root as unknown as SerializedNode;
  const footnotes = new Map<number, string>();
  const children = docxBlocks(childNodes(root), footnotes, input.imageAssets || {});
  const margin = input.pageSettings;
  const pageWidth = convertMillimetersToTwip(input.pageSettings.orientation === "portrait" ? 210 : 297);
  const pageHeight = convertMillimetersToTwip(input.pageSettings.orientation === "portrait" ? 297 : 210);
  const footerChildren = [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      ...(margin.footerText ? [new TextRun({ text: margin.footerText, size: 18, color: "667085" }), new TextRun({ text: "  " })] : []),
      ...(margin.pageNumbers ? [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "667085" })] : []),
    ],
  })];
  const document = new DocxDocument({
    title: input.title,
    subject: `Production manuscript ${input.reference}`,
    creator: "Talikha Publishing",
    description: "Versioned production manuscript generated by the Talikha Manuscript Editor.",
    styles: {
      default: {
        document: { run: { font: "Liberation Serif", size: 24 }, paragraph: { spacing: { line: 360, after: 120 } } },
        heading1: { run: { font: "Liberation Serif", size: 32, bold: true, color: "173F32" }, paragraph: { spacing: { before: 240, after: 120 } } },
        heading2: { run: { font: "Liberation Serif", size: 28, bold: true, color: "173F32" }, paragraph: { spacing: { before: 200, after: 100 } } },
        heading3: { run: { font: "Liberation Serif", size: 24, bold: true, color: "173F32" }, paragraph: { spacing: { before: 160, after: 80 } } },
      },
    },
    numbering: {
      config: [{
        reference: "manuscript-numbered",
        levels: Array.from({ length: 6 }, (_, level) => ({
          level,
          format: LevelFormat.DECIMAL,
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    footnotes: Object.fromEntries(Array.from(footnotes.entries()).map(([id, note]) => [String(id), { children: [new Paragraph({ children: [new TextRun({ text: note, size: 18 })] })] }])),
    sections: [{
      properties: {
        page: {
          size: { width: pageWidth, height: pageHeight, orientation: input.pageSettings.orientation === "portrait" ? PageOrientation.PORTRAIT : PageOrientation.LANDSCAPE },
          margin: {
            top: convertMillimetersToTwip(margin.marginTopMm),
            right: convertMillimetersToTwip(margin.marginRightMm),
            bottom: convertMillimetersToTwip(margin.marginBottomMm),
            left: convertMillimetersToTwip(margin.marginLeftMm),
            header: convertMillimetersToTwip(10),
            footer: convertMillimetersToTwip(10),
          },
        },
      },
      headers: margin.headerText ? { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: margin.headerText, size: 18, color: "667085" })] })] }) } : undefined,
      footers: margin.footerText || margin.pageNumbers ? { default: new Footer({ children: footerChildren }) } : undefined,
      children: children.length ? children : [new Paragraph("")],
    }],
  });
  return Packer.toBuffer(document);
}

type PdfRun = { text: string; style: Record<string, string | number> };

function pdfRuns(node: SerializedNode): PdfRun[] {
  const type = nodeType(node);
  if (type === "text" || type === "linked-field") {
    const style = String(node.style || "");
    const format = Number(node.format || 0);
    return [{
      text: String(node.text || ""),
      style: {
        fontFamily: pdfFont(cssValue(style, "font-family"), format),
        fontSize: numericCss(style, "font-size") || 12,
        color: hexColor(cssValue(style, "color")) ? `#${hexColor(cssValue(style, "color"))}` : "#1c241f",
        textDecoration: [format & 8 ? "underline" : "", format & 4 ? "line-through" : ""].filter(Boolean).join(" "),
      },
    }];
  }
  if (type === "linebreak") return [{ text: "\n", style: {} }];
  if (type === "footnote") return [{ text: `[${String(node.noteNumber || node.footnoteId || "*")}]`, style: { fontSize: 8 } }];
  if (type === "equation") return [{ text: String(node.label || "[Equation preserved from source]"), style: { fontFamily: "Times-Italic", color: "#7A4C15" } }];
  return childNodes(node).flatMap(pdfRuns);
}

function pdfParagraph(node: SerializedNode, key: string) {
  const type = nodeType(node);
  const level = type === "heading" ? Number(String(node.tag || "h2").slice(1)) : 0;
  const runs = pdfRuns(node);
  const lineSpacing = Number(node.lineSpacing || 1.35);
  const align = ["left", "center", "right", "justify"].includes(String(node.format)) ? String(node.format) : "left";
  return <Text key={key} style={{
    fontFamily: level ? "Times-Bold" : "Times-Roman",
    fontSize: level ? Math.max(12, 19 - level * 1.5) : 12,
    lineHeight: lineSpacing,
    marginTop: Number(node.spacingBeforePt || (level ? 10 : 0)),
    marginBottom: Number(node.spacingAfterPt ?? (level ? 6 : 5)),
    textAlign: align as "left" | "center" | "right" | "justify",
    textIndent: Number(node.firstLineIndentPt || 0),
    color: "#1c241f",
  }}>{runs.map((run, index) => <Text key={`${key}-run-${index}`} style={run.style}>{run.text}</Text>)}</Text>;
}

function dataUrl(asset: ImageAsset) {
  return `data:${asset.mimeType};base64,${Buffer.from(asset.data).toString("base64")}`;
}

function pdfBlocks(nodes: SerializedNode[], assets: Record<string, ImageAsset>, prefix = "node"): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  nodes.forEach((node, index) => {
    const type = nodeType(node);
    const key = `${prefix}-${index}`;
    if (["paragraph", "manuscript-paragraph", "heading", "quote"].includes(type)) {
      blocks.push(pdfParagraph(node, key));
    } else if (type === "page-break") {
      blocks.push(<View key={key} break />);
    } else if (type === "image" || type === "linked-image") {
      const asset = assets[imageKey(node)];
      blocks.push(asset ? <View key={key} style={{ marginVertical: 8, alignItems: "center" }} wrap={false}><PdfGraphic src={dataUrl(asset)} style={{ maxWidth: "100%", maxHeight: 420, objectFit: "contain" }} /><Text style={{ marginTop: 4, fontSize: 9, color: "#667085" }}>{String(node.caption || node.altText || "")}</Text></View> : <Text key={key} style={{ color: "#667085", fontSize: 10, marginVertical: 6 }}>[Figure: {String(node.altText || "image")}]</Text>);
    } else if (type === "list") {
      childNodes(node).forEach((item, itemIndex) => blocks.push(<View key={`${key}-${itemIndex}`} style={{ flexDirection: "row", marginBottom: 4, paddingLeft: 14 }}><Text style={{ width: 18, fontSize: 12 }}>{String(node.listType || "") === "number" ? `${itemIndex + Number(node.start || 1)}.` : "•"}</Text><View style={{ flex: 1 }}>{pdfBlocks(childNodes(item), assets, `${key}-${itemIndex}-child`)}</View></View>));
    } else if (type === "table") {
      const rows = childNodes(node);
      blocks.push(<View key={key} style={{ marginVertical: 8, borderTopWidth: 0.7, borderLeftWidth: 0.7, borderColor: "#aebbb4" }} wrap={false}>{rows.map((row, rowIndex) => <View key={`${key}-row-${rowIndex}`} style={{ flexDirection: "row" }}>{childNodes(row).map((cell, cellIndex) => <View key={`${key}-cell-${rowIndex}-${cellIndex}`} style={{ flex: 1, borderRightWidth: 0.7, borderBottomWidth: 0.7, borderColor: "#aebbb4", padding: 5, backgroundColor: rowIndex === 0 ? "#eef2ef" : "#ffffff" }}>{pdfBlocks(childNodes(cell), assets, `${key}-cell-${rowIndex}-${cellIndex}`)}</View>)}</View>)}</View>);
    } else {
      const nested = pdfBlocks(childNodes(node), assets, key);
      if (nested.length) blocks.push(...nested);
      else if (nodeText(node)) blocks.push(pdfParagraph({ ...node, type: "paragraph" }, key));
    }
  });
  return blocks;
}

export async function renderManuscriptPdf(input: ManuscriptExportInput) {
  const root = input.editorState.root as unknown as SerializedNode;
  const settings = input.pageSettings;
  const styles = StyleSheet.create({
    page: {
      paddingTop: `${settings.marginTopMm}mm`,
      paddingRight: `${settings.marginRightMm}mm`,
      paddingBottom: `${settings.marginBottomMm}mm`,
      paddingLeft: `${settings.marginLeftMm}mm`,
      backgroundColor: "#ffffff",
    },
    header: { position: "absolute", top: 20, left: 42, right: 42, textAlign: "center", fontSize: 8, color: "#667085" },
    footer: { position: "absolute", bottom: 18, left: 42, right: 42, flexDirection: "row", justifyContent: "center", fontSize: 8, color: "#667085" },
  });
  const manuscript = <Document title={input.title} author="Talikha Publishing" subject={`Production manuscript ${input.reference}`} creator="Talikha Manuscript Editor"><Page size="A4" orientation={settings.orientation} style={styles.page} wrap>{settings.headerText ? <Text fixed style={styles.header}>{settings.headerText}</Text> : null}{pdfBlocks(childNodes(root), input.imageAssets || {})}{settings.footerText || settings.pageNumbers ? <View fixed style={styles.footer}>{settings.footerText ? <Text>{settings.footerText}{settings.pageNumbers ? "  ·  " : ""}</Text> : null}{settings.pageNumbers ? <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /> : null}</View> : null}</Page></Document>;
  return renderToBuffer(manuscript);
}
