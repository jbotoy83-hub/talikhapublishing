"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./icon";

const PDFViewer = dynamic(
  () => import("@/components/ui/pdf-viewer").then((m) => ({ default: m.PDFViewer })),
  { ssr: false, loading: () => <div className="fpreview-loading">Loading PDF preview…</div> }
);

const DocxViewer = dynamic(
  () => import("@/components/ui/docx-viewer").then((m) => ({ default: m.DocxViewer })),
  { ssr: false, loading: () => <div className="fpreview-loading">Loading document preview…</div> }
);
import {
  type StoredFile,
  type FilePurpose,
  type FileStatus,
  saveBlob,
  getBlob,
  deleteFile,
  saveMeta,
  sanitizeFilename,
  validateFile,
  getFileTypeLabel,
  formatBytes,
  formatProgress,
  isDocx,
  isPdf,
  isImage,
  PURPOSE_LABELS,
  PURPOSE_MAX_SIZE,
  PURPOSE_ACCEPT
} from "@/lib/file-storage";

function generateId(): string {
  return crypto.randomUUID();
}

type Tone = "ok" | "err" | "active" | "idle";

function tone(status: FileStatus): Tone {
  if (status === "completed") return "ok";
  if (status === "error") return "err";
  if (status === "uploading" || status === "processing" || status === "validating") return "active";
  return "idle";
}

function statusLabel(status: FileStatus, progress: number): string {
  switch (status) {
    case "queued": return "Queued";
    case "uploading": return `Uploading ${Math.round(progress)}%`;
    case "processing": return "Processing";
    case "validating": return "Validating";
    case "completed": return "Completed";
    case "error": return "Error";
    case "cancelled": return "Cancelled";
  }
}

function fileExt(file: StoredFile): string {
  const idx = file.name.lastIndexOf(".");
  return idx >= 0 ? file.name.slice(idx + 1).toUpperCase().slice(0, 4) : "?";
}

function glyphColor(file: StoredFile): { line: string; fill: string } {
  if (isDocx(file)) return { line: "#2f6fed", fill: "#e9f0ff" };
  if (isPdf(file)) return { line: "#e0473a", fill: "#fdeceb" };
  if (isImage(file)) return { line: "#2f8f5b", fill: "#e7f4ec" };
  return { line: "#7b8794", fill: "#eef1f3" };
}

function FileGlyph({ file, size = 36 }: { file: StoredFile; size?: number }) {
  const c = glyphColor(file);
  const ext = fileExt(file);
  const fs = ext.length > 3 ? 4.1 : 4.9;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path d="M6 2.5h7.5L18 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" fill={c.fill} stroke={c.line} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M13.5 2.5V7H18" fill="none" stroke={c.line} strokeWidth="1.4" strokeLinejoin="round" />
      <text x="10.6" y="16.6" textAnchor="middle" fontSize={fs} fontWeight="700" fill={c.line} fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.2">{ext}</text>
    </svg>
  );
}

function StatusMark({ t, size = 18 }: { t: Tone; size?: number }) {
  if (t === "ok") return <span className="fuz-mark ok" style={{ width: size, height: size }}><svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></span>;
  if (t === "err") return <span className="fuz-mark err" style={{ width: size, height: size }}><svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span>;
  if (t === "active") return <span className="fuz-mark active" style={{ width: size, height: size }}><span className="fuz-spin-sm" /></span>;
  return <span className="fuz-mark idle" style={{ width: size, height: size }} />;
}

function formatPills(purpose: FilePurpose): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of PURPOSE_ACCEPT[purpose].split(",")) {
    const s = raw.trim();
    if (!s.startsWith(".")) continue;
    const e = s.slice(1).toUpperCase();
    if (!seen.has(e)) { seen.add(e); out.push(e); }
  }
  return out;
}

function pillTone(ext: string): string {
  if (ext === "PDF") return "pdf";
  if (ext === "DOCX" || ext === "DOC") return "docx";
  return "def";
}

async function simulateUpload(
  file: StoredFile,
  onProgress: (p: number, bytes: number) => void,
  onStatus: (s: FileStatus) => void,
  signal: AbortSignal
): Promise<void> {
  const chunkTime = 60 + Math.random() * 100;
  const totalChunks = 15 + Math.floor(Math.random() * 25);
  const bytesPerChunk = file.size / totalChunks;

  onStatus("uploading");
  for (let i = 1; i <= totalChunks; i++) {
    if (signal.aborted) throw new Error("cancelled");
    await new Promise((r) => setTimeout(r, chunkTime));
    const uploaded = Math.min(bytesPerChunk * i, file.size);
    onProgress((uploaded / file.size) * 100, uploaded);
  }
  onStatus("processing");
  await new Promise((r) => setTimeout(r, 350 + Math.random() * 250));
  if (signal.aborted) throw new Error("cancelled");
  onStatus("validating");
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 350));
  if (signal.aborted) throw new Error("cancelled");
  onStatus("completed");
  onProgress(100, file.size);
}

/* ── File row (right list): pencil + red trash + status check; click row to preview ── */

type FileRowProps = {
  file: StoredFile;
  onRemove: () => void;
  onPreview: () => void;
  onRetry: () => void;
  onRename: (name: string) => void;
};

function FileRow({ file, onRemove, onPreview, onRetry, onRename }: FileRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(file.name);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) nameRef.current?.focus(); }, [renaming]);

  const commit = () => {
    const t = nameVal.trim();
    if (t && t !== file.name) onRename(t);
    else setNameVal(file.name);
    setRenaming(false);
  };

  const t = tone(file.status);
  const canPreview = t === "ok" && (isDocx(file) || isPdf(file) || isImage(file));
  const c = glyphColor(file);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -14, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
    >
      <div
        className={`fuz-row ${canPreview ? "can-preview" : ""} ${t === "err" ? "err" : ""}`}
        title={`${file.name} · ${getFileTypeLabel(file.mimeType, file.name)} · ${formatBytes(file.size)} · ${statusLabel(file.status, file.progress)}${canPreview ? " — click to preview" : ""}`}
        onClick={canPreview ? onPreview : undefined}
        role={canPreview ? "button" : undefined}
        tabIndex={canPreview ? 0 : undefined}
        onKeyDown={canPreview ? (e) => { if (e.key === "Enter") onPreview(); } : undefined}
      >
        <span className="fuz-row-icon"><FileGlyph file={file} size={34} /></span>

        <div className="fuz-row-body">
          {renaming ? (
            <input
              ref={nameRef}
              className="fuz-row-name-input"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={commit}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setNameVal(file.name); setRenaming(false); } }}
            />
          ) : (
            <button type="button" className="fuz-row-name" onClick={(e) => { e.stopPropagation(); setNameVal(file.name); setRenaming(true); }} title="Rename file">
              <span className="fuz-row-name-text">{file.name}</span>
              {file.sanitized && <span className="fuz-row-sanitized">sanitized</span>}
            </button>
          )}
          <div className="fuz-row-meta">
            <span>{getFileTypeLabel(file.mimeType, file.name)}</span>
            <span className="dot" />
            <span>{formatBytes(file.size)}</span>
          </div>
          {t === "active" && (
            <>
              <div className="fuz-row-bar"><div className="fuz-row-bar-fill" style={{ width: `${file.progress}%`, background: c.line }} /></div>
              <span className="fuz-row-statusline">{statusLabel(file.status, file.progress)} · {formatProgress(file.uploadedBytes, file.size)}</span>
            </>
          )}
          {t === "err" && <p className="fuz-row-err-msg">{file.error}</p>}
          {t === "err" && <button type="button" className="fuz-row-retry" onClick={(e) => { e.stopPropagation(); onRetry(); }}>Retry upload</button>}
        </div>

        <div className="fuz-row-ctrls">
          <button type="button" className="fuz-row-pencil" onClick={(e) => { e.stopPropagation(); setNameVal(file.name); setRenaming(true); }} aria-label="Rename file" title="Rename">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
          </button>
          <button type="button" className="fuz-row-del" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label={t === "active" ? "Cancel upload" : "Remove file"} title={t === "active" ? "Cancel upload" : "Remove file"}>
            {t === "active" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" /><path d="M10 11v6M14 11v6" /></svg>
            )}
          </button>
          <StatusMark t={t} size={22} />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Preview Modal (docx via docx-preview keeps the paper's own spacing) ── */

type PreviewModalProps = { file: StoredFile; onClose: () => void };

export function PreviewModal({ file, onClose }: PreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const blob = await getBlob(file.id);
      if (!blob || cancelled) return;
      if (isDocx(file)) {
        const buf = await blob.arrayBuffer();
        if (cancelled) return;
        setDocxBuffer(buf);
      } else {
        url = URL.createObjectURL(blob);
        if (cancelled) return;
        setBlobUrl(url);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [file]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen();
  };

  const pdfFile = isPdf(file);
  const docxFile = isDocx(file);
  const imageFile = isImage(file);
  const documentFile = pdfFile || docxFile;

  return (
    <div className="fpreview-overlay" onClick={onClose}>
      <div className="fpreview-modal" onClick={(e) => e.stopPropagation()} ref={containerRef}>
        <div className="fpreview-toolbar">
          <span className="fpreview-title">{file.name}</span>
          <div className="fpreview-controls">
            {imageFile && (
              <>
                <button type="button" onClick={() => setZoom((z) => Math.max(25, z - 25))} title="Zoom out">−</button>
                <span className="fpreview-zoom">{zoom}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(300, z + 25))} title="Zoom in">+</button>
                <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate">↻</button>
              </>
            )}
            <button type="button" onClick={toggleFullscreen} title="Fullscreen">⛶</button>
            {imageFile && blobUrl && <a href={blobUrl} download={file.name} className="fpreview-dl" title="Download">↓</a>}
          </div>
          <button type="button" className="fpreview-close" onClick={onClose}>✕</button>
        </div>
        <div className={`fpreview-body${documentFile ? " fpreview-body--flush" : ""}`} style={imageFile ? { zoom: `${zoom}%` } : undefined}>
          {loading && <div className="fpreview-loading">Loading preview…</div>}
          {!loading && pdfFile && blobUrl && (
            <div className="fpreview-pdf-wrap">
              <PDFViewer src={blobUrl} fileName={file.name} showDownload showUpload={false} className="h-full w-full" />
            </div>
          )}
          {!loading && docxFile && docxBuffer && (
            <DocxViewer buffer={docxBuffer} fileName={file.name} showDownload className="h-full w-full" />
          )}
          {!loading && imageFile && blobUrl && <img src={blobUrl} alt={file.name} className="fpreview-img" style={{ transform: `rotate(${rotation}deg)` }} />}
          {!loading && !documentFile && !imageFile && <div className="fpreview-loading">Preview not available for this file type.</div>}
        </div>
      </div>
    </div>
  );
}

/* ── File Checklist (review step) ── */

type FileChecklistProps = {
  files: StoredFile[];
  onPreview: (file: StoredFile) => void;
  onEdit: (id: string) => void;
};

export function FileChecklist({ files, onPreview, onEdit }: FileChecklistProps) {
  const active = files.filter((f) => f.status !== "cancelled");
  const requiredPurposes: FilePurpose[] = ["manuscript", "payment-proof"];
  const missing = requiredPurposes.filter((p) => !active.some((f) => f.purpose === p && f.status === "completed"));

  return (
    <div className="fchecklist">
      <h3 className="fchecklist-heading">File checklist</h3>
      {active.map((file) => {
        const canP = file.status === "completed" && (isDocx(file) || isPdf(file) || isImage(file));
        return (
        <div
          key={file.id}
          className={`fchecklist-item ${file.status === "completed" ? "fchecklist-ok" : file.status === "error" ? "fchecklist-err" : "fchecklist-pending"} ${canP ? "can-preview" : ""}`}
          onClick={canP ? () => onPreview(file) : undefined}
          role={canP ? "button" : undefined}
          tabIndex={canP ? 0 : undefined}
          title={canP ? `${file.name} — click to preview` : undefined}
          onKeyDown={canP ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPreview(file); } } : undefined}
        >
          <span className="fchecklist-avatar"><FileGlyph file={file} size={28} /></span>
          <div className="fchecklist-info">
            <strong>{file.name}</strong>
            <span>{PURPOSE_LABELS[file.purpose]} · {getFileTypeLabel(file.mimeType, file.name)} · {formatBytes(file.size)}</span>
          </div>
          <span className={`fchecklist-badge ${tone(file.status) === "ok" ? "file-status-ok" : tone(file.status) === "err" ? "file-status-err" : "file-status-active"}`}>{statusLabel(file.status, file.progress)}</span>
          <div className="fchecklist-actions">
            {canP && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onPreview(file); }} title="Preview"><Icon name="eye" className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </div>
        );
      })}
      {missing.map((p) => (
        <div key={p} className="fchecklist-item fchecklist-missing">
          <span className="fchecklist-avatar fchecklist-missing-mark">!</span>
          <div className="fchecklist-info">
            <strong>{PURPOSE_LABELS[p]}</strong>
            <span>Required — not yet uploaded</span>
          </div>
          <span className="fchecklist-badge file-status-err">Missing</span>
          <div className="fchecklist-actions">
            <button type="button" onClick={() => onEdit("")} className="fchecklist-edit-btn">Upload</button>
          </div>
        </div>
      ))}
      {active.length === 0 && missing.length === 0 && <p className="fchecklist-empty">No files uploaded yet.</p>}
    </div>
  );
}

/* ── Main Upload System ── */

type FileUploadSystemProps = {
  files: StoredFile[];
  onFilesChange: React.Dispatch<React.SetStateAction<StoredFile[]>>;
  uploader: string;
  locked: boolean;
  showZones: boolean;
  visiblePurposes?: FilePurpose[];
  onContinue?: () => void;
  onBack?: () => void;
  confirmLabel?: string;
};

export function FileUploadSystem({ files, onFilesChange, uploader, locked, showZones, visiblePurposes, onContinue, onBack, confirmLabel = "I have previewed the required files and confirmed that they are correct." }: FileUploadSystemProps) {
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [draggingPurpose, setDraggingPurpose] = useState<FilePurpose | null>(null);
  const [shaking, setShaking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const purposes: FilePurpose[] = visiblePurposes || ["manuscript", "supporting", "cover-image", "payment-proof"];
  const primaryPurpose = purposes[0];
  const primaryFiles = files.filter((f) => f.purpose === primaryPurpose && f.status !== "cancelled");
  const requiredCount = primaryFiles.length;
  const reviewedCount = primaryFiles.filter((f) => f.status === "completed").length;
  const uploading = primaryFiles.some((f) => f.status === "uploading" || f.status === "processing" || f.status === "validating");
  const allScanned = requiredCount > 0 && reviewedCount === requiredCount && !uploading;
  const canContinue = allScanned && confirmed;
  const primarySig = primaryFiles.map((f) => f.id).join(",");

  // Re-confirm after the file set changes (add / remove).
  useEffect(() => { setConfirmed(false); /* reset on file-set change */ }, [primarySig]);

  const hasActiveUpload = files.some((f) => f.status === "uploading" || f.status === "processing" || f.status === "validating");
  useEffect(() => {
    if (!hasActiveUpload) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasActiveUpload]);

  const updateFile = useCallback((updated: StoredFile) => {
    saveMeta(updated);
    onFilesChange((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }, [onFilesChange]);

  const removeFile = useCallback(async (id: string) => {
    const ctrl = abortControllers.current.get(id);
    if (ctrl) ctrl.abort();
    await deleteFile(id);
    onFilesChange((prev) => prev.filter((f) => f.id !== id));
  }, [onFilesChange]);

  const startUpload = useCallback(async (rawFile: File, meta: StoredFile) => {
    const controller = new AbortController();
    abortControllers.current.set(meta.id, controller);
    let current = meta;
    const patch = (p: Partial<StoredFile>) => {
      current = { ...current, ...p };
      saveMeta(current);
      onFilesChange((prev) => prev.map((f) => (f.id === current.id ? current : f)));
    };
    try {
      await saveBlob(meta.id, rawFile);
      await simulateUpload(
        current,
        (progress, bytes) => patch({ progress, uploadedBytes: bytes }),
        (status) => patch({ status }),
        controller.signal
      );
      patch({ status: "completed", progress: 100, uploadedBytes: rawFile.size });
    } catch (err) {
      patch((err as Error).message === "cancelled" ? { status: "cancelled" } : { status: "error", error: (err as Error).message || "Upload failed" });
    } finally {
      abortControllers.current.delete(meta.id);
    }
  }, [onFilesChange]);

  const retryFile = useCallback(async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    const blob = await getBlob(id);
    if (!blob) return;
    const reset = { ...file, status: "queued" as FileStatus, progress: 0, uploadedBytes: 0, error: null };
    updateFile(reset);
    startUpload(new File([blob], file.name, { type: file.mimeType }), reset);
  }, [files, updateFile, startUpload]);

  const handleFilesForPurpose = useCallback(async (purpose: FilePurpose, fileList: FileList | File[], singleFile: boolean) => {
    const incoming = Array.from(fileList);
    const purposeFiles = files.filter((f) => f.purpose === purpose && f.status !== "cancelled");
    let currentAll = [...files];

    for (const rawFile of incoming) {
      if (singleFile && purposeFiles.length >= 1) {
        const old = purposeFiles[0];
        const ctrl = abortControllers.current.get(old.id);
        if (ctrl) ctrl.abort();
        await deleteFile(old.id);
        currentAll = currentAll.filter((f) => f.id !== old.id);
      }

      const { sanitized, wasSanitized } = sanitizeFilename(rawFile.name);
      const validation = validateFile(rawFile, purpose, currentAll, PURPOSE_MAX_SIZE[purpose]);

      const meta: StoredFile = {
        id: generateId(),
        name: sanitized,
        originalName: rawFile.name,
        sanitized: wasSanitized,
        mimeType: rawFile.type || "application/octet-stream",
        size: rawFile.size,
        uploadedAt: new Date().toISOString(),
        uploader,
        purpose,
        required: purpose === "manuscript" || purpose === "payment-proof",
        category: "",
        notes: "",
        status: validation.valid ? "queued" : "error",
        progress: 0,
        uploadedBytes: 0,
        version: 1,
        replacedBy: null,
        error: validation.valid ? null : validation.errors.join("; ")
      };

      currentAll = [...currentAll, meta];
      onFilesChange(currentAll);
      await saveMeta(meta);
      if (validation.valid) startUpload(rawFile, meta);
    }
  }, [files, uploader, onFilesChange, startUpload]);

  const triggerShake = () => {
    setShaking(true);
    window.setTimeout(() => setShaking(false), 650);
  };

  const maxSize = PURPOSE_MAX_SIZE[primaryPurpose];

  return (
    <div className="fuz-panel-wrap">
      <div className="fuz-shell">
      {showZones && !locked && purposes.map((purpose) => {
        const purposeFiles = files.filter((f) => f.purpose === purpose && f.status !== "cancelled");
        const singleFile = purpose === "cover-image";
        const hasFiles = purposeFiles.length > 0;
        const isUploading = purposeFiles.some((f) => f.status === "uploading" || f.status === "processing" || f.status === "validating");
        const isDragging = draggingPurpose === purpose;
        const inputId = `fuz-input-${purpose}`;
        const openInput = () => document.getElementById(inputId)?.click();
        const shown = purposeFiles.slice(0, 36);
        const overflow = purposeFiles.length - shown.length;
        const cols = shown.length <= 1 ? 1 : shown.length <= 2 ? 2 : shown.length <= 3 ? 3 : shown.length <= 6 ? 3 : shown.length <= 12 ? 4 : shown.length <= 20 ? 5 : 6;
        const pPills = formatPills(purpose);

        return (
          <div key={purpose} className="fuz-grid">
            {/* Left column */}
            <div className="fuz-col-left">
              <div className="fuz-col-head">
                <span className="fuz-head-icon"><Icon name="cloud" className="h-5 w-5" /></span>
                <div>
                  <h3 className="fuz-head-title">Upload Documents</h3>
                  <p className="fuz-head-sub">Upload all required files for your submission.</p>
                </div>
              </div>

              <div
                className={`fuz-drop ${hasFiles ? "has-files" : ""} ${isDragging ? "drag" : ""} ${isUploading ? "busy" : ""}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDraggingPurpose(purpose); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingPurpose(null); }}
                onDrop={(e) => { e.preventDefault(); setDraggingPurpose(null); if (e.dataTransfer.files.length) handleFilesForPurpose(purpose, e.dataTransfer.files, singleFile); }}
              >
                {hasFiles && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    className="fuz-drop-tiles"
                    style={{ ["--cols" as string]: String(cols) } as React.CSSProperties}
                  >
                    {shown.map((file) => {
                      const tt = tone(file.status);
                      const canP = tt === "ok" && (isDocx(file) || isPdf(file) || isImage(file));
                      return (
                        <div
                          key={file.id}
                          className={`fuz-tile ${canP ? "can-preview" : ""} ${tt === "err" ? "err" : ""}`}
                          onClick={(e) => { e.stopPropagation(); if (canP) setPreviewFile(file); }}
                          title={`${file.name} · ${statusLabel(file.status, file.progress)}${canP ? " — click to preview" : ""}`}
                        >
                          {tt !== "idle" && <span className={`fuz-tile-badge ${tt}`}><StatusMark t={tt} size={15} /></span>}
                          <span className="fuz-tile-glyph"><FileGlyph file={file} size={42} /></span>
                        </div>
                      );
                    })}
                    {overflow > 0 && <div className="fuz-tile fuz-tile-more" title={`${overflow} more file${overflow > 1 ? "s" : ""}`}><span>+{overflow}</span></div>}
                  </motion.div>
                )}

                {/* Upload affordance — centered hero when empty; collapses to an icon-only button above the formats once files exist */}
                <motion.button
                  type="button"
                  layout
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className={`fuz-prompt ${hasFiles ? "compact" : "empty"}`}
                  onClick={openInput}
                  role="button"
                  tabIndex={0}
                  aria-label={hasFiles ? "Add more files" : "Upload files"}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openInput(); } }}
                >
                  <motion.span layout className="fuz-prompt-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </motion.span>
                  {!hasFiles && (
                    <>
                      <span className="fuz-prompt-stack">
                        <span className="fuz-prompt-title">Drag and Drop files to upload</span>
                        <span className="fuz-prompt-or">or</span>
                      </span>
                      <span className="fuz-browse">Browse</span>
                    </>
                  )}
                </motion.button>

                <div className="fuz-formats">
                  <span className="fuz-formats-label">Supported formats:</span>
                  <span className="fuz-pills">{pPills.map((ext) => <span key={ext} className={`fuz-pill ${pillTone(ext)}`}>{ext}</span>)}</span>
                </div>
                <div className="fuz-maxbar">
                  <Icon name="shield" className="h-4 w-4" />
                  <span>Maximum file size: {maxSize}MB per file</span>
                </div>

                <input
                  id={inputId}
                  type="file"
                  accept={PURPOSE_ACCEPT[purpose]}
                  multiple={!singleFile}
                  hidden
                  onChange={(e) => { if (e.target.files?.length) handleFilesForPurpose(purpose, e.target.files, singleFile); e.target.value = ""; }}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="fuz-col-right">
              <div className="fuz-files-head">
                <h3 className="fuz-files-title">Uploaded files</h3>
                {hasFiles && <span className="fuz-files-count">{purposeFiles.length}</span>}
              </div>

              {hasFiles && (
                <div className="fuz-verify">
                  <span className="fuz-verify-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="M12 13.4c1.7 0 3-1.2 3-2.4s-1.3-2.4-3-2.4-3 1.2-3 2.4 1.3 2.4 3 2.4Z" /><circle cx="12" cy="11" r=".7" fill="currentColor" stroke="none" /></svg>
                  </span>
                  <div className="fuz-verify-copy">
                    <strong>Verify your attachments</strong>
                    <p>Preview the uploaded files and check their filenames, document types, and contents before proceeding.</p>
                  </div>
                  <button type="button" className="fuz-review-btn" onClick={triggerShake}>
                    <Icon name="eye" className="h-4 w-4" /> Review all files
                  </button>
                </div>
              )}

              <div className={`fuz-files-box ${shaking ? "fuz-shake" : ""}`}>
                {!hasFiles && <p className="fuz-files-empty">No files yet — drop a file on the left or click Browse.</p>}
                {hasFiles && (
                  <div className="fuz-list">
                    <AnimatePresence mode="popLayout">
                      {purposeFiles.map((file) => (
                        <FileRow
                          key={file.id}
                          file={file}
                          onRemove={() => removeFile(file.id)}
                          onPreview={() => setPreviewFile(file)}
                          onRetry={() => retryFile(file.id)}
                          onRename={(n) => updateFile({ ...file, name: n })}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {hasFiles && (
                <div className="fuz-secured">
                  <Icon name="shield" className="h-4 w-4" />
                  <span>All files scanned and secured</span>
                </div>
              )}

              {onContinue && (
                <div className="fuz-confirm">
                  <div className="fuz-confirm-box">
                    {requiredCount > 0 ? (
                      <>
                        <label className="fuzc-check">
                          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                          <span className="fuzc-box"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></span>
                          <span className="fuzc-text">{confirmLabel}</span>
                        </label>
                        <span className={`fuzc-count ${allScanned ? "ok" : "warn"}`}>
                          {reviewedCount} of {requiredCount} required files reviewed
                          <svg className="fuzc-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
                        </span>
                      </>
                    ) : (
                      <span className="fuzc-muted">Upload the required files to continue.</span>
                    )}
                  </div>
                  <div className="fuz-confirm-actions">
                    {onBack && (
                      <button type="button" className="fuzc-back" onClick={onBack}>
                        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
                      </button>
                    )}
                    <button type="button" className={`fuzc-continue ${canContinue ? "ready" : ""}`} disabled={!canContinue} onClick={onContinue}>
                      Continue <Icon name="arrow" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>

      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

export function hasAllRequiredFiles(files: StoredFile[]): boolean {
  const active = files.filter((f) => f.status !== "cancelled");
  return active.some((f) => f.purpose === "manuscript" && f.status === "completed") &&
    active.some((f) => f.purpose === "payment-proof" && f.status === "completed");
}

export function hasActiveUploads(files: StoredFile[]): boolean {
  return files.some((f) => f.status === "uploading" || f.status === "processing" || f.status === "validating");
}
