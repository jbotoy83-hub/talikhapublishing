import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode } from "@lexical/list";
import { $patchStyleText, $setBlocksType } from "@lexical/selection";
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { INSERT_TABLE_COMMAND, TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import {
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type TextFormatType,
} from "lexical";
import { Search, X } from "@/components/icons";
import type { EditorMetrics, ManuscriptEditorState, ManuscriptFieldValue, ManuscriptPageSettings } from "./types";
import { manuscriptPlainTextFromState, manuscriptWordCount } from "./types";
import {
  $createFootnoteNode,
  $createLinkedFieldNode,
  $createManuscriptImageNode,
  $createManuscriptParagraphNode,
  $createPageBreakNode,
  $isLinkedFieldNode,
  LinkedFieldNode,
  ManuscriptImageNode,
  ManuscriptParagraphNode,
  PageBreakNode,
  FootnoteNode,
  EquationNode,
} from "./nodes";

export type ManuscriptOutlineItem = { key: string; text: string; level: number };

const fonts = [
  { label: "Source font", value: "inherit" },
  { label: "Liberation Serif", value: "Tinos" },
  { label: "Liberation Sans", value: "Arimo" },
  { label: "Carlito", value: "Carlito" },
  { label: "Caladea", value: "Caladea" },
  { label: "EB Garamond", value: "EB Garamond" },
  { label: "Courier Prime", value: "Courier Prime" },
];
const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

function topLevel(node: LexicalNode) {
  let current = node;
  while (current.getParent() && current.getParent()?.getType() !== "root") current = current.getParent()!;
  return current;
}

function applyParagraphSpacing(values: { lineSpacing?: number; spacingBeforePt?: number; spacingAfterPt?: number; firstLineIndentPt?: number; leftIndentPt?: number }) {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;
  const blocks = new Set(selection.getNodes().map(topLevel));
  blocks.forEach((block) => {
    if (block instanceof ManuscriptParagraphNode) block.setSpacing(values);
    else if ($isElementNode(block)) {
      const styles = [
        values.lineSpacing === undefined ? "" : `line-height:${values.lineSpacing}`,
        values.spacingBeforePt === undefined ? "" : `margin-top:${values.spacingBeforePt}pt`,
        values.spacingAfterPt === undefined ? "" : `margin-bottom:${values.spacingAfterPt}pt`,
        values.firstLineIndentPt === undefined ? "" : `text-indent:${values.firstLineIndentPt}pt`,
        values.leftIndentPt === undefined ? "" : `padding-left:${values.leftIndentPt}pt`,
      ].filter(Boolean).join(";");
      block.setStyle(`${block.getStyle()};${styles}`);
    }
  });
}

function sanitizeLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[\w.-]+@[\w.-]+\.[a-z]{2,}$/i.test(trimmed)) return `mailto:${trimmed}`;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function ToolButton({ label, title, active, disabled, onClick }: { label: string; title: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className={`me-tool-button ${active ? "is-active" : ""}`} title={title} aria-label={title} aria-pressed={active} disabled={disabled} onClick={onClick}>{label}</button>;
}

function Toolbar({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [formats, setFormats] = useState<Record<string, boolean>>({});
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [matches, setMatches] = useState(0);
  const [matchIndex, setMatchIndex] = useState(0);
  const imageInput = useRef<HTMLInputElement>(null);

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      setFormats({ bold: selection.hasFormat("bold"), italic: selection.hasFormat("italic"), underline: selection.hasFormat("underline"), strikethrough: selection.hasFormat("strikethrough") });
    });
  }, [editor]);

  useEffect(() => editor.registerCommand(SELECTION_CHANGE_COMMAND, () => { updateToolbar(); return false; }, COMMAND_PRIORITY_LOW), [editor, updateToolbar]);
  useEffect(() => editor.registerUpdateListener(({ editorState }) => editorState.read(updateToolbar)), [editor, updateToolbar]);

  const formatText = (format: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  const patchStyle = (property: string, value: string | null) => editor.update(() => { const selection = $getSelection(); if ($isRangeSelection(selection)) $patchStyleText(selection, { [property]: value }); });
  const setBlock = (kind: string) => editor.update(() => {
    const selection = $getSelection();
    if (kind === "paragraph") $setBlocksType(selection, () => $createManuscriptParagraphNode());
    else if (kind === "quote") $setBlocksType(selection, () => $createQuoteNode());
    else $setBlocksType(selection, () => $createHeadingNode(kind as "h1" | "h2" | "h3"));
  });
  const clearFormatting = () => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    selection.getNodes().forEach((node) => {
      if ($isTextNode(node)) { node.setFormat(0); node.setStyle(""); }
      const block = topLevel(node);
      if ($isElementNode(block)) block.setStyle("");
    });
  });
  const insertLink = () => {
    const current = window.prompt("Paste a safe web or email address");
    if (current === null) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, sanitizeLink(current));
  };
  const insertFootnote = () => {
    const text = window.prompt("Footnote text");
    if (!text?.trim()) return;
    editor.update(() => { const count = $getRoot().getAllTextNodes().filter((node) => node instanceof FootnoteNode).length; $insertNodes([$createFootnoteNode(text.trim(), count + 1)]); });
  };
  const insertImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) { window.alert("Use a JPG, PNG, GIF, or WebP image up to 4 MB."); return; }
    const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    const dimensions = await new Promise<{ width: number; height: number }>((resolve) => { const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth || 480, height: image.naturalHeight || 320 }); image.onerror = () => resolve({ width: 480, height: 320 }); image.src = src; });
    editor.update(() => $insertNodes([$createManuscriptImageNode({ src, altText: file.name, caption: "", width: dimensions.width, height: dimensions.height })]));
  };

  const findMatches = useCallback((direction = 0) => editor.getEditorState().read(() => {
    const query = find.toLocaleLowerCase();
    const found: Array<{ node: ReturnType<typeof $getRoot>["getAllTextNodes"] extends () => infer R ? R extends Array<infer N> ? N : never : never; start: number }> = [];
    if (query) $getRoot().getAllTextNodes().forEach((node) => {
      const haystack = node.getTextContent().toLocaleLowerCase();
      let start = haystack.indexOf(query);
      while (start >= 0) { found.push({ node, start }); start = haystack.indexOf(query, start + Math.max(1, query.length)); }
    });
    setMatches(found.length);
    if (!found.length) { setMatchIndex(0); return; }
    const next = direction ? (matchIndex + direction + found.length) % found.length : Math.min(matchIndex, found.length - 1);
    setMatchIndex(next);
    if (direction) editor.update(() => { const target = found[next]; target.node.select(target.start, target.start + find.length); window.requestAnimationFrame(() => editor.getElementByKey(target.node.getKey())?.scrollIntoView({ block: "center", behavior: "smooth" })); });
  }), [editor, find, matchIndex]);

  useEffect(() => { if (findOpen) findMatches(); }, [find, findOpen, findMatches]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "f") { event.preventDefault(); setFindOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const replaceCurrent = () => editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection) && selection.getTextContent().toLocaleLowerCase() === find.toLocaleLowerCase()) selection.insertText(replace);
  });
  const replaceAll = () => editor.update(() => {
    if (!find) return;
    const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    $getRoot().getAllTextNodes().forEach((node) => {
      const value = node.getTextContent();
      if (pattern.test(value)) node.setTextContent(value.replace(pattern, replace));
      pattern.lastIndex = 0;
    });
  });

  return <div className="me-formatting-area">
    <div className="me-format-toolbar" aria-label="Manuscript formatting tools">
      <select className="me-tool-select me-style-select" aria-label="Paragraph style" disabled={!editable} defaultValue="paragraph" onChange={(event) => setBlock(event.target.value)}><option value="paragraph">Body text</option><option value="h1">Title</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="quote">Block quote</option></select>
      <span className="me-toolbar-separator" />
      <select className="me-tool-select me-font-select" aria-label="Font" disabled={!editable} defaultValue="inherit" onChange={(event) => patchStyle("font-family", event.target.value === "inherit" ? null : event.target.value)}>{fonts.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select>
      <select className="me-tool-select me-size-select" aria-label="Font size" disabled={!editable} defaultValue="12" onChange={(event) => patchStyle("font-size", `${event.target.value}pt`)}>{fontSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select>
      <span className="me-toolbar-separator" />
      <ToolButton label="B" title="Bold (Ctrl+B)" active={formats.bold} disabled={!editable} onClick={() => formatText("bold")} />
      <ToolButton label="I" title="Italic (Ctrl+I)" active={formats.italic} disabled={!editable} onClick={() => formatText("italic")} />
      <ToolButton label="U" title="Underline (Ctrl+U)" active={formats.underline} disabled={!editable} onClick={() => formatText("underline")} />
      <ToolButton label="S" title="Strikethrough" active={formats.strikethrough} disabled={!editable} onClick={() => formatText("strikethrough")} />
      <label className="me-color-tool" title="Text color"><span>A</span><input type="color" aria-label="Text color" disabled={!editable} defaultValue="#1d211f" onChange={(event) => patchStyle("color", event.target.value)} /></label>
      <label className="me-color-tool is-highlight" title="Highlight color"><span>▰</span><input type="color" aria-label="Highlight color" disabled={!editable} defaultValue="#fff1a8" onChange={(event) => patchStyle("background-color", event.target.value)} /></label>
      <span className="me-toolbar-separator" />
      {(["left", "center", "right", "justify"] as const).map((align) => <ToolButton key={align} label={{ left: "≡", center: "≣", right: "≡", justify: "▤" }[align]} title={`Align ${align}`} disabled={!editable} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align as ElementFormatType)} />)}
      <select className="me-tool-select me-compact-select" aria-label="Line spacing" title="Line spacing" disabled={!editable} defaultValue="1.5" onChange={(event) => editor.update(() => applyParagraphSpacing({ lineSpacing: Number(event.target.value) }))}><option value="1">1.0</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">2.0</option></select>
      <select className="me-tool-select me-compact-select" aria-label="Paragraph spacing" title="Paragraph spacing after" disabled={!editable} defaultValue="6" onChange={(event) => editor.update(() => applyParagraphSpacing({ spacingAfterPt: Number(event.target.value) }))}><option value="0">0 pt</option><option value="3">3 pt</option><option value="6">6 pt</option><option value="8">8 pt</option><option value="12">12 pt</option><option value="18">18 pt</option></select>
      <ToolButton label="↦" title="First-line indent 0.5 inch" disabled={!editable} onClick={() => editor.update(() => applyParagraphSpacing({ firstLineIndentPt: 36 }))} />
      <ToolButton label="↤" title="Hanging indent 0.5 inch" disabled={!editable} onClick={() => editor.update(() => applyParagraphSpacing({ firstLineIndentPt: -36, leftIndentPt: 36 }))} />
      <span className="me-toolbar-separator" />
      <ToolButton label="•" title="Bulleted list" disabled={!editable} onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} />
      <ToolButton label="1." title="Numbered list" disabled={!editable} onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} />
      <ToolButton label="←" title="Decrease indent" disabled={!editable} onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)} />
      <ToolButton label="→" title="Increase indent" disabled={!editable} onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)} />
      <ToolButton label="↗" title="Add or remove link" disabled={!editable} onClick={insertLink} />
      <ToolButton label="▦" title="Insert 3 × 3 table" disabled={!editable} onClick={() => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", rows: "3", includeHeaders: true })} />
      <ToolButton label="▧" title="Insert image" disabled={!editable} onClick={() => imageInput.current?.click()} />
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(event) => { void insertImage(event.target.files?.[0]); event.target.value = ""; }} />
      <ToolButton label="¶" title="Insert page break" disabled={!editable} onClick={() => editor.update(() => $insertNodes([$createPageBreakNode()]))} />
      <ToolButton label="¹" title="Insert footnote" disabled={!editable} onClick={insertFootnote} />
      <ToolButton label="Tx" title="Clear formatting" disabled={!editable} onClick={clearFormatting} />
      <span className="me-toolbar-separator" />
      <ToolButton label="↶" title="Undo (Ctrl+Z)" disabled={!editable} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} />
      <ToolButton label="↷" title="Redo (Ctrl+Y)" disabled={!editable} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} />
      <button type="button" className={`me-tool-button ${findOpen ? "is-active" : ""}`} title="Find and replace (Ctrl+F)" aria-label="Find and replace" onClick={() => setFindOpen((value) => !value)}><Search size={16} /></button>
    </div>
    {findOpen ? <div className="me-findbar"><Search size={16} /><input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Find" aria-label="Find text" autoFocus /><span>{matches ? `${matchIndex + 1} / ${matches}` : "0 / 0"}</span><button type="button" onClick={() => findMatches(-1)} disabled={!matches}>↑</button><button type="button" onClick={() => findMatches(1)} disabled={!matches}>↓</button><input value={replace} onChange={(event) => setReplace(event.target.value)} placeholder="Replace with" aria-label="Replacement text" /><button type="button" onClick={replaceCurrent} disabled={!editable || !matches}>Replace</button><button type="button" onClick={replaceAll} disabled={!editable || !matches}>All</button><button type="button" className="me-find-close" aria-label="Close find and replace" onClick={() => setFindOpen(false)}><X size={15} /></button></div> : null}
  </div>;
}

function EditorControl({ editable, onReady, onSelectedWords }: { editable: boolean; onReady: (editor: LexicalEditor) => void; onSelectedWords: (count: number) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => { editor.setEditable(editable); }, [editable, editor]);
  useEffect(() => { onReady(editor); }, [editor, onReady]);
  useEffect(() => editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
    editor.getEditorState().read(() => { const selection = $getSelection(); onSelectedWords($isRangeSelection(selection) ? manuscriptWordCount(selection.getTextContent()) : 0); });
    return false;
  }, COMMAND_PRIORITY_LOW), [editor, onSelectedWords]);
  return null;
}

function extractOutline(value: unknown, output: ManuscriptOutlineItem[] = []): ManuscriptOutlineItem[] {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) { value.forEach((child) => extractOutline(child, output)); return output; }
  const node = value as Record<string, unknown>;
  if (node.type === "heading") {
    const text = collectText(node).trim();
    if (text) output.push({ key: `outline-${output.length}`, text, level: node.tag === "h1" ? 1 : node.tag === "h2" ? 2 : 3 });
  }
  if (Array.isArray(node.children)) extractOutline(node.children, output);
  return output;
}

function collectText(value: unknown): string {
  if (!value || typeof value !== "object") return typeof value === "string" ? value : "";
  if (Array.isArray(value)) return value.map(collectText).join("");
  const node = value as Record<string, unknown>;
  if (typeof node.text === "string") return node.text;
  return Array.isArray(node.children) ? node.children.map(collectText).join("") : "";
}

export function insertLinkedField(editor: LexicalEditor, field: ManuscriptFieldValue) {
  editor.update(() => {
    if (field.kind === "image") {
      if (!field.value) return;
      $insertNodes([$createManuscriptImageNode({ src: field.value, altText: field.label, caption: "", width: 180, height: 180, fieldKey: field.key, fileId: field.fileId || null })]);
    } else $insertNodes([$createLinkedFieldNode({ text: field.value || `[${field.label}]`, fieldKey: field.key, fieldLabel: field.label, sourcePath: field.sourcePath, sourceValue: field.value, private: field.private })]);
  });
}

export function convertLinkedFieldToFixed(editor: LexicalEditor, fieldKey: string) {
  editor.update(() => {
    $getRoot().getAllTextNodes().forEach((node) => {
      if ($isLinkedFieldNode(node) && node.__fieldKey === fieldKey) node.convertToFixedText();
    });
  });
}

export function scrollToOutlineHeading(editor: LexicalEditor, headingIndex: number) {
  let key = "";
  editor.getEditorState().read(() => {
    const headings = $getRoot().getChildren().filter((node) => node.getType() === "heading");
    key = headings[headingIndex]?.getKey() || "";
  });
  if (key) editor.getElementByKey(key)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function applyTalikhaPreset(editor: LexicalEditor) {
  editor.update(() => {
    const root = $getRoot();
    root.getChildren().forEach((node, index) => {
      if ($isElementNode(node)) {
        node.setFormat(index === 0 ? "center" : "left");
        node.setStyle(index === 0 ? "margin:0 0 12pt;line-height:1.2" : "margin:0 0 6pt;line-height:1.5;text-indent:36pt");
        node.getAllTextNodes().forEach((text) => text.setStyle(index === 0 ? "font-family:Tinos;font-size:16pt" : "font-family:Tinos;font-size:12pt"));
      }
    });
  });
}

export function ManuscriptEditor({ initialState, editable, pageSettings, zoom, onReady, onDocumentChange, onMetricsChange }: {
  initialState: ManuscriptEditorState;
  editable: boolean;
  pageSettings: ManuscriptPageSettings;
  zoom: number;
  onReady: (editor: LexicalEditor) => void;
  onDocumentChange: (state: ManuscriptEditorState, contentText: string, outline: ManuscriptOutlineItem[]) => void;
  onMetricsChange: (metrics: EditorMetrics) => void;
}) {
  const selectedWords = useRef(0);
  const metricsRef = useRef<EditorMetrics>({ words: 0, characters: 0, paragraphs: 0, selectedWords: 0 });
  const initialConfig = useMemo(() => ({
    namespace: "TalikhaManuscriptEditor",
    editable,
    editorState: JSON.stringify(initialState),
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, TableNode, TableCellNode, TableRowNode, LinkedFieldNode, ManuscriptParagraphNode, ManuscriptImageNode, PageBreakNode, FootnoteNode, EquationNode],
    theme: { paragraph: "me-editor-paragraph", heading: { h1: "me-editor-h1", h2: "me-editor-h2", h3: "me-editor-h3" }, quote: "me-editor-quote", list: { ul: "me-editor-ul", ol: "me-editor-ol", listitem: "me-editor-li" }, link: "me-editor-link", text: { bold: "me-text-bold", italic: "me-text-italic", underline: "me-text-underline", strikethrough: "me-text-strike" }, table: "me-editor-table", tableCell: "me-editor-cell", tableCellHeader: "me-editor-cell-header" },
    onError: (error: Error) => { throw error; },
  }), [editable, initialState]);

  const onChange = useCallback((editorState: EditorState) => {
    const state = editorState.toJSON() as unknown as ManuscriptEditorState;
    const contentText = manuscriptPlainTextFromState(state);
    const paragraphs = contentText ? contentText.split(/\n+/).filter(Boolean).length : 0;
    onDocumentChange(state, contentText, extractOutline(state));
    metricsRef.current = { words: manuscriptWordCount(contentText), characters: contentText.length, paragraphs, selectedWords: selectedWords.current };
    onMetricsChange(metricsRef.current);
  }, [onDocumentChange, onMetricsChange]);

  const paperStyle = {
    "--me-margin-top": `${pageSettings.marginTopMm}mm`,
    "--me-margin-right": `${pageSettings.marginRightMm}mm`,
    "--me-margin-bottom": `${pageSettings.marginBottomMm}mm`,
    "--me-margin-left": `${pageSettings.marginLeftMm}mm`,
    "--me-paper-width": pageSettings.orientation === "portrait" ? "210mm" : "297mm",
    "--me-page-height": pageSettings.orientation === "portrait" ? "297mm" : "210mm",
    zoom: zoom / 100,
  } as CSSProperties;

  return <LexicalComposer initialConfig={initialConfig}>
    <Toolbar editable={editable} />
    <div className={`me-canvas-scroll ${pageSettings.showGrid ? "show-grid" : ""}`}>
      {pageSettings.showRuler ? <div className="me-ruler-horizontal" aria-hidden="true"><span>0</span><span>5</span><span>10</span><span>15</span><span>20</span></div> : null}
      <div className="me-paper-stage">
        <div className="me-paper" style={paperStyle}>
          {pageSettings.showRuler ? <div className="me-ruler-vertical" aria-hidden="true"><span>0</span><span>10</span><span>20</span></div> : null}
          <RichTextPlugin contentEditable={<ContentEditable className="me-content-editable" aria-label="Manuscript document" spellCheck />} placeholder={<div className="me-editor-placeholder">Start writing or import the original manuscript.</div>} ErrorBoundary={LexicalErrorBoundary} />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin validateUrl={(url) => Boolean(sanitizeLink(url))} />
          <TablePlugin hasCellMerge hasCellBackgroundColor hasHorizontalScroll />
          <TabIndentationPlugin />
          <OnChangePlugin onChange={onChange} ignoreSelectionChange />
          <EditorControl editable={editable} onReady={onReady} onSelectedWords={(count) => { selectedWords.current = count; metricsRef.current = { ...metricsRef.current, selectedWords: count }; onMetricsChange(metricsRef.current); }} />
        </div>
      </div>
    </div>
  </LexicalComposer>;
}
