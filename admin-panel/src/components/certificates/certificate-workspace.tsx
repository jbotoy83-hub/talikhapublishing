import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "./certificates.css";
import type {
  CertificateTemplate, CertificateRecord, CertificateBlock, CertificatePage,
  WorkspaceMode, RightTab, ValidationResult, BlockStyle, TextSegment,
} from "./types";
import { CERT_FONTS, CANVAS_PRESETS } from "./types";
import {
  uid, validateCertificate, generateCertificateNumber,
  getFieldUsage, createDefaultTemplate, createDefaultRecord,
  createTextBlock, createLinkedBlock, createImageBlock, duplicateBlock, getMaxZIndex,
  loadTemplates, saveTemplates, loadRecords, saveRecords,
  readFileAsDataUrl, getImageDimensions, segmentsToContent, normalizeSegments,
  resolveAllBlocks,
} from "./field-engine";
import { CertificateCanvas } from "./certificate-canvas";
import { Trash2 } from "@/components/icons";

interface WorkspaceProps {
  submissions?: Array<{ id: string; reference?: string; title?: string; author?: string }>;
}

export function CertificateWorkspace({ submissions = [] }: WorkspaceProps) {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [records, setRecords] = useState<CertificateRecord[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("builder");
  const [zoom, setZoom] = useState(0);
  const [rightTab, setRightTab] = useState<RightTab>("data");
  const [rightOpen, setRightOpen] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showMargins, setShowMargins] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplatePub, setNewTemplatePub] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const lastUndoRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const bgImageInputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef<string | null>(null);
  const prevEditingRef = useRef<string | null>(null);
  const templateRef = useRef<CertificateTemplate | null>(null);

  const template = templates.find((t) => t.id === activeTemplateId) || null;
  const record = records.find((r) => r.id === activeRecordId) || null;
  const currentPage = (template?.pages || [])[currentPageIdx] || null;
  const activeBlocks = mode === "generator" && record?.blocks ? record.blocks : (template?.blocks || []);
  const currentBlocks = activeBlocks.filter((b) => b.pageId === currentPage?.id);
  const fieldValues = useMemo(() => record?.fieldValues || {}, [record]);
  const selectedBlock = activeBlocks.find((b) => b.id === selectedBlockId) || null;
  templateRef.current = template;
  editingRef.current = editingBlockId;

  useEffect(() => {
    const loaded = loadTemplates();
    setTemplates(loaded);
    saveTemplates(loaded);
    setRecords(loadRecords());
  }, []);

  const persist = useCallback((t: CertificateTemplate[], r: CertificateRecord[]) => {
    saveTemplates(t);
    saveRecords(r);
    setDirty(false);
  }, []);

  const pushUndo = useCallback(() => {
    const t = templateRef.current;
    if (!t) return;
    setUndoStack((s) => [...s.slice(-29), JSON.stringify(t)]);
    setRedoStack([]);
    lastUndoRef.current = Date.now();
  }, []);

  const onTransformStart = useCallback(() => { pushUndo(); }, [pushUndo]);

  const updateTemplate = useCallback((updater: (t: CertificateTemplate) => CertificateTemplate, opts?: { transient?: boolean }) => {
    const t = templateRef.current;
    if (!t) return;
    if (!(opts && opts.transient) && !editingRef.current) {
      const now = Date.now();
      if (now - lastUndoRef.current > 350) pushUndo();
    }
    setTemplates((prev) => prev.map((x) => x.id === t.id ? { ...updater(x), updatedAt: new Date().toISOString() } : x));
    setDirty(true);
  }, [pushUndo]);

  const updateRecord = useCallback((updater: (r: CertificateRecord) => CertificateRecord) => {
    if (!record) return;
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...updater(r), updatedAt: new Date().toISOString() } : r));
    setDirty(true);
  }, [record]);

  const setFieldValue = useCallback((key: string, value: string) => {
    updateRecord((r) => ({ ...r, fieldValues: { ...r.fieldValues, [key]: value } }));
  }, [updateRecord]);

  const undo = useCallback(() => {
    if (!undoStack.length || !template) return;
    const prev = JSON.parse(undoStack[undoStack.length - 1]) as CertificateTemplate;
    setRedoStack((s) => [...s, JSON.stringify(template)]);
    setUndoStack((s) => s.slice(0, -1));
    setTemplates((ts) => ts.map((t) => t.id === template.id ? prev : t));
    setDirty(true);
  }, [undoStack, template]);

  const redo = useCallback(() => {
    if (!redoStack.length || !template) return;
    const next = JSON.parse(redoStack[redoStack.length - 1]) as CertificateTemplate;
    setUndoStack((s) => [...s, JSON.stringify(template)]);
    setRedoStack((s) => s.slice(0, -1));
    setTemplates((ts) => ts.map((t) => t.id === template.id ? next : t));
    setDirty(true);
  }, [redoStack, template]);

  useEffect(() => {
    if (mode !== "builder") return;
    if (selectedBlockId) setRightOpen(false);
    else setRightOpen(true);
  }, [selectedBlockId, mode]);

  // Snapshot the template once when text editing begins, so a whole typing session
  // collapses into a single undo step (and per-keystroke updates skip snapshotting).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- templateRef is read intentionally without being a dep
  useEffect(() => {
    if (editingBlockId && !prevEditingRef.current && templateRef.current) {
      setUndoStack((s) => [...s.slice(-29), JSON.stringify(templateRef.current)]);
      setRedoStack([]);
      lastUndoRef.current = Date.now();
    }
    prevEditingRef.current = editingBlockId;
  }, [editingBlockId]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  useEffect(() => {
    if (!template) { setValidation(null); return; }
    const id = setTimeout(() => setValidation(validateCertificate(template, fieldValues)), 200);
    return () => clearTimeout(id);
  }, [template, fieldValues]);

  const createTemplate = () => {
    if (!newTemplateName.trim()) return;
    const t = createDefaultTemplate(newTemplateName.trim(), newTemplatePub.trim());
    const next = [...templates, t];
    setTemplates(next); saveTemplates(next);
    setActiveTemplateId(t.id); setNewTemplateName(""); setNewTemplatePub(""); setShowCreateForm(false);
  };

  const createRecordForTemplate = () => {
    if (!template) return;
    const r = createDefaultRecord(template);
    const next = [...records, r];
    setRecords(next); saveRecords(next);
    setActiveRecordId(r.id); setMode("generator"); setRightTab("data");
  };

  const showToast = (msg: string, undo: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, undo });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };
  const dismissToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  };
  const deleteRecord = (id: string) => {
    const target = records.find((r) => r.id === id);
    if (!target) return;
    const name = target.fieldValues["author_name"] || target.certificateNumber || "this record";
    const ok = target.status === "issued"
      ? window.confirm("This certificate is already issued. Delete the record for " + name + "?")
      : window.confirm("Delete the certificate record for " + name + "?");
    if (!ok) return;
    const before = records;
    const next = before.filter((r) => r.id !== id);
    setRecords(next);
    saveRecords(next);
    if (activeRecordId === id) setActiveRecordId(null);
    showToast("Certificate record deleted", () => {
      setRecords(before);
      saveRecords(before);
      if (activeRecordId === null) setActiveRecordId(id);
    });
  };
  const deleteTemplate = (id: string) => {
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    const refCount = records.filter((r) => r.templateId === id).length;
    const msg = refCount > 0
      ? 'Delete template "' + target.name + '"? Its ' + refCount + " certificate record(s) will stay but become unlinked."
      : 'Delete template "' + target.name + '"?';
    if (!window.confirm(msg)) return;
    const before = templates;
    const next = before.filter((t) => t.id !== id);
    setTemplates(next);
    saveTemplates(next);
    if (activeTemplateId === id) {
      setActiveTemplateId(null);
      setSelectedBlockId(null);
      setEditingBlockId(null);
    }
    showToast('Template "' + target.name + '" deleted', () => { setTemplates(before); saveTemplates(before); });
  };

  const ensureRecordBlocks = useCallback(() => {
    if (!record || !template) return;
    if (record.blocks) return;
    const resolved = template.blocks.map((b) => {
      if (b.type !== "text") return { ...b };
      const segs = b.segments && b.segments.length ? b.segments : [];
      const resolvedSegs: TextSegment[] = segs.map((s) => {
        if (s.t === "f") {
          const val = fieldValues[s.k] ?? "";
          return { t: "s" as const, v: val };
        }
        return { ...s };
      });
      const content = resolvedSegs.map((s) => s.t === "f" ? "" : s.v).join("");
      return { ...b, segments: resolvedSegs, content, linkedFieldKey: null };
    });
    const next = records.map((r) => r.id === record.id ? { ...r, blocks: resolved, updatedAt: new Date().toISOString() } : r);
    setRecords(next);
    saveRecords(next);
  }, [record, template, fieldValues, records]);

  useEffect(() => {
    if (mode === "generator" && record && !record.blocks && template) {
      ensureRecordBlocks();
    }
  }, [mode, record, template, ensureRecordBlocks]);

  const updateRecordBlocks = useCallback((updater: (blocks: CertificateBlock[]) => CertificateBlock[]) => {
    if (!record) return;
    const current = record.blocks || [];
    const next = records.map((r) => r.id === record.id ? { ...r, blocks: updater(current), updatedAt: new Date().toISOString() } : r);
    setRecords(next);
    saveRecords(next);
    setDirty(true);
  }, [record, records]);

  const addBlock = (block: CertificateBlock) => {
    if (mode === "generator") {
      ensureRecordBlocks();
      setTimeout(() => {
        updateRecordBlocks((blocks) => [...blocks, { ...block, zIndex: getMaxZIndex(blocks, block.pageId) + 1 }]);
        setSelectedBlockId(block.id);
      }, 0);
      return;
    }
    updateTemplate((t) => ({ ...t, blocks: [...t.blocks, { ...block, zIndex: getMaxZIndex(t.blocks, block.pageId) + 1 }] }));
    setSelectedBlockId(block.id);
  };

  const updateBlock = useCallback((id: string, updates: Partial<CertificateBlock>, transient?: boolean) => {
    if (mode === "generator") {
      updateRecordBlocks((blocks) => blocks.map((b) => b.id === id ? { ...b, ...updates } : b));
      return;
    }
    updateTemplate((t) => ({ ...t, blocks: t.blocks.map((b) => b.id === id ? { ...b, ...updates } : b) }), transient ? { transient: true } : undefined);
  }, [updateTemplate, mode, updateRecordBlocks]);

  const updateBlockStyle = (id: string, styleUpdates: Partial<BlockStyle>) => {
    if (mode === "generator") {
      updateRecordBlocks((blocks) => blocks.map((b) => b.id === id ? { ...b, style: { ...b.style, ...styleUpdates } } : b));
      return;
    }
    updateTemplate((t) => ({ ...t, blocks: t.blocks.map((b) => b.id === id ? { ...b, style: { ...b.style, ...styleUpdates } } : b) }));
  };

  const deleteBlock = useCallback((id: string) => {
    if (mode === "generator") {
      updateRecordBlocks((blocks) => blocks.filter((b) => b.id !== id));
    } else {
      updateTemplate((t) => ({ ...t, blocks: t.blocks.filter((b) => b.id !== id) }));
    }
    if (selectedBlockId === id) { setSelectedBlockId(null); setEditingBlockId(null); }
  }, [mode, updateRecordBlocks, updateTemplate, selectedBlockId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (typing) return;
      if (e.key === "Delete" && selectedBlockId) {
        deleteBlock(selectedBlockId);
      }
      if (e.key === "Escape") { setSelectedBlockId(null); setEditingBlockId(null); }
      if (e.key === "ArrowLeft" && e.altKey) { e.preventDefault(); setCurrentPageIdx((i) => Math.max(0, i - 1)); }
      if (e.key === "ArrowRight" && e.altKey) { e.preventDefault(); setCurrentPageIdx((i) => Math.min((template?.pages.length || 1) - 1, i + 1)); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, selectedBlockId, mode, template, updateTemplate, deleteBlock]);

  const toggleTextStyle = (prop: "fontWeight" | "fontStyle", value: number | string) => {
    if (!selectedBlock) return;
    updateBlockStyle(selectedBlock.id, { [prop]: value } as Partial<BlockStyle>);
  };

  const toggleTextDecoration = (deco: string) => {
    if (!selectedBlock) return;
    const current = selectedBlock.style.textDecoration || "none";
    if (current === "none" || !current) updateBlockStyle(selectedBlock.id, { textDecoration: deco });
    else if (current.includes(deco)) updateBlockStyle(selectedBlock.id, { textDecoration: current.replace(deco, "").replace(/\s+/g, " ").trim() || "none" });
    else updateBlockStyle(selectedBlock.id, { textDecoration: `${current} ${deco}` });
  };

  const hasDecoration = (deco: string) => {
    if (!selectedBlock) return false;
    const d = selectedBlock.style.textDecoration || "none";
    return d !== "none" && d.includes(deco);
  };

  const handleSelect = useCallback((id: string | null) => {
    setSelectedBlockId(id);
    if (id === null) setEditingBlockId(null);
    else if (id !== editingRef.current) setEditingBlockId(null);
  }, []);

  const startEdit = useCallback((id: string) => {
    setSelectedBlockId(id);
    setEditingBlockId(id);
  }, []);

  const editCommit = useCallback((id: string, segs: TextSegment[]) => {
    const norm = normalizeSegments(segs);
    const content = segmentsToContent(norm);
    const onlyField = norm.length === 1 && norm[0].t === "f" ? norm[0].k : null;
    if (mode === "generator") {
      updateRecordBlocks((blocks) => blocks.map((b) => b.id === id ? { ...b, segments: norm, content, linkedFieldKey: onlyField } : b));
      return;
    }
    updateTemplate((t) => ({ ...t, blocks: t.blocks.map((b) => b.id === id ? { ...b, segments: norm, content, linkedFieldKey: onlyField } : b) }));
  }, [updateTemplate, mode, updateRecordBlocks]);

  const handleSetBackground = async (file: File | undefined) => {
    if (!file || !currentPage) return;
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    const dims = await getImageDimensions(dataUrl);
    updateTemplate((t) => ({
      ...t,
      pages: t.pages.map((p) => p.id === currentPage.id ? { ...p, backgroundImageUrl: dataUrl, width: dims.width, height: dims.height } : p),
    }));
  };

  const handleAddImage = async (file: File | undefined) => {
    if (!file || !currentPage) return;
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    const dims = await getImageDimensions(dataUrl);
    let w = dims.width; let h = dims.height;
    const maxW = currentPage.width * 0.9; const maxH = currentPage.height * 0.9;
    if (w > maxW || h > maxH) { const s = Math.min(maxW / w, maxH / h); w = Math.round(w * s); h = Math.round(h * s); }
    const block = createImageBlock(currentPage.id, Math.round((currentPage.width - w) / 2), Math.round((currentPage.height - h) / 2), dataUrl, w, h);
    block.name = file.name.replace(/\.[^.]+$/, "");
    addBlock(block);
  };

  const handleReplaceImage = async (file: File | undefined) => {
    if (!file || !selectedBlock) return;
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    updateBlock(selectedBlock.id, { assetUrl: dataUrl, name: file.name.replace(/\.[^.]+$/, "") });
  };

  if (!template) {
    return (
      <div className="cert-ws cert-ws--list">
        <div className="cert-ws-header">
          <h1 className="cert-ws-title">Certificate Templates</h1>
          <button className="cert-btn cert-btn--primary" onClick={() => setShowCreateForm(true)}>+ New Template</button>
        </div>
        {showCreateForm && (
          <div className="cert-create-form">
            <input placeholder="Template name" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} className="cert-input" />
            <input placeholder="Publication (optional)" value={newTemplatePub} onChange={(e) => setNewTemplatePub(e.target.value)} className="cert-input" />
            <div className="cert-create-actions">
              <button className="cert-btn cert-btn--primary" onClick={createTemplate}>Create</button>
              <button className="cert-btn" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </div>
        )}
        <div className="cert-template-grid">
          {templates.map((t) => (
            <div key={t.id} className="cert-template-card" onClick={() => { setActiveTemplateId(t.id); setCurrentPageIdx(0); setSelectedBlockId(null); setEditingBlockId(null); }}>
              <button type="button" className="cert-card-del" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }} title="Delete template" aria-label={"Delete template " + t.name}><Trash2 size={13} strokeWidth={2} /></button>
              <div className="cert-template-card-head">
                <h3>{t.name}</h3>
                <span className={`cert-status cert-status--${t.status}`}>{t.status}</span>
              </div>
              <p className="cert-template-card-pub">{t.publication || "—"}</p>
              <div className="cert-template-card-meta">
                <span>{t.pages.length} pages</span>
                <span>{t.blocks.length} blocks</span>
                <span>v{t.version}</span>
              </div>
              <p className="cert-template-card-date">{new Date(t.updatedAt).toLocaleDateString()}</p>
            </div>
          ))}
          {templates.length === 0 && !showCreateForm && (
            <div className="cert-empty-state">
              <p>No certificate templates yet.</p>
              <button className="cert-btn cert-btn--primary" onClick={() => setShowCreateForm(true)}>Create your first template</button>
            </div>
          )}
        </div>

        {records.length > 0 && (
          <div className="cert-records-section">
            <h2 className="cert-section-title">Certificate Records</h2>
            <div className="cert-records-list">
              {records.map((r) => (
                <div key={r.id} className="cert-record-row" onClick={() => { setActiveTemplateId(r.templateId); setActiveRecordId(r.id); setMode("generator"); setRightTab("data"); }}>
                  <span className="cert-record-num">{r.certificateNumber}</span>
                  <span className="cert-record-name">{r.fieldValues["author_name"] || "—"}</span>
                  <span className="cert-record-title">{r.fieldValues["work_title"] || "—"}</span>
                  <span className={`cert-status cert-status--${r.status}`}>{r.status}</span>
                  <span className="cert-record-date">{new Date(r.updatedAt).toLocaleDateString()}</span>
                  <button type="button" className="cert-record-del" onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }} title="Delete record" aria-label={"Delete record " + (r.fieldValues["author_name"] || r.certificateNumber)}><Trash2 size={14} strokeWidth={2} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        {toast && (
          <div className="cert-toast" role="status">
            <span className="cert-toast-msg">{toast.msg}</span>
            <button type="button" className="cert-toast-undo" onClick={() => { const u = toast.undo; dismissToast(); u(); }}>Undo</button>
            <button type="button" className="cert-toast-close" onClick={dismissToast} aria-label="Dismiss notification">x</button>
          </div>
        )}
      </div>
    );
  }

  const builderTabs: RightTab[] = ["data", "fields", "layers", "page"];
  const generatorTabs: RightTab[] = ["data", "validation", "export"];
  const tabs = mode === "builder" ? builderTabs : generatorTabs;
  const tabLabels: Record<RightTab, string> = { data: "Data", fields: "Linked Fields", layers: "Layers", page: "Page", validation: "Validation", export: "Export" };
  const authorFields = (template.fields || []).filter((f) => f.section === "author");
  const pubFields = (template.fields || []).filter((f) => f.section === "publication");
  const certFields = (template.fields || []).filter((f) => f.section === "certificate");

  const isTextSelected = selectedBlock?.type === "text";

  const exportCurrentPagePNG = useCallback(async () => {
    const pageEl = document.querySelector(".cert-canvas-page") as HTMLElement;
    if (!pageEl) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    link.download = (template?.name || "certificate") + "_page" + (currentPageIdx + 1) + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [template, currentPageIdx]);

  const exportCurrentPagePDF = useCallback(async () => {
    const pageEl = document.querySelector(".cert-canvas-page") as HTMLElement;
    if (!pageEl || !currentPage) return;
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pw = currentPage.width;
    const ph = currentPage.height;
    const orientation = pw > ph ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "px", format: [pw, ph], hotfixes: ["px_scaling"] });
    pdf.addImage(imgData, "PNG", 0, 0, pw, ph);
    pdf.save((template?.name || "certificate") + "_page" + (currentPageIdx + 1) + ".pdf");
  }, [template, currentPage, currentPageIdx]);

  const exportAllPagesPDF = useCallback(async () => {
    if (!template || !currentPage) return;
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const firstPage = template.pages[0];
    const orientation = firstPage.width > firstPage.height ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "px", format: [firstPage.width, firstPage.height], hotfixes: ["px_scaling"] });
    const origIdx = currentPageIdx;
    for (let i = 0; i < template.pages.length; i++) {
      setCurrentPageIdx(i);
      setSelectedBlockId(null);
      setEditingBlockId(null);
      await new Promise((r) => setTimeout(r, 100));
      const pageEl = document.querySelector(".cert-canvas-page") as HTMLElement;
      if (!pageEl) continue;
      const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pg = template.pages[i];
      if (i > 0) {
        const o = pg.width > pg.height ? "landscape" : "portrait";
        pdf.addPage([pg.width, pg.height], o);
      }
      pdf.addImage(imgData, "PNG", 0, 0, pg.width, pg.height);
    }
    setCurrentPageIdx(origIdx);
    pdf.save((template.name || "certificate") + ".pdf");
  }, [template, currentPage, currentPageIdx]);

  const hasEditorSel = (): boolean => {
    if (!editingBlockId) return false;
    const sel = window.getSelection();
    const editor = document.querySelector(".cert-inline-editor");
    return !!(sel && !sel.isCollapsed && editor && editor.contains(sel.anchorNode));
  };
  const dispatchFmt = (style: Partial<BlockStyle>, toggleProp?: string) => {
    window.dispatchEvent(new CustomEvent("cert-apply-format", { detail: { style, toggleProp } }));
  };
  const fmt = (style: Partial<BlockStyle>, toggleProp?: string) => {
    if (!selectedBlock) return;
    if (hasEditorSel()) { dispatchFmt(style, toggleProp); return; }
    if (toggleProp === "fontWeight") toggleTextStyle("fontWeight", selectedBlock.style.fontWeight >= 700 ? 400 : 700);
    else if (toggleProp === "fontStyle") toggleTextStyle("fontStyle", selectedBlock.style.fontStyle === "italic" ? "normal" : "italic");
    else if (toggleProp === "textDecoration") {
      const d = Object.values(style)[0] as string;
      toggleTextDecoration(d);
    } else {
      updateBlockStyle(selectedBlock.id, style);
    }
  };

  return (
    <div className="cert-ws">
      <header className="cert-header">
        <div className="cert-header-left">
          <button className="cert-header-back" onClick={() => { setActiveTemplateId(null); setActiveRecordId(null); setSelectedBlockId(null); setEditingBlockId(null); }} title="Back to templates">←</button>
          <div className="cert-header-info">
            <span className="cert-header-breadcrumb">Certificates / {template.name}</span>
            <span className={`cert-saved-indicator ${dirty ? "unsaved" : "saved"}`}>{dirty ? "Unsaved" : "Saved ✓"}</span>
          </div>
        </div>
        <div className="cert-header-center">
          <div className="cert-mode-toggle">
            <button className={mode === "builder" ? "active" : ""} onClick={() => { setMode("builder"); setRightTab("data"); setSelectedBlockId(null); setEditingBlockId(null); }}>Template Builder</button>
            <button className={mode === "generator" ? "active" : ""} onClick={() => { if (!record) createRecordForTemplate(); setMode("generator"); setRightTab("data"); setSelectedBlockId(null); setEditingBlockId(null); }}>Generate Certificate</button>
          </div>
        </div>
        <div className="cert-header-right">
          {mode === "builder" && (
            <>
              <button className="cert-btn cert-btn--ghost" onClick={undo} disabled={!undoStack.length} title="Undo (Ctrl+Z)">↩</button>
              <button className="cert-btn cert-btn--ghost" onClick={redo} disabled={!redoStack.length} title="Redo (Ctrl+Y)">↪</button>
              <button className={`cert-btn cert-btn--ghost ${showMargins ? "active" : ""}`} onClick={() => setShowMargins(!showMargins)} title="Toggle safe margins">⊞</button>
              <button className={`cert-btn cert-btn--ghost ${rightOpen ? "active" : ""}`} onClick={() => setRightOpen((v) => !v)} title="Toggle right panel">☰</button>
            </>
          )}
          <button className={`cert-btn ${dirty ? "cert-btn--primary" : ""}`} onClick={() => persist(templates, records)}>{dirty ? "Save" : "Saved"}</button>
          {mode === "generator" && validation && (
            <button className={`cert-btn ${validation.canExport ? "cert-btn--primary" : "cert-btn--warn"}`} onClick={() => setRightTab("validation")}>
              {validation.canExport ? "Export" : `${validation.errors} errors`}
            </button>
          )}
        </div>
      </header>

      {mode === "builder" && isTextSelected && selectedBlock && (
        <div className="cert-format-bar" onMouseDown={(e) => { if (editingBlockId) e.preventDefault(); }}>
          <div className="cert-fmt-group">
            <select className="cert-fmt-select cert-fmt-font" value={selectedBlock.style.fontFamily} onChange={(e) => fmt({ fontFamily: e.target.value })} title="Font family">
              {CERT_FONTS.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
            </select>
            <div className="cert-fmt-size-wrap">
              <button className="cert-fmt-size-btn" onClick={() => fmt({ fontSize: Math.max(1, selectedBlock.style.fontSize - 1) })} title="Decrease">−</button>
              <input className="cert-fmt-size" type="number" min={1} max={500} value={selectedBlock.style.fontSize} onChange={(e) => fmt({ fontSize: Math.max(1, +e.target.value) })} title="Font size (px)" />
              <span className="cert-fmt-size-unit">px</span>
              <button className="cert-fmt-size-btn" onClick={() => fmt({ fontSize: selectedBlock.style.fontSize + 1 })} title="Increase">+</button>
            </div>
          </div>
          <span className="cert-fmt-sep" />
          <div className="cert-fmt-group">
            <button className={`cert-fmt-btn ${selectedBlock.style.fontWeight >= 700 ? "active" : ""}`} onClick={() => fmt({ fontWeight: 700 }, "fontWeight")} title="Bold"><b>B</b></button>
            <button className={`cert-fmt-btn ${selectedBlock.style.fontStyle === "italic" ? "active" : ""}`} onClick={() => fmt({ fontStyle: "italic" }, "fontStyle")} title="Italic"><i>I</i></button>
            <button className={`cert-fmt-btn ${hasDecoration("underline") ? "active" : ""}`} onClick={() => fmt({ textDecoration: "underline" }, "textDecoration")} title="Underline"><u>U</u></button>
            <button className={`cert-fmt-btn ${hasDecoration("line-through") ? "active" : ""}`} onClick={() => fmt({ textDecoration: "line-through" }, "textDecoration")} title="Strikethrough"><s>S</s></button>
            <button className="cert-fmt-btn" onClick={() => { if (hasEditorSel()) dispatchFmt({}); else updateBlockStyle(selectedBlock.id, { fontWeight: 400, fontStyle: "normal", textDecoration: "none", textTransform: "none", letterSpacing: 0 }); }} title="Clear formatting">⌫</button>
          </div>
          <span className="cert-fmt-sep" />
          <div className="cert-fmt-group">
            <label className="cert-fmt-color" title="Text color">
              <span className="cert-fmt-color-swatch" style={{ backgroundColor: selectedBlock.style.color }} />
              <input type="color" value={selectedBlock.style.color} onChange={(e) => fmt({ color: e.target.value })} />
            </label>
            <label className="cert-fmt-color" title="Highlight / background">
              <span className="cert-fmt-color-swatch cert-fmt-color-swatch--bg" style={{ backgroundColor: selectedBlock.style.backgroundColor === "transparent" ? "#ffffff00" : selectedBlock.style.backgroundColor }} />
              <input type="color" value={selectedBlock.style.backgroundColor === "transparent" ? "#ffffff" : selectedBlock.style.backgroundColor} onChange={(e) => fmt({ backgroundColor: e.target.value })} />
            </label>
            {selectedBlock.style.backgroundColor !== "transparent" && (
              <button className="cert-fmt-btn cert-fmt-btn--sm" onClick={() => fmt({ backgroundColor: "transparent" })} title="Remove highlight">✕</button>
            )}
          </div>
          <span className="cert-fmt-sep" />
          <div className="cert-fmt-group">
            {(["left", "center", "right", "justify"] as const).map((a) => (
              <button key={a} className={`cert-fmt-btn ${selectedBlock.style.textAlign === a ? "active" : ""}`} onClick={() => updateBlockStyle(selectedBlock.id, { textAlign: a })} title={"Align " + a}>
                <span className="cert-fmt-align-icon">{a === "left" ? "◧" : a === "center" ? "◫" : a === "right" ? "◨" : "▦"}</span>
              </button>
            ))}
          </div>
          <span className="cert-fmt-sep" />
          <div className="cert-fmt-group">
            <div className="cert-fmt-labeled">
              <span className="cert-fmt-label">Line</span>
              <input className="cert-fmt-mini" type="number" step="0.1" min={0.5} max={5} value={selectedBlock.style.lineHeight} onChange={(e) => updateBlockStyle(selectedBlock.id, { lineHeight: +e.target.value })} title="Line height" />
            </div>
            <div className="cert-fmt-labeled">
              <span className="cert-fmt-label">Track</span>
              <input className="cert-fmt-mini" type="number" step="0.5" min={-5} max={20} value={selectedBlock.style.letterSpacing} onChange={(e) => fmt({ letterSpacing: +e.target.value })} title="Letter spacing" />
            </div>
          </div>
          <span className="cert-fmt-sep" />
          <div className="cert-fmt-group">
            <select className="cert-fmt-select cert-fmt-transform" value={selectedBlock.style.textTransform} onChange={(e) => fmt({ textTransform: e.target.value as BlockStyle["textTransform"] })} title="Text case">
              <option value="none">Aa</option>
              <option value="uppercase">AA</option>
              <option value="lowercase">aa</option>
              <option value="titlecase">Ab</option>
            </select>
            <select className="cert-fmt-select cert-fmt-weight" value={selectedBlock.style.fontWeight} onChange={(e) => fmt({ fontWeight: +e.target.value }, "fontWeight")} title="Font weight">
              <option value={300}>Light</option>
              <option value={400}>Regular</option>
              <option value={500}>Medium</option>
              <option value={600}>Semibold</option>
              <option value={700}>Bold</option>
              <option value={800}>X-Bold</option>
              <option value={900}>Black</option>
            </select>
          </div>
        </div>
      )}

      <div className="cert-body">
        {mode === "builder" && (
          <aside className="cert-left-rail">
            <div className="cert-left-section">
              <h4 className="cert-left-title">Add</h4>
              <div className="cert-tool-palette">
                <button className="cert-tool-btn" onClick={() => { if (currentPage) { const b = createTextBlock(currentPage.id, 60, 60); addBlock(b); startEdit(b.id); } }} title="Add text — double-click to type"><span className="cert-tool-ico">T</span><span>Text</span></button>
                <button className="cert-tool-btn" onClick={() => { if (currentPage) addBlock(createLinkedBlock(currentPage.id, "author_name", 60, 60)); }} title="Add a linked field"><span className="cert-tool-ico">⌗</span><span>Field</span></button>
                <button className="cert-tool-btn" onClick={() => imageInputRef.current?.click()} title="Add a resizable image"><span className="cert-tool-ico">🖼</span><span>Image</span></button>
                <button className="cert-tool-btn" onClick={() => bgImageInputRef.current?.click()} title="Set background — canvas auto-sizes to the image"><span className="cert-tool-ico">▣</span><span>Background</span></button>
                <button className="cert-tool-btn" onClick={() => { if (currentPage) { const b = createTextBlock(currentPage.id, 60, 60, ""); addBlock({ ...b, type: "qr", name: "QR Code", content: "", width: 90, height: 90 }); } }} title="Add QR placeholder"><span className="cert-tool-ico">▦</span><span>QR</span></button>
              </div>
            </div>

            {selectedBlock && (
              <div className="cert-left-section cert-inspector">
                <h4 className="cert-left-title">Properties · {selectedBlock.name}</h4>

                <div className="cert-field-row cert-field-row--3">
                  <div className="cert-field-group"><label className="cert-field-label">X</label><input className="cert-input" type="number" value={Math.round(selectedBlock.x)} onChange={(e) => updateBlock(selectedBlock.id, { x: +e.target.value })} /></div>
                  <div className="cert-field-group"><label className="cert-field-label">Y</label><input className="cert-input" type="number" value={Math.round(selectedBlock.y)} onChange={(e) => updateBlock(selectedBlock.id, { y: +e.target.value })} /></div>
                  <div className="cert-field-group"><label className="cert-field-label">Rotate</label><input className="cert-input" type="number" value={selectedBlock.rotation} onChange={(e) => updateBlock(selectedBlock.id, { rotation: +e.target.value })} /></div>
                </div>
                <div className="cert-field-row cert-field-row--3">
                  <div className="cert-field-group"><label className="cert-field-label">W</label><input className="cert-input" type="number" value={Math.round(selectedBlock.width)} onChange={(e) => updateBlock(selectedBlock.id, { width: +e.target.value })} /></div>
                  <div className="cert-field-group"><label className="cert-field-label">H</label><input className="cert-input" type="number" value={Math.round(selectedBlock.height)} onChange={(e) => updateBlock(selectedBlock.id, { height: +e.target.value })} /></div>
                  <div className="cert-field-group"><label className="cert-field-label">Layer</label><input className="cert-input" type="number" value={selectedBlock.zIndex} onChange={(e) => updateBlock(selectedBlock.id, { zIndex: +e.target.value })} /></div>
                </div>

                {isTextSelected && (
                  <div className="cert-field-row cert-field-row--2">
                    <div className="cert-field-group"><label className="cert-field-label">Overflow</label><select className="cert-input" value={selectedBlock.overflowBehavior} onChange={(e) => updateBlock(selectedBlock.id, { overflowBehavior: e.target.value as CertificateBlock["overflowBehavior"] })}><option value="keep">Clip to box</option><option value="auto_fit">Auto-fit text</option><option value="auto_height">Auto height</option></select></div>
                    <div className="cert-field-group"><label className="cert-field-label">Opacity</label><input className="cert-input" type="number" step="0.05" min={0} max={1} value={selectedBlock.style.opacity} onChange={(e) => updateBlockStyle(selectedBlock.id, { opacity: Math.max(0, Math.min(1, +e.target.value)) })} /></div>
                  </div>
                )}

                {selectedBlock.type === "image" && (
                  <>
                    <div className="cert-field-group">
                      <label className="cert-field-label">Image</label>
                      <div className="cert-img-source">
                        {selectedBlock.assetUrl ? (
                          <div className="cert-img-thumb">
                            <img src={selectedBlock.assetUrl} alt={selectedBlock.name} />
                            <div className="cert-img-thumb-actions">
                              <button className="cert-btn" onClick={() => replaceImageInputRef.current?.click()}>Replace</button>
                              <button className="cert-btn cert-btn--danger" onClick={() => updateBlock(selectedBlock.id, { assetUrl: "" })}>Remove</button>
                            </div>
                          </div>
                        ) : (
                          <button className="cert-bg-dropzone cert-bg-dropzone--sm" onClick={() => replaceImageInputRef.current?.click()}><span>Upload image</span></button>
                        )}
                      </div>
                    </div>
                    <div className="cert-field-row cert-field-row--2">
                      <div className="cert-field-group"><label className="cert-field-label">Fit</label><select className="cert-input" value={selectedBlock.style.objectFit || "contain"} onChange={(e) => updateBlockStyle(selectedBlock.id, { objectFit: e.target.value as BlockStyle["objectFit"] })}><option value="contain">Contain</option><option value="cover">Cover</option><option value="fill">Stretch</option><option value="none">Original</option></select></div>
                      <div className="cert-field-group"><label className="cert-field-label">Opacity</label><input className="cert-input" type="number" step="0.05" min={0} max={1} value={selectedBlock.style.opacity} onChange={(e) => updateBlockStyle(selectedBlock.id, { opacity: Math.max(0, Math.min(1, +e.target.value)) })} /></div>
                    </div>
                    <div className="cert-field-row cert-field-row--2">
                      <div className="cert-field-group"><label className="cert-field-label">Radius</label><input className="cert-input" type="number" min={0} max={400} value={selectedBlock.style.borderRadius} onChange={(e) => updateBlockStyle(selectedBlock.id, { borderRadius: +e.target.value })} /></div>
                      <div className="cert-field-group"><label className="cert-field-label">Border</label><input className="cert-input" type="number" min={0} max={40} value={selectedBlock.style.borderWidth || 0} onChange={(e) => updateBlockStyle(selectedBlock.id, { borderWidth: +e.target.value })} /></div>
                    </div>
                    <div className="cert-field-row cert-field-row--2">
                      <div className="cert-field-group"><label className="cert-field-label">Border color</label><input className="cert-input" type="color" value={selectedBlock.style.borderColor || "#000000"} onChange={(e) => updateBlockStyle(selectedBlock.id, { borderColor: e.target.value })} /></div>
                      <div className="cert-field-group"><label className="cert-field-label">Border style</label><select className="cert-input" value={selectedBlock.style.borderStyle || "none"} onChange={(e) => updateBlockStyle(selectedBlock.id, { borderStyle: e.target.value as BlockStyle["borderStyle"] })}><option value="none">None</option><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></div>
                    </div>
                  </>
                )}

                <div className="cert-field-group">
                  <label className="cert-field-label">Name</label>
                  <input className="cert-input" value={selectedBlock.name} onChange={(e) => updateBlock(selectedBlock.id, { name: e.target.value })} />
                </div>

                <div className="cert-inspector-actions">
                  <button className="cert-btn" onClick={() => { const d = duplicateBlock(selectedBlock); addBlock(d); }}>Duplicate</button>
                  <button className="cert-btn" onClick={() => updateBlock(selectedBlock.id, { locked: !selectedBlock.locked })}>{selectedBlock.locked ? "Unlock" : "Lock"}</button>
                  <button className="cert-btn cert-btn--danger" onClick={() => deleteBlock(selectedBlock.id)}>Delete</button>
                </div>
              </div>
            )}

            {!selectedBlock && (
              <div className="cert-left-hint">
                <p><strong>Click</strong> an element to select &amp; resize it.</p>
                <p><strong>Double-click</strong> text to type directly on the canvas.</p>
                <p><strong>Highlight</strong> words while typing to link them to a field.</p>
                <p><strong>Click empty canvas</strong> to deselect.</p>
              </div>
            )}
          </aside>
        )}

        <div className="cert-canvas-col">
          {currentPage && (
            <CertificateCanvas
              page={currentPage}
              blocks={activeBlocks}
              selectedBlockId={selectedBlockId}
              editingBlockId={editingBlockId}
              zoom={zoom}
              mode={mode}
              fieldValues={fieldValues}
              showMargins={showMargins}
              fields={template.fields}
              onSelectBlock={handleSelect}
              onStartEdit={startEdit}
              onEditCommit={editCommit}
              onUpdateBlock={updateBlock}
              onTransformStart={onTransformStart}
              onZoomChange={setZoom}
            />
          )}

          <div className="cert-page-nav">
            <button disabled={currentPageIdx === 0} onClick={() => { setCurrentPageIdx((i) => i - 1); setSelectedBlockId(null); setEditingBlockId(null); }}>‹</button>
            <span className="cert-page-label">{currentPageIdx + 1} of {template.pages.length} · {currentPage?.name || ""} · {Math.round(currentPage?.width || 0)}×{Math.round(currentPage?.height || 0)}</span>
            <button disabled={currentPageIdx >= template.pages.length - 1} onClick={() => { setCurrentPageIdx((i) => i + 1); setSelectedBlockId(null); setEditingBlockId(null); }}>›</button>
            <button className={`cert-thumb-toggle ${showThumbnails ? "active" : ""}`} onClick={() => setShowThumbnails(!showThumbnails)} title="Thumbnails">⊟</button>
          </div>

          {showThumbnails && (
            <div className="cert-thumbnails">
              {template.pages.map((p, i) => (
                <button key={p.id} className={`cert-thumb ${i === currentPageIdx ? "active" : ""}`} onClick={() => { setCurrentPageIdx(i); setSelectedBlockId(null); setEditingBlockId(null); }}>
                  <div className="cert-thumb-preview"><span>{i + 1}</span></div>
                  <span className="cert-thumb-name">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {rightOpen && (
          <div className="cert-panel">
            <div className="cert-panel-tabs">
              {tabs.map((t) => (
                <button key={t} className={rightTab === t ? "active" : ""} onClick={() => setRightTab(t)}>{tabLabels[t]}</button>
              ))}
              <button className="cert-panel-close" onClick={() => setRightOpen(false)} title="Collapse panel">✕</button>
            </div>

            <div className="cert-panel-body">
              {rightTab === "data" && (
                <div className="cert-data-panel">
                  {mode === "generator" && !record && (
                    <div className="cert-panel-empty">
                      <p>No certificate record yet.</p>
                      <button className="cert-btn cert-btn--primary" onClick={createRecordForTemplate}>Create Record</button>
                    </div>
                  )}
                  {record && (
                    <>
                      <div className="cert-field-section">
                        <h4 className="cert-field-section-title">Author Information</h4>
                        {authorFields.map((f) => (
                          <div key={f.key} className="cert-field-group">
                            <label className="cert-field-label">{f.label}{f.required && <span className="cert-req">*</span>}</label>
                            <input className="cert-input" value={fieldValues[f.key] || ""} onChange={(e) => setFieldValue(f.key, e.target.value)} placeholder={f.placeholder || ""} />
                          </div>
                        ))}
                      </div>
                      <div className="cert-field-section">
                        <h4 className="cert-field-section-title">Publication Information</h4>
                        {pubFields.map((f) => (
                          <div key={f.key} className="cert-field-group">
                            <label className="cert-field-label">{f.label}{f.required && <span className="cert-req">*</span>}</label>
                            <input className="cert-input" value={fieldValues[f.key] || ""} onChange={(e) => setFieldValue(f.key, e.target.value)} placeholder={f.placeholder || ""} />
                          </div>
                        ))}
                      </div>
                      <div className="cert-field-section">
                        <h4 className="cert-field-section-title">Certificate Information</h4>
                        {certFields.map((f) => (
                          <div key={f.key} className="cert-field-group">
                            <label className="cert-field-label">{f.label}{f.required && <span className="cert-req">*</span>}</label>
                            <input className="cert-input" value={fieldValues[f.key] || ""} onChange={(e) => setFieldValue(f.key, e.target.value)} placeholder={f.placeholder || ""} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {rightTab === "fields" && (
                <div className="cert-fields-panel">
                  <input className="cert-input cert-field-search" placeholder="Search fields…" value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} />
                  <p className="cert-field-hint" style={{ marginBottom: ".5rem" }}>Tip: while editing text, highlight a word to link it to any of these fields.</p>
                  <div className="cert-field-list">
                    {template.fields
                      .filter((f) => !fieldSearch || f.label.toLowerCase().includes(fieldSearch.toLowerCase()) || f.key.includes(fieldSearch.toLowerCase()))
                      .map((f) => {
                        const usage = getFieldUsage(template, f.key);
                        const pageNames = usage.pages.map((pid) => template.pages.find((p) => p.id === pid)?.name || "?");
                        return (
                          <div key={f.key} className="cert-field-item">
                            <div className="cert-field-item-head">
                              <strong>{f.label}</strong>
                              <code className="cert-field-key">{`{{${f.key}}}`}</code>
                            </div>
                            <p className="cert-field-usage">Used {usage.count} time{usage.count !== 1 ? "s" : ""} on {pageNames.length ? pageNames.join(", ") : "no pages"}</p>
                            <div className="cert-field-item-actions">
                              <button onClick={() => { const pid = usage.pages[0]; if (pid) { const idx = template.pages.findIndex((p) => p.id === pid); if (idx >= 0) setCurrentPageIdx(idx); } }}>Jump to</button>
                              <button onClick={() => { if (currentPage) addBlock(createLinkedBlock(currentPage.id, f.key, 60, 60)); }}>+ Add to page</button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {rightTab === "layers" && (
                <div className="cert-layers-panel">
                  <h4 className="cert-field-section-title">Layers — {currentPage?.name || ""}</h4>
                  {currentBlocks.length === 0 && <p className="cert-panel-empty-text">No blocks on this page. Use the Add palette on the left.</p>}
                  {[...currentBlocks].sort((a, b) => b.zIndex - a.zIndex).map((b) => (
                    <div key={b.id} className={`cert-layer-item ${b.id === selectedBlockId ? "selected" : ""} ${b.hidden ? "hidden" : ""}`} onClick={() => handleSelect(b.id)}>
                      <span className="cert-layer-icon">{b.type === "text" ? "T" : b.type === "image" ? "🖼" : b.type === "qr" ? "QR" : "□"}</span>
                      <span className="cert-layer-name">{b.name}{b.linkedFieldKey && <code className="cert-layer-linked">{b.linkedFieldKey}</code>}</span>
                      <div className="cert-layer-actions">
                        <button onClick={(e) => { e.stopPropagation(); updateBlock(b.id, { hidden: !b.hidden }); }} title={b.hidden ? "Show" : "Hide"}>{b.hidden ? "◻" : "◼"}</button>
                        <button onClick={(e) => { e.stopPropagation(); updateBlock(b.id, { locked: !b.locked }); }} title={b.locked ? "Unlock" : "Lock"}>{b.locked ? "🔒" : "🔓"}</button>
                        <button onClick={(e) => { e.stopPropagation(); updateBlock(b.id, { zIndex: getMaxZIndex(template.blocks, b.pageId) + 1 }); }} title="Bring to front">↑</button>
                        <button className="cert-btn--danger" onClick={(e) => { e.stopPropagation(); deleteBlock(b.id); }} title="Delete">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {rightTab === "page" && currentPage && (
                <div className="cert-page-panel">
                  <div className="cert-field-group">
                    <label className="cert-field-label">Page Name</label>
                    <input className="cert-input" value={currentPage.name} onChange={(e) => updateTemplate((t) => ({ ...t, pages: t.pages.map((p) => p.id === currentPage.id ? { ...p, name: e.target.value } : p) }))} />
                  </div>
                  <div className="cert-field-section">
                    <h4 className="cert-field-section-title">Canvas Size</h4>
                    <div className="cert-canvas-presets">
                      {CANVAS_PRESETS.map((p) => (
                        <button key={p.label} className={`cert-preset-btn ${Math.round(currentPage.width) === p.width && Math.round(currentPage.height) === p.height ? "active" : ""}`} onClick={() => updateTemplate((t) => ({ ...t, pages: t.pages.map((pg) => pg.id === currentPage.id ? { ...pg, width: p.width, height: p.height } : pg) }))}>{p.label}</button>
                      ))}
                    </div>
                    <div className="cert-field-row">
                      <div className="cert-field-group"><label className="cert-field-label">Width (px)</label><input className="cert-input" type="number" min={100} max={6000} value={Math.round(currentPage.width)} onChange={(e) => updateTemplate((t) => ({ ...t, pages: t.pages.map((p) => p.id === currentPage.id ? { ...p, width: Math.max(100, +e.target.value) } : p) }))} /></div>
                      <div className="cert-field-group"><label className="cert-field-label">Height (px)</label><input className="cert-input" type="number" min={100} max={6000} value={Math.round(currentPage.height)} onChange={(e) => updateTemplate((t) => ({ ...t, pages: t.pages.map((p) => p.id === currentPage.id ? { ...p, height: Math.max(100, +e.target.value) } : p) }))} /></div>
                    </div>
                  </div>
                  <div className="cert-field-group">
                    <label className="cert-field-label">Safe Margin (px)</label>
                    <input className="cert-input" type="number" value={currentPage.safeMargin} onChange={(e) => updateTemplate((t) => ({ ...t, pages: t.pages.map((p) => p.id === currentPage.id ? { ...p, safeMargin: +e.target.value } : p) }))} />
                  </div>
                  <div className="cert-field-section">
                    <h4 className="cert-field-section-title">Background</h4>
                    <div className="cert-bg-upload">
                      {currentPage.backgroundImageUrl ? (
                        <div className="cert-bg-preview">
                          <img src={currentPage.backgroundImageUrl} alt="Background" />
                          <div className="cert-bg-actions">
                            <button className="cert-btn" onClick={() => bgImageInputRef.current?.click()}>Replace</button>
                            <button className="cert-btn cert-btn--danger" onClick={() => updateTemplate((t) => ({ ...t, pages: t.pages.map((p) => p.id === currentPage.id ? { ...p, backgroundImageUrl: undefined } : p) }))}>Remove</button>
                          </div>
                        </div>
                      ) : (
                        <button className="cert-bg-dropzone" onClick={() => bgImageInputRef.current?.click()}>
                          <span className="cert-bg-dropzone-icon">▣</span>
                          <span>Upload background — canvas auto-sizes to fit</span>
                          <span className="cert-bg-dropzone-hint">PNG, JPG, WebP</span>
                        </button>
                      )}
                    </div>
                    <div className="cert-field-group" style={{ marginTop: ".5rem" }}>
                      <label className="cert-field-label">Or paste URL</label>
                      <input className="cert-input" value={currentPage.backgroundImageUrl && !currentPage.backgroundImageUrl.startsWith("data:") ? currentPage.backgroundImageUrl : ""} onChange={(e) => updateTemplate((t) => ({ ...t, pages: t.pages.map((p) => p.id === currentPage.id ? { ...p, backgroundImageUrl: e.target.value || undefined } : p) }))} placeholder="https://…" />
                    </div>
                  </div>
                  <div className="cert-page-actions">
                    <button className="cert-btn" onClick={() => { const idx = template.pages.findIndex((p) => p.id === currentPage.id); const newPage: CertificatePage = { ...currentPage, id: uid(), pageNumber: template.pages.length + 1, name: currentPage.name + " (copy)" }; updateTemplate((t) => ({ ...t, pages: [...t.pages.slice(0, idx + 1), newPage, ...t.pages.slice(idx + 1)] })); }}>Duplicate Page</button>
                    <button className="cert-btn cert-btn--danger" disabled={template.pages.length <= 1} onClick={() => { updateTemplate((t) => ({ ...t, pages: t.pages.filter((p) => p.id !== currentPage.id), blocks: t.blocks.filter((b) => b.pageId !== currentPage.id) })); setCurrentPageIdx((i) => Math.max(0, i - 1)); }}>Delete Page</button>
                  </div>
                </div>
              )}

              {rightTab === "validation" && validation && (
                <div className="cert-validation-panel">
                  <div className="cert-validation-summary">
                    <span className={`cert-val-count ${validation.errors > 0 ? "error" : "ok"}`}>{validation.errors} errors</span>
                    <span className={`cert-val-count ${validation.warnings > 0 ? "warn" : "ok"}`}>{validation.warnings} warnings</span>
                    <span className="cert-val-count ok">{validation.canExport ? "Ready to export" : "Fix errors first"}</span>
                  </div>
                  <div className="cert-validation-list">
                    {validation.checks.map((c) => (
                      <div key={c.id} className={`cert-val-item cert-val-item--${c.status}`}>
                        <span className="cert-val-icon">{c.status === "error" ? "✕" : c.status === "warn" ? "⚠" : "✓"}</span>
                        <div><strong>{c.label}</strong><p>{c.message}</p></div>
                        {c.pageId && <button className="cert-val-jump" onClick={() => { const idx = template.pages.findIndex((p) => p.id === c.pageId); if (idx >= 0) setCurrentPageIdx(idx); if (c.blockId) handleSelect(c.blockId); }}>Go to</button>}
                      </div>
                    ))}
                    {validation.checks.length === 0 && <p className="cert-panel-empty-text">No validation issues found.</p>}
                  </div>
                </div>
              )}

              {rightTab === "export" && (
                <div className="cert-export-panel">
                  <div className="cert-field-section">
                    <h4 className="cert-field-section-title">Export Options</h4>
                    <button className="cert-btn cert-btn--primary cert-btn--full" onClick={exportAllPagesPDF}>Export All Pages as PDF</button>
                    <button className="cert-btn cert-btn--full" onClick={exportCurrentPagePNG}>Export Current Page as PNG</button>
                    <button className="cert-btn cert-btn--full" onClick={exportCurrentPagePDF}>Export Current Page as PDF</button>
                  </div>
                  <div className="cert-field-section">
                    <h4 className="cert-field-section-title">Certificate Status</h4>
                    <div className="cert-status-row">
                      <span>Current: <strong>{record?.status || template.status}</strong></span>
                      {record && record.status === "draft" && (
                        <button className="cert-btn cert-btn--primary" onClick={() => { updateRecord((r) => ({ ...r, status: "issued", issuedAt: new Date().toISOString(), snapshot: { templateName: template.name, fieldValues: { ...r.fieldValues }, certificateNumber: r.certificateNumber, dateIssued: r.fieldValues["date_issued"] || "", issuedBy: "admin" } })); }}>Issue Certificate</button>
                      )}
                    </div>
                  </div>
                  <div className="cert-field-section">
                    <h4 className="cert-field-section-title">Certificate Numbering</h4>
                    <div className="cert-field-row">
                      <div className="cert-field-group"><label className="cert-field-label">Prefix</label><input className="cert-input" value={template.certificateNumberPrefix} onChange={(e) => updateTemplate((t) => ({ ...t, certificateNumberPrefix: e.target.value.toUpperCase() }))} /></div>
                      <div className="cert-field-group"><label className="cert-field-label">Next Sequence</label><input className="cert-input" type="number" value={template.certificateNumberSequence} onChange={(e) => updateTemplate((t) => ({ ...t, certificateNumberSequence: +e.target.value }))} /></div>
                    </div>
                    <p className="cert-field-hint">Next number: {generateCertificateNumber(template.certificateNumberPrefix, template.certificateNumberSequence, template.certificateNumberYear)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(e) => { handleAddImage(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={bgImageInputRef} type="file" accept="image/*" hidden onChange={(e) => { handleSetBackground(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={replaceImageInputRef} type="file" accept="image/*" hidden onChange={(e) => { handleReplaceImage(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
