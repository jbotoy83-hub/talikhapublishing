import React, { useRef, useEffect, useState, useCallback } from "react";
import type { TextSegment, CertificateField, BlockStyle } from "./types";
import { CERT_FONTS } from "./types";
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

type PopoverMode = "toolbar" | "link" | "style";
interface PopoverState { x: number; y: number; mode: PopoverMode }

const WEIGHT_OPTIONS = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semibold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "X-Bold", value: 800 },
  { label: "Black", value: 900 },
];

export function InlineTextEditor({ segments, fields, style, zoom, onCommit }: InlineTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastSerialized = useRef<string>("");
  const focusedRef = useRef(false);
  const selectionDraggingRef = useRef(false);
  const committedRef = useRef(false);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [customStyle, setCustomStyle] = useState<Partial<BlockStyle>>({});

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
          const styleStr = e.getAttribute("data-style");
          let runStyle: Partial<BlockStyle> | undefined;
          if (styleStr) { try { runStyle = JSON.parse(styleStr); } catch { /* skip */ } }
          const kids = e.childNodes;
          for (let i = 0; i < kids.length; i++) {
            const c = kids[i];
            const lb = prependBreak && i === 0;
            if (c.nodeType === Node.TEXT_NODE) {
              out.push({ t: "s", v: (lb ? "\n" : "") + (c.textContent || ""), style: runStyle });
            } else if (c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName === "BR") {
              out.push({ t: "s", v: "\n", style: runStyle });
            } else {
              walkNode(c, lb);
            }
          }
        } else if (e.tagName === "BR") {
          out.push({ t: "s", v: (prependBreak ? "\n\n" : "\n") });
        } else {
          const isBlock = e.tagName === "DIV" || e.tagName === "P";
          const needBreak = prependBreak || isBlock;
          const kids = e.childNodes;
          for (let i = 0; i < kids.length; i++) {
            walkNode(kids[i], needBreak && i === 0);
          }
        }
      }
    };

    const topKids = el.childNodes;
    for (let i = 0; i < topKids.length; i++) {
      const node = topKids[i];
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName;
        if (tag === "DIV" || tag === "P") {
          walkNode(node, topBlockSeen);
          topBlockSeen = true;
          continue;
        }
      }
      walkNode(node, false);
      topBlockSeen = true;
    }

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

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }, []);

  const updatePopover = useCallback(() => {
    const sel = window.getSelection();
    const el = editorRef.current;
    const wrap = wrapperRef.current;
    if (!sel || sel.isCollapsed || !sel.rangeCount || !el || !wrap || !el.contains(sel.anchorNode)) {
      setPopover(null);
      savedRange.current = null;
      return;
    }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) { setPopover(null); savedRange.current = null; return; }
    const rr = range.getBoundingClientRect();
    if (rr.width === 0 && rr.height === 0) { setPopover(null); savedRange.current = null; return; }
    const wr = wrap.getBoundingClientRect();
    const z = zoom || 1;
    let left = (rr.left - wr.left) / z + rr.width / (2 * z);
    const top = (rr.top - wr.top) / z - 48;
    left = Math.max(4, Math.min(left, wr.width / z - 4));
    savedRange.current = range.cloneRange();
    // Formatting lives in the main editor toolbar. Keep the saved selection
    // quietly, and only position a panel when the user explicitly opens Link.
    setPopover((prev) => prev ? { ...prev, x: left, y: Math.max(4, top) } : null);
  }, [zoom]);

  useEffect(() => {
    const handler = () => { if (focusedRef.current && !selectionDraggingRef.current) updatePopover(); };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [updatePopover]);

  const openPanel = useCallback((mode: "link" | "style") => {
    saveSelection();
    setPopover((prev) => prev ? { ...prev, mode } : { x: 50, y: 4, mode });
    if (mode === "style") {
      setCustomStyle({});
    }
    if (mode === "link") {
      setLinkSearch("");
    }
  }, [saveSelection]);

  useEffect(() => {
    const handler = () => { if (focusedRef.current && savedRange.current) openPanel("link"); };
    window.addEventListener("cert-open-link-panel", handler);
    return () => window.removeEventListener("cert-open-link-panel", handler);
  }, [openPanel]);

  const closePopover = useCallback(() => {
    setPopover(null);
    savedRange.current = null;
  }, []);

  const applyStyleToSelection = useCallback((runStyle: Partial<BlockStyle>) => {
    const el = editorRef.current;
    if (!el) return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const wrapper = document.createElement("span");
    wrapper.className = "cert-run";
    wrapper.setAttribute("data-style", JSON.stringify(runStyle));
    applyInlineStyle(wrapper, runStyle);

    try {
      range.surroundContents(wrapper);
    } catch {
      const frag = range.extractContents();
      wrapper.appendChild(frag);
      range.insertNode(wrapper);
    }

    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    sel.removeAllRanges();
    sel.addRange(newRange);

    handleInput();
    setPopover(null);
  }, [restoreSelection, handleInput]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ style: Partial<BlockStyle>; toggleProp?: string; fontSizeDelta?: number }>).detail;
      if (!detail || !detail.style) return;
      restoreSelection();
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
          setPopover(null);
          return;
        }
        const styledRuns = [...el.querySelectorAll<HTMLElement>(".cert-run")].filter((run) => range.intersectsNode(run));
        // Apply a size to ordinary text, then adjust existing styled runs so a
        // select-all operation never leaves part of the paragraph unchanged.
        const baseSize = Math.max(1, style.fontSize + delta);
        applyStyleToSelection({ fontSize: baseSize });
        styledRuns.forEach((run) => {
          let runStyle: Partial<BlockStyle> = {};
          try { runStyle = JSON.parse(run.getAttribute("data-style") || "{}") as Partial<BlockStyle>; } catch { /* use inherited size */ }
          const current = runStyle.fontSize || style.fontSize;
          runStyle.fontSize = Math.max(1, current + delta);
          run.setAttribute("data-style", JSON.stringify(runStyle));
          run.removeAttribute("style");
          applyInlineStyle(run, runStyle);
        });
        handleInput();
        setPopover(null);
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
                setPopover(null);
                return;
              }
            } catch { /* fall through */ }
          }
        }
      }
      applyStyleToSelection(detail.style);
    };
    window.addEventListener("cert-apply-format", handler);
    return () => window.removeEventListener("cert-apply-format", handler);
  }, [restoreSelection, applyStyleToSelection, handleInput, style.fontSize]);

  const clearStyleFromSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const runs = el.querySelectorAll(".cert-run");
    let changed = false;
    runs.forEach((run) => {
      if (range.intersectsNode(run)) {
        const parent = run.parentNode;
        if (!parent) return;
        while (run.firstChild) parent.insertBefore(run.firstChild, run);
        parent.removeChild(run);
        changed = true;
      }
    });
    if (changed) {
      handleInput();
    }
    setPopover(null);
  }, [restoreSelection, handleInput]);

  const insertField = useCallback((key: string) => {
    const el = editorRef.current;
    if (!el) return;
    restoreSelection();
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
    setPopover(null);
    handleInput();
  }, [labelOf, handleInput, restoreSelection]);

  const removeFieldLink = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const fragment = range.cloneContents();
    const chip = fragment.querySelector?.(".cert-chip") as HTMLElement | null;
    const replacement = chip?.textContent || range.toString() || "Linked field";
    range.deleteContents();
    const text = document.createTextNode(replacement);
    range.insertNode(text);
    const after = document.createRange(); after.setStartAfter(text); after.collapse(true);
    sel.removeAllRanges(); sel.addRange(after);
    closePopover();
    handleInput();
  }, [restoreSelection, closePopover, handleInput]);

  const filteredFields = fields.filter((f) =>
    !linkSearch || f.label.toLowerCase().includes(linkSearch.toLowerCase()) || f.key.includes(linkSearch.toLowerCase())
  );

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
          setPopover(null);
          commit();
        }}
        onFocus={() => { focusedRef.current = true; }}
        onPointerDown={(e) => { e.stopPropagation(); selectionDraggingRef.current = true; setPopover(null); }}
        onPointerUp={(e) => { e.stopPropagation(); selectionDraggingRef.current = false; requestAnimationFrame(updatePopover); }}
        onKeyUp={() => updatePopover()}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {popover && (
        <div
          className={"cert-sel-popover cert-sel-popover--" + popover.mode}
          style={{ position: "absolute", left: popover.x, top: popover.y, zIndex: 50, transform: "translateX(-50%)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {popover.mode === "toolbar" && (
            <div className="cert-sel-toolbar">
              <button type="button" className="cert-sel-btn" onMouseDown={(e) => { e.preventDefault(); openPanel("link"); }} title="Link to a field">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>Link</span>
              </button>
              <span className="cert-sel-sep" />
              <button type="button" className="cert-sel-btn" onMouseDown={(e) => { e.preventDefault(); openPanel("style"); }} title="Customize style">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Style</span>
              </button>
            </div>
          )}

          {popover.mode === "link" && (
            <div className="cert-sel-link-panel">
              <div className="cert-sel-panel-head">
                <span className="cert-sel-panel-title">Link to field</span>
                <button type="button" className="cert-sel-panel-back" onMouseDown={(e) => { e.preventDefault(); closePopover(); }}>Close</button>
              </div>
              <input
                className="cert-sel-search"
                placeholder="Search fields..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                autoFocus
              />
              <div className="cert-sel-field-list">
                {filteredFields.map((f) => (
                  <button key={f.key} type="button" className="cert-sel-field-item" onMouseDown={(e) => { e.preventDefault(); insertField(f.key); }}>
                    <span className="cert-sel-field-label">{f.label}</span>
                    <code className="cert-sel-field-key">{f.key}</code>
                  </button>
                ))}
                {filteredFields.length === 0 && <p className="cert-sel-empty">No matching fields</p>}
              </div>
              <button type="button" className="cert-sel-style-clear" onMouseDown={(e) => { e.preventDefault(); removeFieldLink(); }}>Remove link</button>
            </div>
          )}

          {popover.mode === "style" && (
            <div className="cert-sel-style-panel">
              <div className="cert-sel-panel-head">
                <span className="cert-sel-panel-title">Customize selection</span>
                <button type="button" className="cert-sel-panel-back" onMouseDown={(e) => { e.preventDefault(); setPopover((p) => p ? { ...p, mode: "toolbar" } : null); }}>Back</button>
              </div>
              <div className="cert-sel-style-body">
                <div className="cert-sel-style-row">
                  <label className="cert-sel-style-label">Font</label>
                  <select
                    className="cert-sel-style-select"
                    value={customStyle.fontFamily || ""}
                    onChange={(e) => setCustomStyle((s) => ({ ...s, fontFamily: e.target.value || undefined }))}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <option value="">Inherit</option>
                    {CERT_FONTS.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
                  </select>
                </div>
                <div className="cert-sel-style-row">
                  <label className="cert-sel-style-label">Size</label>
                  <input
                    className="cert-sel-style-input"
                    type="number"
                    min={1}
                    max={500}
                    placeholder="—"
                    value={customStyle.fontSize || ""}
                    onChange={(e) => setCustomStyle((s) => ({ ...s, fontSize: e.target.value ? +e.target.value : undefined }))}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <span className="cert-sel-style-unit">px</span>
                </div>
                <div className="cert-sel-style-row">
                  <label className="cert-sel-style-label">Weight</label>
                  <select
                    className="cert-sel-style-select"
                    value={customStyle.fontWeight || ""}
                    onChange={(e) => setCustomStyle((s) => ({ ...s, fontWeight: e.target.value ? +e.target.value : undefined }))}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <option value="">Inherit</option>
                    {WEIGHT_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
                <div className="cert-sel-style-row">
                  <label className="cert-sel-style-label">Color</label>
                  <div className="cert-sel-style-color-wrap">
                    <input
                      type="color"
                      className="cert-sel-style-color"
                      value={customStyle.color || style.color || "#000000"}
                      onChange={(e) => setCustomStyle((s) => ({ ...s, color: e.target.value }))}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <span className="cert-sel-style-color-preview" style={{ backgroundColor: customStyle.color || style.color || "#000000" }} />
                  </div>
                </div>
                <div className="cert-sel-style-row cert-sel-style-row--toggles">
                  <button
                    type="button"
                    className={"cert-sel-style-toggle" + (customStyle.fontStyle === "italic" ? " active" : "")}
                    onMouseDown={(e) => { e.preventDefault(); setCustomStyle((s) => ({ ...s, fontStyle: s.fontStyle === "italic" ? undefined : "italic" })); }}
                  ><i>I</i></button>
                  <button
                    type="button"
                    className={"cert-sel-style-toggle" + (customStyle.textDecoration === "underline" ? " active" : "")}
                    onMouseDown={(e) => { e.preventDefault(); setCustomStyle((s) => ({ ...s, textDecoration: s.textDecoration === "underline" ? undefined : "underline" })); }}
                  ><u>U</u></button>
                  <button
                    type="button"
                    className={"cert-sel-style-toggle" + (customStyle.textDecoration === "line-through" ? " active" : "")}
                    onMouseDown={(e) => { e.preventDefault(); setCustomStyle((s) => ({ ...s, textDecoration: s.textDecoration === "line-through" ? undefined : "line-through" })); }}
                  ><s>S</s></button>
                </div>
              </div>
              <div className="cert-sel-style-actions">
                <button
                  type="button"
                  className="cert-sel-style-apply"
                  disabled={Object.keys(customStyle).length === 0}
                  onMouseDown={(e) => { e.preventDefault(); applyStyleToSelection(customStyle); }}
                >Apply</button>
                <button
                  type="button"
                  className="cert-sel-style-clear"
                  onMouseDown={(e) => { e.preventDefault(); clearStyleFromSelection(); }}
                >Clear style</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
