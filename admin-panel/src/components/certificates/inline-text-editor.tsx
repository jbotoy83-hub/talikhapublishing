import React, { useRef, useEffect, useState, useCallback } from "react";
import type { TextSegment, CertificateField, BlockStyle } from "./types";
import { normalizeSegments } from "./field-engine";

interface InlineTextEditorProps {
  segments: TextSegment[];
  fields: CertificateField[];
  style: BlockStyle;
  zoom: number;
  onCommit: (segs: TextSegment[]) => void;
}

function makeChipEl(key: string, label: string, style?: Partial<BlockStyle>): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "cert-chip";
  span.contentEditable = "false";
  span.setAttribute("data-key", key);
  if (style && Object.keys(style).length) { span.setAttribute("data-style", JSON.stringify(style)); applyInlineStyle(span, style); }
  span.textContent = label;
  return span;
}

function applyInlineStyle(el: HTMLElement, s: Partial<BlockStyle>): void {
  if (s.fontFamily) el.style.fontFamily = s.fontFamily;
  if (s.fontSize) el.style.fontSize = s.fontSize + "px";
  if (s.fontWeight) el.style.fontWeight = String(s.fontWeight);
  if (s.fontStyle && s.fontStyle !== "normal") el.style.fontStyle = s.fontStyle;
  if (s.color) el.style.color = s.color;
  if (s.textDecoration && s.textDecoration !== "none") el.style.textDecoration = s.textDecoration;
  if (s.letterSpacing) el.style.letterSpacing = s.letterSpacing + "px";
  if (s.lineHeight) el.style.lineHeight = String(s.lineHeight);
}

export function InlineTextEditor({ segments, fields, style, zoom, onCommit }: InlineTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastSerialized = useRef<string>("");
  const focusedRef = useRef(false);
  const committedRef = useRef(false);
  const savedRange = useRef<Range | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const labelOf = useCallback((k: string) => fields.find((f) => f.key === k)?.label || k, [fields]);

  const serialize = useCallback((): TextSegment[] => {
    const el = editorRef.current;
    if (!el) return segments;
    const out: TextSegment[] = [];
    let topBlockSeen = false;

    const walkNode = (node: ChildNode, prependBreak: boolean) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (prependBreak ? "\n" : "") + (node.textContent || "");
        if (text) out.push({ t: "s", v: text });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const e = node as HTMLElement;
        if (e.classList.contains("cert-chip")) {
          const k = e.getAttribute("data-key");
          if (k) {
            let style: Partial<BlockStyle> | undefined;
            try { const raw = e.getAttribute("data-style"); if (raw) style = JSON.parse(raw) as Partial<BlockStyle>; } catch { /* no local field style */ }
            out.push({ t: "f", k, style });
          }
        } else if (e.classList.contains("cert-run")) {
          let runStyle: Partial<BlockStyle> | undefined;
          try { const raw = e.getAttribute("data-style"); if (raw) runStyle = JSON.parse(raw) as Partial<BlockStyle>; } catch { /* skip */ }
          const inner = e.textContent || "";
          if (inner) out.push({ t: "s", v: (prependBreak ? "\n" : "") + inner, style: runStyle });
        } else if (e.tagName === "BR") {
          out.push({ t: "s", v: "\n" });
        } else if (e.tagName === "DIV" || e.tagName === "P") {
          const children = Array.from(e.childNodes);
          children.forEach((child, i) => walkNode(child, topBlockSeen && i === 0));
          topBlockSeen = true;
          return;
        } else {
          const inner = e.textContent || "";
          if (inner) out.push({ t: "s", v: (prependBreak ? "\n" : "") + inner });
        }
      }
    };

    const children = Array.from(el.childNodes);
    children.forEach((node, i) => {
      walkNode(node, i > 0 && topBlockSeen);
      topBlockSeen = true;
    });

    return normalizeSegments(out);
  }, [segments]);

  const buildDOM = useCallback((segs: TextSegment[]) => {
    const el = editorRef.current;
    if (!el) return;
    el.textContent = "";
    for (const s of segs) {
      if (s.t === "s") {
        if (s.style && Object.keys(s.style).length > 0) {
          const span = document.createElement("span");
          span.className = "cert-run";
          span.setAttribute("data-style", JSON.stringify(s.style));
          applyInlineStyle(span, s.style);
          span.textContent = s.v;
          el.appendChild(span);
        } else {
          el.appendChild(document.createTextNode(s.v));
        }
      } else {
        el.appendChild(makeChipEl(s.k, labelOf(s.k), s.style));
      }
    }
    lastSerialized.current = JSON.stringify(segs);
  }, [labelOf]);

  useEffect(() => {
    buildDOM(segments.length ? segments : [{ t: "s", v: "" }]);
    committedRef.current = false;
    const el = editorRef.current;
    if (el) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
      el.focus();
    }
  }, []);

  useEffect(() => {
    const json = JSON.stringify(segments);
    if (focusedRef.current || json === lastSerialized.current) return;
    buildDOM(segments);
  }, [segments, buildDOM]);

  const commit = useCallback(() => {
    const segs = serialize();
    const json = JSON.stringify(segs);
    if (json !== lastSerialized.current) {
      lastSerialized.current = json;
      onCommit(segs);
    }
    committedRef.current = true;
  }, [serialize, onCommit]);

  const handleInput = useCallback(() => {
    const segs = serialize();
    const json = JSON.stringify(segs);
    if (json === lastSerialized.current) return;
    lastSerialized.current = json;
    onCommit(segs);
  }, [serialize, onCommit]);

  useEffect(() => {
    return () => {
      if (!committedRef.current) {
        const segs = serialize();
        lastSerialized.current = JSON.stringify(segs);
        onCommit(segs);
      }
    };
  }, []);

  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (!sel || !el) { setHasSelection(false); return; }
    const has = !sel.isCollapsed && sel.rangeCount > 0 && el.contains(sel.anchorNode);
    setHasSelection(has);
    if (has && sel.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
    window.dispatchEvent(new CustomEvent("cert-selection-changed", { detail: { hasSelection: has } }));
  }, []);

  useEffect(() => {
    const handler = () => { if (focusedRef.current) checkSelection(); };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [checkSelection]);

  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent<{ fieldKey: string }>).detail?.fieldKey;
      if (!key) return;
      const el = editorRef.current;
      if (!el) return;
      if (savedRange.current) {
        const sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
      }
      const sel = window.getSelection();
      if (!el || !sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return;
      range.deleteContents();
      const chip = makeChipEl(key, labelOf(key));
      range.insertNode(chip);
      const after = document.createRange();
      after.setStartAfter(chip);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
      savedRange.current = null;
      setHasSelection(false);
      handleInput();
    };
    window.addEventListener("cert-insert-field-at-selection", handler);
    return () => window.removeEventListener("cert-insert-field-at-selection", handler);
  }, [labelOf, handleInput]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ style: Partial<BlockStyle>; toggleProp?: string; fontSizeDelta?: number }>).detail;
      if (!detail || !detail.style) return;
      if (savedRange.current) {
        const sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
      }
      const sel = window.getSelection();
      const el = editorRef.current;
      if (!sel || !sel.rangeCount || sel.isCollapsed || !el) return;
      if (detail.fontSizeDelta) {
        const delta = detail.fontSizeDelta;
        const range = sel.getRangeAt(0);
        const wholeEditor = document.createRange();
        wholeEditor.selectNodeContents(el);
        const selectsWholeEditor = range.compareBoundaryPoints(Range.START_TO_START, wholeEditor) === 0
          && range.compareBoundaryPoints(Range.END_TO_END, wholeEditor) === 0;
        if (selectsWholeEditor) {
          window.dispatchEvent(new CustomEvent("cert-change-block-font-size", { detail: { delta } }));
          return;
        }
        const styledRuns = [...el.querySelectorAll<HTMLElement>(".cert-run")].filter((run) => range.intersectsNode(run));
        const baseSize = Math.max(1, style.fontSize + delta);
        const wrapper = document.createElement("span");
        wrapper.className = "cert-run";
        const runStyle: Partial<BlockStyle> = { fontSize: baseSize };
        wrapper.setAttribute("data-style", JSON.stringify(runStyle));
        applyInlineStyle(wrapper, runStyle);
        try { range.surroundContents(wrapper); } catch { const frag = range.extractContents(); wrapper.appendChild(frag); range.insertNode(wrapper); }
        styledRuns.forEach((run) => {
          let rs: Partial<BlockStyle> = {};
          try { rs = JSON.parse(run.getAttribute("data-style") || "{}") as Partial<BlockStyle>; } catch { /* skip */ }
          const current = rs.fontSize || style.fontSize;
          rs.fontSize = Math.max(1, current + delta);
          run.setAttribute("data-style", JSON.stringify(rs));
          run.removeAttribute("style");
          applyInlineStyle(run, rs);
        });
        handleInput();
        return;
      }
      if (detail.toggleProp) {
        const anchor = sel.anchorNode;
        const runEl = anchor && anchor.nodeType === Node.TEXT_NODE
          ? anchor.parentElement?.closest(".cert-run")
          : (anchor as Element)?.closest?.(".cert-run");
        if (runEl) {
          const raw = runEl.getAttribute("data-style");
          if (raw) {
            try {
              const rs = JSON.parse(raw) as Record<string, unknown>;
              const prop = detail.toggleProp;
              const incoming = (detail.style as Record<string, unknown>)[prop];
              if (rs[prop] === incoming) {
                delete rs[prop];
                if (Object.keys(rs).length === 0) {
                  const parent = runEl.parentNode;
                  if (parent) { while (runEl.firstChild) parent.insertBefore(runEl.firstChild, runEl); parent.removeChild(runEl); }
                } else {
                  runEl.setAttribute("data-style", JSON.stringify(rs));
                  (runEl as HTMLElement).removeAttribute("style");
                  applyInlineStyle(runEl as HTMLElement, rs as Partial<BlockStyle>);
                }
                handleInput();
                return;
              }
            } catch { /* fall through */ }
          }
        }
      }
      const range = sel.getRangeAt(0);
      const wrapper = document.createElement("span");
      wrapper.className = "cert-run";
      wrapper.setAttribute("data-style", JSON.stringify(detail.style));
      applyInlineStyle(wrapper, detail.style);
      try { range.surroundContents(wrapper); } catch { const frag = range.extractContents(); wrapper.appendChild(frag); range.insertNode(wrapper); }
      const newRange = document.createRange();
      newRange.selectNodeContents(wrapper);
      sel.removeAllRanges();
      sel.addRange(newRange);
      handleInput();
    };
    window.addEventListener("cert-apply-format", handler);
    return () => window.removeEventListener("cert-apply-format", handler);
  }, [handleInput, style.fontSize]);

  const rootStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    color: style.color,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textDecoration: style.textDecoration === "none" ? undefined : style.textDecoration,
    textTransform: style.textTransform === "none" ? undefined : style.textTransform,
    textJustify: style.textAlign === "justify" ? "inter-word" : undefined,
    padding: style.padding,
    margin: 0,
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    outline: "none",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflow: "auto",
    cursor: "text",
  };

  return (
    <div
      ref={wrapperRef}
      className="cert-inline-wrap"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        ref={editorRef}
        className="cert-inline-editor"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        style={rootStyle}
        onInput={handleInput}
        onBlur={(e) => {
          const related = e.relatedTarget as Node | null;
          if (related && wrapperRef.current && wrapperRef.current.contains(related)) return;
          focusedRef.current = false;
          setHasSelection(false);
          commit();
        }}
        onFocus={() => { focusedRef.current = true; }}
        onPointerDown={(e) => { e.stopPropagation(); }}
        onPointerUp={(e) => { e.stopPropagation(); requestAnimationFrame(checkSelection); }}
        onKeyUp={() => checkSelection()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
