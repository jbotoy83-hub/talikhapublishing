import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { CertificatePage, CertificateBlock, CertificateField, WorkspaceMode } from "./types";
import { resolveText, measureTextFit, contentToSegments, segmentsToBuilderText } from "./field-engine";
import { InlineTextEditor } from "./inline-text-editor";

interface CanvasProps {
  page: CertificatePage;
  blocks: CertificateBlock[];
  selectedBlockId: string | null;
  editingBlockId: string | null;
  zoom: number;
  mode: WorkspaceMode;
  fieldValues: Record<string, string>;
  fieldUrls?: Record<string, string>;
  showMargins: boolean;
  fields: CertificateField[];
  onSelectBlock: (id: string | null) => void;
  onStartEdit: (id: string) => void;
  onEditCommit: (id: string, segs: import("./types").TextSegment[]) => void;
  onUpdateBlock: (id: string, updates: Partial<CertificateBlock>, transient?: boolean) => void;
  onTransformStart?: () => void;
  onOpenImageCrop?: (id: string) => void;
  onZoomChange: (z: number) => void;
  onBackgroundError?: () => void;
  pdfDataUrl?: string | null;
}

// Large enough to grab confidently with a mouse or touch, while still keeping
// the selected object readable underneath.
const HANDLE_SIZE = 22;
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type HandleDir = (typeof HANDLES)[number];

function runCSS(s: Partial<import("./types").BlockStyle>): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (s.fontFamily) css.fontFamily = s.fontFamily;
  if (s.fontSize) css.fontSize = s.fontSize;
  if (s.fontWeight) css.fontWeight = s.fontWeight;
  if (s.fontStyle && s.fontStyle !== "normal") css.fontStyle = s.fontStyle;
  if (s.color) css.color = s.color;
  if (s.textDecoration && s.textDecoration !== "none") css.textDecoration = s.textDecoration;
  if (s.letterSpacing) css.letterSpacing = s.letterSpacing;
  if (s.lineHeight) css.lineHeight = s.lineHeight;
  return css;
}

export const CertificateCanvas = React.memo(function CertificateCanvas({
  page, blocks, selectedBlockId, editingBlockId, zoom, mode, fieldValues, fieldUrls, showMargins, fields,
  onSelectBlock, onStartEdit, onEditCommit, onUpdateBlock, onTransformStart, onOpenImageCrop, onZoomChange, onBackgroundError, pdfDataUrl,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ blockId: string; startX: number; startY: number; origX: number; origY: number; wasSelected: boolean } | null>(null);
  const [resize, setResize] = useState<{ blockId: string; handle: HandleDir; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; aspectRatio: number } | null>(null);
  const [fitZoom, setFitZoom] = useState(1);
  const dragMovedRef = useRef(false);
  // Pointer devices can produce 120–240 move events per second. Committing each
  // one made the whole workspace (inspector, validation, layers) re-render and
  // was also happening twice because block events bubbled to the canvas. Keep
  // the editor in step with the screen refresh instead.
  const pendingUpdateRef = useRef<{ id: string; updates: Partial<CertificateBlock> } | null>(null);
  const updateFrameRef = useRef<number | null>(null);

  const flushPendingUpdate = useCallback(() => {
    if (updateFrameRef.current !== null) {
      cancelAnimationFrame(updateFrameRef.current);
      updateFrameRef.current = null;
    }
    const pending = pendingUpdateRef.current;
    pendingUpdateRef.current = null;
    if (pending) onUpdateBlock(pending.id, pending.updates, true);
  }, [onUpdateBlock]);

  const queueBlockUpdate = useCallback((id: string, updates: Partial<CertificateBlock>) => {
    pendingUpdateRef.current = { id, updates };
    if (updateFrameRef.current !== null) return;
    updateFrameRef.current = requestAnimationFrame(() => {
      updateFrameRef.current = null;
      const pending = pendingUpdateRef.current;
      pendingUpdateRef.current = null;
      if (pending) onUpdateBlock(pending.id, pending.updates, true);
    });
  }, [onUpdateBlock]);

  useEffect(() => () => {
    if (updateFrameRef.current !== null) cancelAnimationFrame(updateFrameRef.current);
  }, []);

  const pageBlocks = useMemo(() => blocks.filter((b) => b.pageId === page.id && !b.hidden), [blocks, page.id]);
  const sortedBlocks = useMemo(() => pageBlocks.slice().sort((a, b) => a.zIndex - b.zIndex), [pageBlocks]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const pad = 60;
      const zx = (rect.width - pad * 2) / page.width;
      const zy = (rect.height - pad * 2) / page.height;
      setFitZoom(Math.max(0.1, Math.min(zx, zy, 1.5)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [page.width, page.height]);

  const effectiveZoom = zoom === 0 ? fitZoom : zoom;

  const onPointerDownBlock = useCallback((e: React.PointerEvent, block: CertificateBlock) => {
    if (block.locked) return;
    if (editingBlockId === block.id) return;
    e.stopPropagation();
    e.preventDefault();
    const wasSelected = block.id === selectedBlockId;
    onSelectBlock(block.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragMovedRef.current = false;
    setDrag({ blockId: block.id, startX: e.clientX, startY: e.clientY, origX: block.x, origY: block.y, wasSelected });
  }, [mode, onSelectBlock, editingBlockId, selectedBlockId]);

  const onDoubleClickBlock = useCallback((e: React.MouseEvent, block: CertificateBlock) => {
    if (mode !== "builder") return;
    if (block.locked) return;
    if (block.type === "image") {
      if (!onOpenImageCrop) return;
      e.stopPropagation();
      onSelectBlock(block.id);
      onOpenImageCrop(block.id);
      return;
    }
    if (block.type !== "text") return;
    e.stopPropagation();
    onSelectBlock(block.id);
    onStartEdit(block.id);
  }, [mode, onSelectBlock, onStartEdit, onOpenImageCrop]);

  const onPointerDownResize = useCallback((e: React.PointerEvent, block: CertificateBlock, handle: HandleDir) => {
    if (block.locked) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const aspectRatio = block.width / block.height;
    setResize({ blockId: block.id, handle, startX: e.clientX, startY: e.clientY, origX: block.x, origY: block.y, origW: block.width, origH: block.height, aspectRatio });
    if (onTransformStart) onTransformStart();
  }, [mode, onTransformStart]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const scale = effectiveZoom;
    if (drag) {
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 3) {
        if (!dragMovedRef.current && onTransformStart) onTransformStart();
        dragMovedRef.current = true;
      }
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      let nx = drag.origX + dx;
      let ny = drag.origY + dy;
      if (e.shiftKey) { nx = Math.round(nx / 10) * 10; ny = Math.round(ny / 10) * 10; }
      queueBlockUpdate(drag.blockId, { x: Math.max(0, nx), y: Math.max(0, ny) });
    }
    if (resize) {
      const dx = (e.clientX - resize.startX) / scale;
      const dy = (e.clientY - resize.startY) / scale;
      let { origX: x, origY: y, origW: w, origH: h } = resize;
      const minS = 20;
      const block = blocks.find((b) => b.id === resize.blockId);
      const isImage = block?.type === "image";
      const constrain = e.shiftKey || block?.imageShape === "circle";

      if (constrain && isImage) {
        const ar = resize.aspectRatio;
        if (resize.handle === "se") { w = Math.max(minS, w + dx); h = w / ar; }
        else if (resize.handle === "sw") { w = Math.max(minS, w - dx); x = x + dx; h = w / ar; }
        else if (resize.handle === "ne") { w = Math.max(minS, w + dx); h = w / ar; y = resize.origY + resize.origH - h; }
        else if (resize.handle === "nw") { w = Math.max(minS, w - dx); x = x + dx; h = w / ar; y = resize.origY + resize.origH - h; }
        else if (resize.handle === "e" || resize.handle === "w") {
          if (resize.handle === "w") { w = Math.max(minS, w - dx); x = x + dx; } else { w = Math.max(minS, w + dx); }
          h = w / ar; y = resize.origY + (resize.origH - h) / 2;
        } else {
          if (resize.handle === "n") { h = Math.max(minS, h - dy); y = y + dy; } else { h = Math.max(minS, h + dy); }
          w = h * ar; x = resize.origX + (resize.origW - w) / 2;
        }
      } else {
        if (resize.handle.includes("e")) w = Math.max(minS, w + dx);
        if (resize.handle.includes("w")) { w = Math.max(minS, w - dx); x = x + dx; }
        if (resize.handle.includes("s")) h = Math.max(minS, h + dy);
        if (resize.handle.includes("n")) { h = Math.max(minS, h - dy); y = y + dy; }
        if (e.shiftKey && !isImage) { x = Math.round(x / 10) * 10; y = Math.round(y / 10) * 10; w = Math.round(w / 10) * 10; h = Math.round(h / 10) * 10; }
      }
      queueBlockUpdate(resize.blockId, { x: Math.max(0, x), y: Math.max(0, y), width: w, height: h });
    }
  }, [drag, resize, effectiveZoom, queueBlockUpdate, blocks, onTransformStart]);

  const onPointerUp = useCallback(() => {
    const d = drag;
    flushPendingUpdate();
    if (d && !dragMovedRef.current && d.wasSelected && mode === "builder") {
      const block = blocks.find((b) => b.id === d.blockId);
      if (block && block.type === "text" && !block.locked) onStartEdit(d.blockId);
    }
    dragMovedRef.current = false;
    setDrag(null);
    setResize(null);
  }, [flushPendingUpdate, drag, blocks, onStartEdit, mode]);

  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t === e.currentTarget || t.dataset.canvasBg || t.classList.contains("cert-canvas-scroll")) {
      onSelectBlock(null);
    }
  }, [onSelectBlock]);

  const labelOf = useCallback((k: string) => fields.find((f) => f.key === k)?.label || k, [fields]);

  const renderBlock = (block: CertificateBlock) => {
    const isSelected = block.id === selectedBlockId;
    const isEditing = block.id === editingBlockId;
    const isLinked = !!block.linkedFieldKey;
    const segs = block.segments && block.segments.length ? block.segments : contentToSegments(block.content);
    const resolved = block.type === "text" ? resolveText(block.content, fieldValues, block) : "";
    const builderText = block.type === "text" ? segmentsToBuilderText(segs, labelOf) : "";
    const builderPreview = block.type === "text" ? segs.map((s) => (s.t === "f" ? (fieldValues[s.k] || labelOf(s.k)) : s.v)).join("") : "";

    let displayFontSize = block.style.fontSize;
    let overflowWarn = false;
    if (block.type === "text") {
      const measureStr = mode === "generator" ? resolved : builderPreview;
      if (block.overflowBehavior === "auto_fit" && measureStr) {
        const fit = measureTextFit(
          measureStr, block.width - block.style.padding * 2, block.height - block.style.padding * 2,
          block.style.fontSize, block.style.lineHeight, block.style.fontFamily,
          block.style.fontWeight, block.style.fontStyle, block.style.letterSpacing, block.minFontSize || 8,
        );
        displayFontSize = fit.fittedSize;
        overflowWarn = fit.overflows;
      } else if (measureStr) {
        const fit = measureTextFit(
          measureStr, block.width - block.style.padding * 2, block.height - block.style.padding * 2,
          block.style.fontSize, block.style.lineHeight, block.style.fontFamily,
          block.style.fontWeight, block.style.fontStyle, block.style.letterSpacing, 1,
        );
        overflowWarn = fit.overflows;
      }
    }

    const hasBorder = (block.style.borderWidth || 0) > 0 && block.style.borderStyle && block.style.borderStyle !== "none";

    const blockStyle: React.CSSProperties = {
      position: "absolute",
      left: block.x,
      top: block.y,
      width: block.width,
      height: block.height,
      transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
      zIndex: block.zIndex,
      cursor: isEditing ? "text" : !block.locked ? "move" : "default",
      opacity: block.style.opacity,
      outline: isSelected && !isEditing ? "2px solid #2563eb" : overflowWarn && mode === "builder" ? "2px dashed #dc2626" : isLinked && mode === "builder" && !isSelected ? "1.5px solid #16a34a" : "none",
      outlineOffset: 1,
      borderRadius: block.style.borderRadius,
      backgroundColor: block.style.backgroundColor === "transparent" ? undefined : block.style.backgroundColor,
      transition: drag?.blockId === block.id || resize?.blockId === block.id ? "none" : "outline-color .15s",
      border: hasBorder ? `${block.style.borderWidth}px ${block.style.borderStyle} ${block.style.borderColor || "#000"}` : undefined,
      overflow: "hidden",
    };

    const textStyle: React.CSSProperties = block.type === "text" ? {
      fontFamily: block.style.fontFamily,
      fontSize: displayFontSize,
      fontWeight: block.style.fontWeight,
      fontStyle: block.style.fontStyle,
      color: block.style.color,
      textAlign: block.style.textAlign,
      lineHeight: block.style.lineHeight,
      letterSpacing: block.style.letterSpacing,
      textDecoration: block.style.textDecoration === "none" ? undefined : block.style.textDecoration,
      textTransform: block.style.textTransform === "none" ? undefined : block.style.textTransform,
      textJustify: block.style.textAlign === "justify" ? "inter-word" : undefined,
      padding: block.style.padding,
      overflow: "hidden",
      display: "block",
      minWidth: 0,
      overflowWrap: "break-word",
      wordBreak: "normal",
      whiteSpace: "pre-wrap",
      hyphens: "none",
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      margin: 0,
    } : {};

    const imgStyle: React.CSSProperties = block.type === "image" ? {
      width: "100%",
      height: "100%",
      objectFit: block.style.objectFit || "contain",
      pointerEvents: "none",
      display: "block",
      transform: `translate(${block.style.cropX || 0}%, ${block.style.cropY || 0}%) scale(${block.style.cropZoom || 1})`,
      transformOrigin: "center",
      borderRadius: block.style.borderRadius ? Math.max(0, block.style.borderRadius - (block.style.borderWidth || 0)) : 0,
    } : {};

    return (
      <div
        key={block.id}
        data-block-id={block.id}
        style={blockStyle}
        onPointerDown={(e) => onPointerDownBlock(e, block)}
        onDoubleClick={(e) => onDoubleClickBlock(e, block)}
        className={`cert-block${isEditing ? " is-editing" : ""}`}
      >
        {block.type === "text" && isEditing && (
          <InlineTextEditor
            segments={segs}
            fields={fields}
            fieldValues={fieldValues}
            style={{ ...block.style, fontSize: displayFontSize }}
            zoom={effectiveZoom}
            onCommit={(s) => onEditCommit(block.id, s)}
          />
        )}
        {block.type === "text" && !isEditing && mode === "builder" && (
          <div style={textStyle} className="cert-text-display">
            {segs.map((s, i) => s.t === "s"
              ? (s.style && Object.keys(s.style).length > 0
                ? <span key={i} style={runCSS(s.style)}>{s.v}</span>
                : <React.Fragment key={i}>{s.v}</React.Fragment>)
              : <span key={i} className={`cert-chip cert-chip--static${fieldValues[s.k] ? "" : " cert-chip--empty"}`} style={runCSS(s.style || {})} contentEditable={false}>{fieldValues[s.k] || labelOf(s.k)}</span>)}
            {builderText === "" && <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Double-click to edit text</span>}
          </div>
        )}
        {block.type === "text" && !isEditing && mode === "generator" && (
          <div style={textStyle}>
            {segs.length > 0 ? segs.map((segment, i) => segment.t === "f"
              ? <span key={i} style={runCSS(segment.style?.fontWeight ? segment.style : (block.style.linkedFieldBold ? { fontWeight: 700 } : {}))}>{fieldValues[segment.k] || ""}</span>
              : (segment.style && Object.keys(segment.style).length > 0
                ? <span key={i} style={runCSS(segment.style)}>{segment.v}</span>
                : <React.Fragment key={i}>{segment.v}</React.Fragment>)
            ) : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>{isLinked ? "{{" + (block.linkedFieldKey || "") + "}}" : ""}</span>}
          </div>
        )}
        {block.type === "text" && !isEditing && overflowWarn && mode === "builder" && (
          <div className="cert-overflow-fade" aria-hidden="true" />
        )}
        {block.type === "image" && (() => {
          const src = block.linkedFieldKey ? (fieldUrls?.[block.linkedFieldKey] || block.assetUrl) : block.assetUrl;
          if (src) return <img src={src} alt={block.name} style={imgStyle} draggable={false} />;
          const fieldLabel = block.linkedFieldKey ? fields.find((f) => f.key === block.linkedFieldKey)?.label : undefined;
          return (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#f3f4f6", border: "1px dashed #9ca3af", borderRadius: 4, fontSize: 10, color: "#6b7280", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 20 }}>🖼</span>
              <span>{fieldLabel ? `No image — ${fieldLabel}` : "No image"}</span>
            </div>
          );
        })()}
        {block.type === "qr" && (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#f3f4f6", border: "1px dashed #9ca3af", borderRadius: 4, fontSize: 10, color: "#6b7280" }}>QR</div>
        )}

        {isLinked && mode === "builder" && !isEditing && (
          <span className="cert-field-badge" title={`Linked: ${block.linkedFieldKey}`}>{block.linkedFieldKey}</span>
        )}

        {overflowWarn && mode === "builder" && !isEditing && block.overflowBehavior === "auto_fit" && (
          <span className="cert-overflow-badge" title="Text overflows — font was reduced or text is too long">⚠</span>
        )}

        {isSelected && !block.locked && !isEditing && HANDLES.map((h) => {
          const hs: React.CSSProperties = { position: "absolute", width: HANDLE_SIZE, height: HANDLE_SIZE, background: "#fff", border: "3px solid #2563eb", borderRadius: 5, zIndex: 10, boxShadow: "0 1px 4px rgba(37,99,235,.28)" };
          if (h.includes("n")) hs.top = -HANDLE_SIZE / 2;
          if (h.includes("s")) hs.bottom = -HANDLE_SIZE / 2;
          if (h.includes("w")) hs.left = -HANDLE_SIZE / 2;
          if (h.includes("e")) hs.right = -HANDLE_SIZE / 2;
          if (h === "n" || h === "s") { hs.left = "50%"; hs.transform = "translateX(-50%)"; }
          if (h === "w" || h === "e") { hs.top = "50%"; hs.transform = "translateY(-50%)"; }
          const cursors: Record<HandleDir, string> = { nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize", se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize" };
          hs.cursor = cursors[h];
          return <div key={h} style={hs} onPointerDown={(e) => onPointerDownResize(e, block, h)} />;
        })}
      </div>
    );
  };

  return (
    <div className="cert-canvas-outer" ref={containerRef}>
      <div className="cert-canvas-toolbar">
        <button onClick={() => onZoomChange(Math.max(0.1, effectiveZoom - 0.1))} title="Zoom out">−</button>
        <span className="cert-zoom-label">{Math.round(effectiveZoom * 100)}%</span>
        <button onClick={() => onZoomChange(Math.min(3, effectiveZoom + 0.1))} title="Zoom in">+</button>
        <button onClick={() => onZoomChange(0)} title="Fit to screen" className={zoom === 0 ? "active" : ""}>Fit</button>
        <button onClick={() => onZoomChange(1)} title="100%" className={zoom === 1 ? "active" : ""}>1:1</button>
      </div>

      <div className={`cert-canvas-scroll ${zoom === 0 ? "is-fit" : ""}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={onCanvasClick}>
        <div
          className="cert-canvas-page"
          style={{ width: page.width, height: page.height, transform: `scale(${effectiveZoom})`, transformOrigin: "top center" }}
          onClick={onCanvasClick}
        >
          {pdfDataUrl ? (
            <img src={pdfDataUrl} alt="" data-canvas-bg="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none" }} />
          ) : page.backgroundImageUrl ? (
            <img src={page.backgroundImageUrl} alt="" data-canvas-bg="true" onError={onBackgroundError} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none" }} />
          ) : (
            <div data-canvas-bg="true" style={{ position: "absolute", inset: 0, background: "#fff" }} />
          )}

          {showMargins && mode === "builder" && (
            <div style={{ position: "absolute", inset: page.safeMargin, border: "1px dashed rgba(37,99,235,.3)", pointerEvents: "none", zIndex: 0 }} />
          )}

          {sortedBlocks.map(renderBlock)}
        </div>
      </div>
    </div>
  );
});
