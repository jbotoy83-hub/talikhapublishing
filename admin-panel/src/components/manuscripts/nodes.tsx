import type { CSSProperties, ReactNode } from "react";
import {
  $applyNodeReplacement,
  DecoratorNode,
  ParagraphNode,
  TextNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type SerializedParagraphNode,
  type SerializedTextNode,
  type Spread,
} from "lexical";

export type SerializedLinkedFieldNode = Spread<{
  type: "linked-field";
  fieldKey: string;
  fieldLabel: string;
  sourcePath: string;
  sourceValue: string;
  overridden: boolean;
  frozen: boolean;
  private: boolean;
}, SerializedTextNode>;

export class LinkedFieldNode extends TextNode {
  __fieldKey: string;
  __fieldLabel: string;
  __sourcePath: string;
  __sourceValue: string;
  __overridden: boolean;
  __frozen: boolean;
  __private: boolean;

  static getType() { return "linked-field"; }
  static clone(node: LinkedFieldNode) {
    const clone = new LinkedFieldNode(node.__text, node.__fieldKey, node.__fieldLabel, node.__sourcePath, node.__sourceValue, node.__key);
    clone.__format = node.__format;
    clone.__style = node.__style;
    clone.__mode = node.__mode;
    clone.__detail = node.__detail;
    clone.__overridden = node.__overridden;
    clone.__frozen = node.__frozen;
    clone.__private = node.__private;
    return clone;
  }

  constructor(text: string, fieldKey: string, fieldLabel: string, sourcePath: string, sourceValue = text, key?: NodeKey) {
    super(text, key);
    this.__fieldKey = fieldKey;
    this.__fieldLabel = fieldLabel;
    this.__sourcePath = sourcePath;
    this.__sourceValue = sourceValue;
    this.__overridden = false;
    this.__frozen = false;
    this.__private = false;
  }

  static importJSON(serialized: SerializedLinkedFieldNode) {
    const node = new LinkedFieldNode(serialized.text, serialized.fieldKey, serialized.fieldLabel, serialized.sourcePath, serialized.sourceValue);
    node.updateFromJSON(serialized);
    node.__overridden = serialized.overridden;
    node.__frozen = serialized.frozen;
    node.__private = serialized.private;
    return node;
  }

  exportJSON(): SerializedLinkedFieldNode {
    return { ...super.exportJSON(), type: "linked-field", version: 1, fieldKey: this.__fieldKey, fieldLabel: this.__fieldLabel, sourcePath: this.__sourcePath, sourceValue: this.__sourceValue, overridden: this.__overridden || this.__text !== this.__sourceValue, frozen: this.__frozen, private: this.__private };
  }

  createDOM(config: EditorConfig) {
    const dom = super.createDOM(config);
    dom.classList.add("me-linked-field");
    if (this.__overridden || this.__text !== this.__sourceValue) dom.classList.add("is-overridden");
    if (this.__frozen) dom.classList.add("is-frozen");
    dom.dataset.fieldKey = this.__fieldKey;
    dom.title = `${this.__fieldLabel} · ${this.__sourcePath}${this.__private ? " · Private" : ""}`;
    return dom;
  }

  updateDOM(previous: this, dom: HTMLElement, config: EditorConfig) {
    const changed = super.updateDOM(previous, dom, config);
    dom.classList.toggle("is-overridden", this.__overridden || this.__text !== this.__sourceValue);
    dom.classList.toggle("is-frozen", this.__frozen);
    dom.title = `${this.__fieldLabel} · ${this.__sourcePath}${this.__private ? " · Private" : ""}`;
    return changed;
  }

  markOverridden(overridden = true) {
    const writable = this.getWritable();
    writable.__overridden = overridden;
    return writable;
  }

  convertToFixedText() {
    const replacement = new TextNode(this.getTextContent());
    replacement.setFormat(this.getFormat());
    replacement.setStyle(this.getStyle());
    this.replace(replacement);
  }
}

export function $createLinkedFieldNode(input: { text: string; fieldKey: string; fieldLabel: string; sourcePath: string; sourceValue?: string; private?: boolean }) {
  const node = new LinkedFieldNode(input.text, input.fieldKey, input.fieldLabel, input.sourcePath, input.sourceValue ?? input.text);
  node.__private = input.private === true;
  return $applyNodeReplacement(node);
}

export function $isLinkedFieldNode(node: LexicalNode | null | undefined): node is LinkedFieldNode {
  return node instanceof LinkedFieldNode;
}

export type SerializedManuscriptParagraphNode = Spread<{
  type: "manuscript-paragraph";
  spacingBeforePt: number;
  spacingAfterPt: number;
  lineSpacing: number;
  firstLineIndentPt: number;
  leftIndentPt: number;
  sourcePage?: number;
  confidence?: number;
}, SerializedParagraphNode>;

export class ManuscriptParagraphNode extends ParagraphNode {
  __spacingBeforePt = 0;
  __spacingAfterPt = 6;
  __lineSpacing = 1.5;
  __firstLineIndentPt = 0;
  __leftIndentPt = 0;
  __sourcePage?: number;
  __confidence?: number;

  static getType() { return "manuscript-paragraph"; }
  static clone(node: ManuscriptParagraphNode) {
    const clone = new ManuscriptParagraphNode(node.__key);
    clone.__format = node.__format;
    clone.__style = node.__style;
    clone.__indent = node.__indent;
    clone.__dir = node.__dir;
    clone.__textFormat = node.__textFormat;
    clone.__textStyle = node.__textStyle;
    clone.__spacingBeforePt = node.__spacingBeforePt;
    clone.__spacingAfterPt = node.__spacingAfterPt;
    clone.__lineSpacing = node.__lineSpacing;
    clone.__firstLineIndentPt = node.__firstLineIndentPt;
    clone.__leftIndentPt = node.__leftIndentPt;
    clone.__sourcePage = node.__sourcePage;
    clone.__confidence = node.__confidence;
    return clone;
  }

  static importJSON(serialized: SerializedManuscriptParagraphNode) {
    const node = new ManuscriptParagraphNode();
    node.updateFromJSON(serialized);
    node.__spacingBeforePt = Number(serialized.spacingBeforePt || 0);
    node.__spacingAfterPt = Number(serialized.spacingAfterPt || 0);
    node.__lineSpacing = Number(serialized.lineSpacing || 1);
    node.__firstLineIndentPt = Number(serialized.firstLineIndentPt || 0);
    node.__leftIndentPt = Number(serialized.leftIndentPt || 0);
    node.__sourcePage = serialized.sourcePage;
    node.__confidence = serialized.confidence;
    return node;
  }

  exportJSON(): SerializedManuscriptParagraphNode {
    return { ...super.exportJSON(), type: "manuscript-paragraph", version: 1, spacingBeforePt: this.__spacingBeforePt, spacingAfterPt: this.__spacingAfterPt, lineSpacing: this.__lineSpacing, firstLineIndentPt: this.__firstLineIndentPt, leftIndentPt: this.__leftIndentPt, sourcePage: this.__sourcePage, confidence: this.__confidence };
  }

  createDOM(config: EditorConfig) {
    const dom = super.createDOM(config);
    this.applySpacing(dom);
    return dom;
  }

  updateDOM(previous: ManuscriptParagraphNode, dom: HTMLElement, config: EditorConfig) {
    const changed = super.updateDOM(previous, dom, config);
    this.applySpacing(dom);
    return changed;
  }

  private applySpacing(dom: HTMLElement) {
    dom.style.marginTop = `${this.__spacingBeforePt}pt`;
    dom.style.marginBottom = `${this.__spacingAfterPt}pt`;
    dom.style.lineHeight = String(this.__lineSpacing);
    dom.style.textIndent = `${this.__firstLineIndentPt}pt`;
    dom.style.paddingLeft = `${this.__leftIndentPt}pt`;
    if (this.__sourcePage) dom.dataset.sourcePage = String(this.__sourcePage);
    dom.classList.toggle("is-low-confidence", typeof this.__confidence === "number" && this.__confidence < 0.75);
  }

  setSpacing(values: Partial<Pick<SerializedManuscriptParagraphNode, "spacingBeforePt" | "spacingAfterPt" | "lineSpacing" | "firstLineIndentPt" | "leftIndentPt">>) {
    const writable = this.getWritable();
    if (values.spacingBeforePt !== undefined) writable.__spacingBeforePt = values.spacingBeforePt;
    if (values.spacingAfterPt !== undefined) writable.__spacingAfterPt = values.spacingAfterPt;
    if (values.lineSpacing !== undefined) writable.__lineSpacing = values.lineSpacing;
    if (values.firstLineIndentPt !== undefined) writable.__firstLineIndentPt = values.firstLineIndentPt;
    if (values.leftIndentPt !== undefined) writable.__leftIndentPt = values.leftIndentPt;
    return writable;
  }
}

export function $createManuscriptParagraphNode() {
  return $applyNodeReplacement(new ManuscriptParagraphNode());
}

export type SerializedManuscriptImageNode = Spread<{
  type: "image";
  src: string;
  altText: string;
  caption: string;
  width: number;
  height: number;
  fieldKey?: string;
  fileId?: string | null;
  frozen?: boolean;
}, SerializedLexicalNode>;

export class ManuscriptImageNode extends DecoratorNode<ReactNode> {
  __src: string;
  __altText: string;
  __caption: string;
  __width: number;
  __height: number;
  __fieldKey?: string;
  __fileId?: string | null;
  __frozen = false;

  static getType() { return "image"; }
  static clone(node: ManuscriptImageNode) { return new ManuscriptImageNode(node.__src, node.__altText, node.__caption, node.__width, node.__height, node.__fieldKey, node.__fileId, node.__key, node.__frozen); }
  constructor(src: string, altText = "Manuscript image", caption = "", width = 480, height = 320, fieldKey?: string, fileId?: string | null, key?: NodeKey, frozen = false) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__caption = caption;
    this.__width = width;
    this.__height = height;
    this.__fieldKey = fieldKey;
    this.__fileId = fileId;
    this.__frozen = frozen;
  }
  static importJSON(serialized: SerializedManuscriptImageNode) { return new ManuscriptImageNode(serialized.src, serialized.altText, serialized.caption, serialized.width, serialized.height, serialized.fieldKey, serialized.fileId, undefined, serialized.frozen); }
  exportJSON(): SerializedManuscriptImageNode { return { type: "image", version: 1, src: this.__src, altText: this.__altText, caption: this.__caption, width: this.__width, height: this.__height, fieldKey: this.__fieldKey, fileId: this.__fileId, frozen: this.__frozen }; }
  createDOM() { const dom = document.createElement("figure"); dom.className = "me-document-image-shell"; return dom; }
  updateDOM() { return false; }
  exportDOM(_editor: LexicalEditor): DOMExportOutput { const img = document.createElement("img"); img.src = this.__src; img.alt = this.__altText; return { element: img }; }
  decorate() {
    const style: CSSProperties = { width: `${Math.min(this.__width, 680)}px`, maxWidth: "100%", aspectRatio: this.__width > 0 && this.__height > 0 ? `${this.__width}/${this.__height}` : undefined };
    return <figure className={`me-document-image${this.__fieldKey ? " is-linked" : ""}`}><img src={this.__src} alt={this.__altText} style={style} draggable={false} />{this.__caption ? <figcaption>{this.__caption}</figcaption> : null}</figure>;
  }
  isInline() { return false; }
}

export function $createManuscriptImageNode(input: Omit<SerializedManuscriptImageNode, "type" | "version">) {
  return $applyNodeReplacement(new ManuscriptImageNode(input.src, input.altText, input.caption, input.width, input.height, input.fieldKey, input.fileId, undefined, input.frozen));
}

export type SerializedPageBreakNode = Spread<{ type: "page-break" }, SerializedLexicalNode>;
export class PageBreakNode extends DecoratorNode<ReactNode> {
  static getType() { return "page-break"; }
  static clone(node: PageBreakNode) { return new PageBreakNode(node.__key); }
  static importJSON() { return new PageBreakNode(); }
  exportJSON(): SerializedPageBreakNode { return { type: "page-break", version: 1 }; }
  createDOM() { const dom = document.createElement("div"); dom.className = "me-page-break-shell"; return dom; }
  updateDOM() { return false; }
  decorate() { return <div className="me-page-break" role="separator"><span>Page break</span></div>; }
  isInline() { return false; }
}
export const $createPageBreakNode = () => $applyNodeReplacement(new PageBreakNode());

export type SerializedFootnoteNode = Spread<{ type: "footnote"; noteNumber: number }, SerializedTextNode>;
export class FootnoteNode extends TextNode {
  __noteNumber: number;
  static getType() { return "footnote"; }
  static clone(node: FootnoteNode) { const clone = new FootnoteNode(node.__text, node.__noteNumber, node.__key); clone.__format = node.__format; clone.__style = node.__style; return clone; }
  constructor(text: string, noteNumber: number, key?: NodeKey) { super(text, key); this.__noteNumber = noteNumber; }
  static importJSON(serialized: SerializedFootnoteNode) { const node = new FootnoteNode(serialized.text, serialized.noteNumber); node.updateFromJSON(serialized); return node; }
  exportJSON(): SerializedFootnoteNode { return { ...super.exportJSON(), type: "footnote", version: 1, noteNumber: this.__noteNumber }; }
  createDOM(config: EditorConfig) { const dom = super.createDOM(config); dom.classList.add("me-footnote"); dom.title = `Footnote ${this.__noteNumber}`; return dom; }
}
export const $createFootnoteNode = (text: string, number: number) => $applyNodeReplacement(new FootnoteNode(text, number));

export type SerializedEquationNode = Spread<{ type: "equation"; label: string; sourceXml?: string }, SerializedLexicalNode>;
export class EquationNode extends DecoratorNode<ReactNode> {
  __label: string;
  __sourceXml?: string;
  static getType() { return "equation"; }
  static clone(node: EquationNode) { return new EquationNode(node.__label, node.__sourceXml, node.__key); }
  constructor(label = "Complex equation preserved from source", sourceXml?: string, key?: NodeKey) { super(key); this.__label = label; this.__sourceXml = sourceXml; }
  static importJSON(serialized: SerializedEquationNode) { return new EquationNode(serialized.label, serialized.sourceXml); }
  exportJSON(): SerializedEquationNode { return { type: "equation", version: 1, label: this.__label, sourceXml: this.__sourceXml }; }
  createDOM() { const dom = document.createElement("div"); dom.className = "me-equation-shell"; return dom; }
  updateDOM() { return false; }
  decorate() { return <div className="me-equation" contentEditable={false}><strong>Equation</strong><span>{this.__label}</span><small>Preserved as a non-editable object</small></div>; }
  isInline() { return false; }
}

export const manuscriptNodes = [LinkedFieldNode, ManuscriptParagraphNode, ManuscriptImageNode, PageBreakNode, FootnoteNode, EquationNode];
