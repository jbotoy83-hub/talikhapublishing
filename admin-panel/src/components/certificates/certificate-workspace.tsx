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
  getImageDimensions, segmentsToContent, normalizeSegments,
  resolveAllBlocks,
} from "./field-engine";
import { CertificateCanvas } from "./certificate-canvas";
import { Trash2 } from "@/components/icons";

interface WorkspaceProps {
  submissions?: Array<{ id: string; reference?: string; title?: string; author?: string }>;
}

type ImportCandidate = { publicationId: string; submissionId: string; title: string; journal: string; volume: string; issue: string; authorCount: number; ready: boolean; missing: string[] };
type ServerRecord = { id: string; template_id: string; publication_id?: string; author_id?: string; submission_id?: string; status: CertificateRecord["status"]; field_values: Record<string, string>; certificate_number: string; created_at: string; updated_at: string };

function mapServerRecord(record: ServerRecord): CertificateRecord {
  return { id: record.id, templateId: record.template_id, templateVersion: 1, publicationId: record.publication_id, authorId: record.author_id, submissionId: record.submission_id, fieldValues: record.field_values || {}, status: record.status, certificateNumber: record.certificate_number, createdAt: record.created_at, updatedAt: record.updated_at };
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeName(value: string) {
  return (value || "certificate").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "certificate";
}

export function CertificateWorkspace({ submissions = [] }: WorkspaceProps) {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [records, setRecords] = useState<CertificateRecord[]>([]);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [importSearch, setImportSearch] = useState("");
  const [importState, setImportState] = useState<"idle" | "loading" | "importing" | "error">("idle");
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({ publisher_name: "Talikha Publishing", issuing_city: "Butuan City" });
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
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplatePub, setNewTemplatePub] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [cropDraft, setCropDraft] = useState<{ blockId: string; url: string; x: number; y: number; zoom: number } | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [convertSearch, setConvertSearch] = useState("");
  const [editorHasSelection, setEditorHasSelection] = useState(false);
  const [leftToolOpen, setLeftToolOpen] = useState({ fields: false, layers: false, validation: false });
  const [dataOpen, setDataOpen] = useState({ author: true, publication: true, certificate: true });
  const [serviceState, setServiceState] = useState<"loading" | "ready" | "forbidden" | "unavailable">("loading");
  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number; status: "uploading" | "done" | "error" } | null>(null);
  const [compressOn, setCompressOn] = useState(true);
  const [compressQuality, setCompressQuality] = useState(82);
  const [pdfEstimate, setPdfEstimate] = useState<string>("");
  const [estimating, setEstimating] = useState(false);
  const estimateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchSubmissionId = useMemo(() => new URLSearchParams(window.location.search).get("certificateSubmission") || "", []);
  const [launchState, setLaunchState] = useState<"idle" | "loading" | "error">(launchSubmissionId ? "loading" : "idle");
  const lastUndoRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const bgImageInputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef<string | null>(null);
  const prevEditingRef = useRef<string | null>(null);
  const templateRef = useRef<CertificateTemplate | null>(null);
  const currentPageIdxRef = useRef(currentPageIdx);
  const cropPointerRef = useRef<{ x: number; y: number; cropX: number; cropY: number; width: number; height: number } | null>(null);
  const fieldInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const recordsRef = useRef<CertificateRecord[]>(records);
  recordsRef.current = records;
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentPayloadRef = useRef<string | null>(null);
  const lastSentFvRef = useRef<string | null>(null);
  const lastSentRecIdRef = useRef<string | null>(null);
  const runSaveRef = useRef<() => void>(() => {});
  const [saveRevision, setSaveRevision] = useState(0);

  useEffect(() => {
    lastSentPayloadRef.current = null;
    lastSentFvRef.current = null;
    lastSentRecIdRef.current = null;
  }, [activeTemplateId, activeRecordId]);

  useEffect(() => {
    const handler = (e: Event) => { setEditorHasSelection((e as CustomEvent<{ hasSelection: boolean }>).detail?.hasSelection ?? false); };
    window.addEventListener("cert-selection-changed", handler);
    return () => window.removeEventListener("cert-selection-changed", handler);
  }, []);

  const template = templates.find((t) => t.id === activeTemplateId) || null;
  const record = records.find((r) => r.id === activeRecordId) || null;
  const currentPage = (template?.pages || [])[currentPageIdx] || null;
  const activeBlocks = template?.blocks || [];
  const currentBlocks = activeBlocks.filter((b) => b.pageId === currentPage?.id);
  const fieldValues = useMemo(() => record?.fieldValues || previewValues, [record, previewValues]);
  const selectedBlock = activeBlocks.find((b) => b.id === selectedBlockId) || null;
  templateRef.current = template;
  editingRef.current = editingBlockId;
  currentPageIdxRef.current = currentPageIdx;

  const handleApiState = useCallback((response: Response) => {
    if (response.status === 401) {
      window.location.assign(`/admin/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
      return false;
    }
    if (response.status === 403) { setServiceState("forbidden"); return false; }
    if (response.status === 503) { setServiceState("unavailable"); return false; }
    return response.ok;
  }, []);

  const loadFromServer = useCallback(async () => {
    setServiceState("loading");
    try {
      const response = await fetch("/api/admin/certificates", { credentials: "same-origin" });
      if (!handleApiState(response)) return;
      const payload = await response.json();
      const items: Array<Record<string, unknown>> = payload.templates || [];
      const summaries: CertificateTemplate[] = items.map((item) => ({
        id: String(item.id || ""), name: String(item.name || "Certificate template"), version: Number(item.version || 1), status: (item.status || "draft") as CertificateTemplate["status"], updatedAt: String(item.updatedAt || new Date().toISOString()),
        pages: [], fields: [], blocks: [], publication: "", createdAt: "", certificateNumberPrefix: "TP-CERT", certificateNumberSequence: 0, certificateNumberYear: new Date().getFullYear(),
      }));
      if (items[0]?.id) {
        const detailResponse = await fetch(`/api/admin/certificates/${items[0].id}`, { credentials: "same-origin" });
        if (!handleApiState(detailResponse)) return;
        const detail = (await detailResponse.json()).template as CertificateTemplate;
        setTemplates(summaries.map((item) => item.id === detail.id ? { ...item, ...detail } : item));
        setActiveTemplateId(detail.id);
      } else setTemplates(summaries);
      setServiceState("ready");
    } catch { setServiceState("unavailable"); }
  }, [handleApiState]);

  useEffect(() => { void loadFromServer(); }, [loadFromServer]);

  const loadRecords = useCallback(async (templateId: string) => {
    try {
      const response = await fetch(`/api/admin/certificates/records?templateId=${encodeURIComponent(templateId)}`, { credentials: "same-origin" });
      if (!handleApiState(response)) return;
      const payload = await response.json();
      const loaded: CertificateRecord[] = (payload.records || []).map((row: ServerRecord) => mapServerRecord(row));
      setRecords(loaded);
      if (!launchSubmissionId) {
        try {
          const saved = JSON.parse(localStorage.getItem(`cert-ws-${templateId}`) || "{}") as { recordId?: string; mode?: WorkspaceMode };
          if (saved.recordId && loaded.some((r) => r.id === saved.recordId)) setActiveRecordId(saved.recordId);
          if (saved.mode === "builder" || saved.mode === "generator") setMode(saved.mode);
        } catch { /* ignore malformed storage */ }
      }
    } catch { setServiceState("unavailable"); }
  }, [handleApiState, launchSubmissionId]);

  useEffect(() => { if (activeTemplateId) void loadRecords(activeTemplateId); }, [activeTemplateId, loadRecords]);

  useEffect(() => {
    if (!activeTemplateId) return;
    try { localStorage.setItem(`cert-ws-${activeTemplateId}`, JSON.stringify({ recordId: activeRecordId, mode })); } catch { /* storage unavailable */ }
  }, [activeTemplateId, activeRecordId, mode]);

  useEffect(() => {
    if (!launchSubmissionId || !activeTemplateId || activeRecordId) return;
    void (async () => {
      setLaunchState("loading");
      try {
        const response = await fetch("/api/admin/certificates/from-submission", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: launchSubmissionId }) });
        if (!handleApiState(response)) { setLaunchState("error"); return; }
        const payload = await response.json();
        const imported = (payload.records || []).map((row: ServerRecord) => mapServerRecord(row));
        setRecords((current) => [...current.filter((item) => !imported.some((next: CertificateRecord) => next.id === item.id)), ...imported]);
        if (payload.templateId) setActiveTemplateId(payload.templateId);
        if (imported[0]) { setActiveRecordId(imported[0].id); setMode("generator"); setRightTab("data"); }
        setLaunchState("idle");
      } catch { setLaunchState("error"); }
    })();
  }, [launchSubmissionId, activeTemplateId, activeRecordId, handleApiState]);

  const loadImportCandidates = useCallback(async () => {
    setImportState("loading");
    try {
      const response = await fetch("/api/admin/certificates/imports", { credentials: "same-origin" });
      if (!handleApiState(response)) return;
      const payload = await response.json();
      setImportCandidates(payload.candidates || []); setImportState("idle");
    } catch { setImportState("error"); }
  }, [handleApiState]);

  useEffect(() => {
    if (!activeTemplateId || template?.pages.length) return;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/certificates/${activeTemplateId}`, { credentials: "same-origin" });
        if (!handleApiState(response)) return;
        const payload = await response.json();
        const next = payload.template as CertificateTemplate;
        setTemplates((previous) => previous.map((item) => item.id === next.id ? { ...item, ...next } : item));
      } catch { setServiceState("unavailable"); }
    })();
  }, [activeTemplateId, handleApiState, template?.pages.length]);

  useEffect(() => {
    const faces = template?.fonts || [];
    if (!faces.length) return;
    const style = document.createElement("style");
    style.dataset.certificateFonts = "true";
    style.textContent = faces.map((font) => `@font-face{font-family:"${font.family}";font-style:${font.style};font-weight:${font.weight};font-display:swap;src:url("${font.url}") format("${font.url.includes(".otf") ? "opentype" : "truetype"}");}`).join("\n");
    document.head.appendChild(style);
    return () => style.remove();
  }, [template?.fonts]);

  useEffect(() => {
    if (!template?.fields.length) return;
    setPreviewValues((current) => {
      const next = { ...current };
      template.fields.forEach((field) => { if (next[field.key] === undefined) next[field.key] = field.defaultValue || ""; });
      return next;
    });
  }, [template?.id, template?.fields]);

  const buildTemplatePayload = (active: CertificateTemplate) => ({
    name: active.name,
    pages: active.pages.map((page) => ({ id: page.id, width: page.width, height: page.height })),
    blocks: active.blocks.map((block) => ({ id: block.id.startsWith("cb-") ? undefined : block.id, pageId: block.pageId, type: block.type === "image" ? "image" : "text", content: block.segments ? { type: "rich_text", segments: block.segments } : block.content, x: block.x, y: block.y, width: block.width, height: block.height, rotation: block.rotation, zIndex: block.zIndex, style: block.style, overflowBehavior: block.overflowBehavior === "keep" ? "manual" : block.overflowBehavior, locked: block.locked, assetBucket: block.assetBucket || null, assetPath: block.assetPath || null })),
  });

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
    setSaveRevision((n) => n + 1);
    setSaveState("saved");
  }, [pushUndo]);

  const updateRecord = useCallback((updater: (r: CertificateRecord) => CertificateRecord) => {
    if (!record) return;
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...updater(r), updatedAt: new Date().toISOString() } : r));
    setDirty(true);
    setSaveRevision((n) => n + 1);
  }, [record]);

  const setFieldValue = useCallback((key: string, value: string) => {
    if (record) updateRecord((r) => ({ ...r, fieldValues: { ...r.fieldValues, [key]: value } }));
    else setPreviewValues((values) => ({ ...values, [key]: value }));
  }, [updateRecord]);

  const focusFieldOnCanvas = (key: string) => {
    if (!template) return;
    const matches = (b: CertificateBlock) => b.linkedFieldKey === key || !!b.segments?.some((s) => s.t === "f" && s.k === key);
    const block = template.blocks.find((b) => b.pageId === currentPage?.id && matches(b)) || template.blocks.find(matches);
    if (!block) return;
    const idx = template.pages.findIndex((p) => p.id === block.pageId);
    if (idx >= 0 && idx !== currentPageIdx) setCurrentPageIdx(idx);
    setSelectedBlockId(block.id);
    setEditingBlockId(null);
    window.setTimeout(() => {
      const el = document.querySelector(`.cert-canvas-page [data-block-id="${block.id}"]`);
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, 80);
  };

  const importManuscript = useCallback(async (publicationId: string) => {
    if (!template) return;
    setImportState("importing");
    try {
      const response = await fetch("/api/admin/certificates/records", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: template.id, publicationId }) });
      if (!handleApiState(response)) return;
      const payload = await response.json();
      const imported = (payload.records || []).map((row: ServerRecord) => mapServerRecord(row));
      setRecords((current) => [...current.filter((item) => !imported.some((next: CertificateRecord) => next.id === item.id)), ...imported]);
      if (imported[0]) setActiveRecordId(imported[0].id);
      setImportState("idle");
    } catch { setImportState("error"); }
  }, [template, handleApiState]);

  const saveRecord = useCallback(async () => {
    const rec = recordsRef.current.find((item) => item.id === activeRecordId) || null;
    if (!rec || rec.id.startsWith("cb-")) return true;
    const fieldValues = { ...rec.fieldValues } as Record<string, unknown>;
    delete fieldValues._import_warnings;
    const response = await fetch(`/api/admin/certificates/records/${rec.id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fieldValues }) });
    if (!handleApiState(response)) return false;
    const payload = await response.json();
    const saved = mapServerRecord(payload.record);
    lastSentFvRef.current = JSON.stringify(fieldValues);
    lastSentRecIdRef.current = rec.id;
    setRecords((current) => current.map((item) => item.id === rec.id ? { ...item, fieldValues: saved.fieldValues, updatedAt: saved.updatedAt, status: saved.status, certificateNumber: saved.certificateNumber, issuedAt: saved.issuedAt ?? item.issuedAt } : item));
    return true;
  }, [activeRecordId, handleApiState]);

  const refreshRecord = useCallback(async () => {
    if (!record) return;
    try {
      const response = await fetch(`/api/admin/certificates/records/${record.id}`, { method: "POST", credentials: "same-origin" });
      if (!handleApiState(response)) return;
      const payload = await response.json(); const refreshed = mapServerRecord(payload.record);
      setRecords((current) => current.map((item) => item.id === refreshed.id ? refreshed : item));
    } catch { setServiceState("unavailable"); }
  }, [record, handleApiState]);

  const recordFieldValuesString = (rec: CertificateRecord | null) => {
    if (!rec) return null;
    const fv = { ...rec.fieldValues } as Record<string, unknown>;
    delete fv._import_warnings;
    return JSON.stringify(fv);
  };

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { autosaveTimerRef.current = null; runSaveRef.current(); }, 1200);
  }, []);

  const runSave = useCallback(async () => {
    const active = templateRef.current;
    if (!active || !active.pages.length) return;
    const rec = recordsRef.current.find((item) => item.id === activeRecordId) || null;
    const payload = buildTemplatePayload(active);
    const payloadStr = JSON.stringify(payload);
    const fvStr = recordFieldValuesString(rec);
    const needPut = payloadStr !== lastSentPayloadRef.current;
    const needPatch = !!rec && !rec.id.startsWith("cb-") && fvStr !== lastSentFvRef.current;
    if (!needPut && !needPatch) { setDirty(false); setSaveState("saved"); return; }
    if (saveInFlightRef.current) { saveQueuedRef.current = true; return; }
    saveInFlightRef.current = true;
    setSaveState("saving");
    let ok = true;
    try {
      if (needPut) {
        const response = await fetch(`/api/admin/certificates/${active.id}`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: payloadStr });
        if (!handleApiState(response)) ok = false;
      }
      if (ok && needPatch) {
        const saved = await saveRecord();
        if (!saved) ok = false;
      }
      if (ok) {
        if (needPut) lastSentPayloadRef.current = payloadStr;
        const nowActive = templateRef.current;
        const nowRec = recordsRef.current.find((item) => item.id === activeRecordId) || null;
        const stillDirty = (nowActive ? JSON.stringify(buildTemplatePayload(nowActive)) !== lastSentPayloadRef.current : false)
          || (!!nowRec && !nowRec.id.startsWith("cb-") && recordFieldValuesString(nowRec) !== lastSentFvRef.current);
        setDirty(stillDirty);
        setSaveState("saved");
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    } finally {
      saveInFlightRef.current = false;
      if (saveQueuedRef.current) { saveQueuedRef.current = false; runSaveRef.current(); }
    }
  }, [activeRecordId, handleApiState, saveRecord]);

  runSaveRef.current = runSave;

  const manualSave = useCallback(() => {
    if (autosaveTimerRef.current) { clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; }
    runSaveRef.current();
  }, []);

  useEffect(() => {
    if (!dirty || serviceState !== "ready" || saveState !== "saved") return;
    scheduleAutosave();
    return () => { if (autosaveTimerRef.current) { clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; } };
  }, [dirty, saveRevision, serviceState, saveState, scheduleAutosave]);

  useEffect(() => () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); }, []);

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
    if (mode === "generator") { setRightOpen(true); setRightTab("data"); return; }
    if (selectedBlockId) setRightOpen(true);
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

  const createTemplate = async () => {
    try {
      const response = await fetch("/api/admin/certificates", { method: "POST", credentials: "same-origin" });
      if (!handleApiState(response)) return;
      const payload = await response.json(); const next = payload.template as CertificateTemplate;
      setTemplates((items) => [...items, next]); setActiveTemplateId(next.id); setNewTemplateName(""); setNewTemplatePub(""); setShowCreateForm(false);
    } catch { setServiceState("unavailable"); }
  };

  const createRecordForTemplate = () => {
    if (!template) return;
    const r = createDefaultRecord(template);
    const next = [...records, r];
    setRecords(next); setDirty(true);
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
    setDirty(true);
    if (activeRecordId === id) setActiveRecordId(null);
    showToast("Certificate record deleted", () => {
      setRecords(before);
      setDirty(true);
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
    setDirty(true);
    if (activeTemplateId === id) {
      setActiveTemplateId(null);
      setSelectedBlockId(null);
      setEditingBlockId(null);
    }
    showToast('Template "' + target.name + '" deleted', () => { setTemplates(before); setDirty(true); });
  };

  const ensureRecordBlocks = useCallback(() => {
    if (!record || !template) return;
    if (record.blocks) return;
    // Preserve tokens in record overrides. They must resolve from the record's
    // current values until official issuance freezes the PDF snapshot.
    const copied = template.blocks.map((block) => ({
      ...block,
      segments: block.segments?.map((segment) => segment.t === "s" ? { ...segment, style: segment.style ? { ...segment.style } : undefined } : { ...segment }),
    }));
    const next = records.map((r) => r.id === record.id ? { ...r, blocks: copied, updatedAt: new Date().toISOString() } : r);
    setRecords(next);
    setDirty(true);
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
    setDirty(true);
    setSaveRevision((n) => n + 1);
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

  useEffect(() => {
    const handler = (event: Event) => {
      const delta = (event as CustomEvent<{ delta?: number }>).detail?.delta;
      if (!delta || !selectedBlock || selectedBlock.type !== "text") return;
      // A complete paragraph selection is a block-level decision: remove any
      // old per-run size overrides so literal text and linked-field chips use
      // exactly the same inherited font size.
      const segments = selectedBlock.segments?.map((segment) => {
        if (segment.t !== "s" || !segment.style?.fontSize) return segment;
        const { fontSize: _fontSize, ...style } = segment.style;
        return { ...segment, style: Object.keys(style).length ? style : undefined };
      });
      updateBlock(selectedBlock.id, {
        style: { ...selectedBlock.style, fontSize: Math.max(1, selectedBlock.style.fontSize + delta) },
        ...(segments ? { segments } : {}),
      });
    };
    window.addEventListener("cert-change-block-font-size", handler);
    return () => window.removeEventListener("cert-change-block-font-size", handler);
  }, [selectedBlock, updateBlock]);

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
    try {
      const form = new FormData(); form.set("image", file);
      const response = await fetch(`/api/admin/certificates/${template?.id}/background/${currentPage.id}`, { method: "POST", credentials: "same-origin", body: form });
      if (!handleApiState(response)) return;
      const payload = await response.json();
      setTemplates((items) => items.map((item) => item.id === payload.template.id ? { ...item, ...payload.template } : item));
      setDirty(false);
    } catch { setServiceState("unavailable"); }
  };

  const uploadImageAsset = (file: File) => {
    if (!template) return Promise.reject(new Error("No template is open."));
    setUploadProgress({ name: file.name, pct: 0, status: "uploading" });
    return new Promise<{ url: string; bucket: string; path: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/admin/certificates/${template.id}/assets`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress({ name: file.name, pct: Math.round((e.loaded / e.total) * 100), status: "uploading" }); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress({ name: file.name, pct: 100, status: "done" });
          setTimeout(() => setUploadProgress(null), 1800);
          resolve(JSON.parse(xhr.responseText));
        } else {
          setUploadProgress({ name: file.name, pct: 0, status: "error" });
          setTimeout(() => setUploadProgress(null), 3000);
          reject(new Error("Image upload was not accepted."));
        }
      };
      xhr.onerror = () => { setUploadProgress({ name: file.name, pct: 0, status: "error" }); setTimeout(() => setUploadProgress(null), 3000); reject(new Error("Network error during upload.")); };
      const form = new FormData(); form.set("image", file);
      xhr.send(form);
    });
  };

  const handleAddImage = async (file: File | undefined) => {
    if (!file || !currentPage) return;
    if (!file.type.startsWith("image/")) return;
    const dims = await getImageDimensions(URL.createObjectURL(file));
    let w = dims.width; let h = dims.height;
    const maxW = currentPage.width * 0.9; const maxH = currentPage.height * 0.9;
    if (w > maxW || h > maxH) { const s = Math.min(maxW / w, maxH / h); w = Math.round(w * s); h = Math.round(h * s); }
    const asset = await uploadImageAsset(file);
    const block = createImageBlock(currentPage.id, Math.round((currentPage.width - w) / 2), Math.round((currentPage.height - h) / 2), asset.url, w, h);
    block.assetBucket = asset.bucket; block.assetPath = asset.path; block.style.objectFit = "cover";
    block.name = file.name.replace(/\.[^.]+$/, "");
    addBlock(block);
  };

  const handleReplaceImage = async (file: File | undefined) => {
    if (!file || !selectedBlock) return;
    if (!file.type.startsWith("image/")) return;
    try { const asset = await uploadImageAsset(file); updateBlock(selectedBlock.id, { assetUrl: asset.url, assetBucket: asset.bucket, assetPath: asset.path, name: file.name.replace(/\.[^.]+$/, "") }); } catch { setServiceState("unavailable"); }
  };

  const addQuickBlock = (kind: "author" | "title" | "citation" | "date" | "portrait") => {
    if (!currentPage) return;
    if (kind === "portrait") {
      imageInputRef.current?.click();
      return;
    }
    const field = kind === "author" ? "author_name" : kind === "title" ? "work_title" : kind === "date" ? "date_issued" : "doi";
    const block = createLinkedBlock(currentPage.id, field, 60, 60);
    if (kind === "author") Object.assign(block, { name: "Author name", width: Math.min(420, currentPage.width - 120), style: { ...block.style, fontSize: 24, fontWeight: 700, textAlign: "center" } });
    if (kind === "title") Object.assign(block, { name: "Manuscript title", width: Math.min(620, currentPage.width - 120), height: 110, style: { ...block.style, fontSize: 18, fontWeight: 700, textAlign: "center", lineHeight: 1.3 } });
    if (kind === "date") Object.assign(block, { name: "Issue date", style: { ...block.style, fontSize: 14 } });
    if (kind === "citation") {
      block.name = "DOI";
      block.segments = [{ t: "s", v: "DOI " }, { t: "f", k: "doi" }];
      block.content = "DOI ";
      block.width = Math.min(480, currentPage.width - 120);
    }
    addBlock(block);
  };

  const copySelectedToOtherPages = () => {
    if (!selectedBlock || !currentPage || !template || mode !== "builder") return;
    const copies = template.pages.filter((page) => page.id !== currentPage.id).map((page) => ({
      ...duplicateBlock(selectedBlock),
      pageId: page.id,
      x: Math.round((selectedBlock.x / currentPage.width) * page.width),
      y: Math.round((selectedBlock.y / currentPage.height) * page.height),
      width: Math.min(page.width - 20, Math.round((selectedBlock.width / currentPage.width) * page.width)),
      height: Math.min(page.height - 20, Math.round((selectedBlock.height / currentPage.height) * page.height)),
      zIndex: getMaxZIndex(template.blocks, page.id) + 1,
    }));
    updateTemplate((t) => ({ ...t, blocks: [...t.blocks, ...copies] }));
    showToast(`Copied “${selectedBlock.name}” to ${copies.length} other pages`, () => updateTemplate((t) => ({ ...t, blocks: t.blocks.filter((block) => !copies.some((copy) => copy.id === block.id)) })));
  };

  const manuscriptTitle = safeName(fieldValues.work_title || template?.name || "certificate");
  const pdfBaseName = `Copy of Certificate _ ${manuscriptTitle}`;
  const socialBaseName = `Social Media _ ${manuscriptTitle}`;

  const capturePage = useCallback(async (index: number) => {
    setCurrentPageIdx(index); setSelectedBlockId(null); setEditingBlockId(null);
    await new Promise((resolve) => setTimeout(resolve, 130));
    const pageEl = document.querySelector(".cert-canvas-page") as HTMLElement | null;
    if (!pageEl) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  }, []);

  const pageImage = useCallback((canvas: HTMLCanvasElement, index: number) => {
    if (!compressOn) return { data: canvas.toDataURL("image/png"), format: "PNG" as const };
    const quality = index === 5 ? 0.95 : compressQuality / 100;
    return { data: canvas.toDataURL("image/jpeg", quality), format: "JPEG" as const };
  }, [compressOn, compressQuality]);

  const estimatePdfSize = useCallback(async (quality: number) => {
    if (!template) return;
    setEstimating(true);
    const originalPage = currentPageIdxRef.current;
    try {
      const sample = await capturePage(0);
      if (!sample) { setPdfEstimate(""); return; }
      const base64 = sample.toDataURL("image/jpeg", quality / 100);
      const sampleBytes = base64.length * 0.75;
      const estimated = sampleBytes * template.pages.length * 1.04;
      setPdfEstimate(formatBytes(estimated));
    } catch { setPdfEstimate(""); }
    finally { setCurrentPageIdx(originalPage); setEstimating(false); }
  }, [template, capturePage]);

  useEffect(() => {
    if (rightTab !== "export" || !template || !compressOn) { setPdfEstimate(""); return; }
    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    estimateTimerRef.current = setTimeout(() => { void estimatePdfSize(compressQuality); }, 400);
    return () => { if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current); };
  }, [rightTab, compressOn, compressQuality, template, estimatePdfSize]);

  const exportCurrentPagePNG = useCallback(async () => {
    const canvas = await capturePage(currentPageIdx);
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${pdfBaseName}_page${currentPageIdx + 1}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [capturePage, currentPageIdx, pdfBaseName]);

  const exportCurrentPagePDF = useCallback(async () => {
    if (!currentPage) return;
    const canvas = await capturePage(currentPageIdx);
    if (!canvas) return;
    const jsPDF = (await import("jspdf")).default;
    const pw = currentPage.width; const ph = currentPage.height;
    const pdf = new jsPDF({ orientation: pw > ph ? "landscape" : "portrait", unit: "px", format: [pw, ph], hotfixes: ["px_scaling"] });
    const img = pageImage(canvas, currentPageIdx);
    pdf.addImage(img.data, img.format, 0, 0, pw, ph);
    pdf.save(`${pdfBaseName}_page${currentPageIdx + 1}.pdf`);
  }, [capturePage, currentPage, currentPageIdx, pageImage, pdfBaseName]);

  const exportAllPagesPDF = useCallback(async () => {
    if (!template) return;
    const jsPDF = (await import("jspdf")).default;
    const firstPage = template.pages[0];
    const pdf = new jsPDF({ orientation: firstPage.width > firstPage.height ? "landscape" : "portrait", unit: "px", format: [firstPage.width, firstPage.height], hotfixes: ["px_scaling"] });
    const originalPage = currentPageIdx;
    for (let index = 0; index < template.pages.length; index++) {
      const canvas = await capturePage(index);
      if (!canvas) continue;
      const page = template.pages[index];
      if (index > 0) pdf.addPage([page.width, page.height], page.width > page.height ? "landscape" : "portrait");
      const img = pageImage(canvas, index);
      pdf.addImage(img.data, img.format, 0, 0, page.width, page.height);
    }
    setCurrentPageIdx(originalPage);
    pdf.save(`${pdfBaseName}.pdf`);
  }, [template, currentPageIdx, capturePage, pageImage, pdfBaseName]);

  const downloadCertificatePackage = useCallback(async () => {
    if (!template) return;
    const jsPDF = (await import("jspdf")).default;
    const originalPage = currentPageIdx;
    const first = template.pages[0];
    const pdf = new jsPDF({ orientation: first.width > first.height ? "landscape" : "portrait", unit: "px", format: [first.width, first.height], hotfixes: ["px_scaling"] });
    for (let index = 0; index < 5; index++) {
      const canvas = await capturePage(index);
      if (!canvas) continue;
      const page = template.pages[index];
      if (index > 0) pdf.addPage([page.width, page.height], page.width > page.height ? "landscape" : "portrait");
      const img = pageImage(canvas, index);
      pdf.addImage(img.data, img.format, 0, 0, page.width, page.height);
    }
    pdf.save(`${pdfBaseName}.pdf`);
    const pageSix = await capturePage(5);
    if (pageSix) {
      const link = document.createElement("a");
      link.download = `${socialBaseName}.jpg`;
      link.href = pageSix.toDataURL("image/jpeg", 0.95);
      link.click();
    }
    setCurrentPageIdx(originalPage);
  }, [template, currentPageIdx, capturePage, pageImage, pdfBaseName, socialBaseName]);

  const issueAndAttachCertificate = useCallback(async () => {
    if (!record || !template || !currentPage) return;
    if (!window.confirm("Issue this certificate, attach its official PDF and preview image to the manuscript record, then return to the publication record?")) return;
    try {
      const saved = await saveRecord();
      if (!saved) return;
      const pageEl = document.querySelector(".cert-canvas-page") as HTMLElement | null;
      const form = new FormData();
      if (pageEl) {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        const preview = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (preview) form.set("preview", new File([preview], `${template.name || "certificate"}-preview.png`, { type: "image/png" }));
      }
      const response = await fetch(`/api/admin/certificates/records/${record.id}/issue`, { method: "POST", credentials: "same-origin", body: form });
      if (!handleApiState(response)) return;
      const payload = await response.json();
      setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status: "issued", issuedAt: new Date().toISOString() } : item));
      if (payload.submissionId) {
        setToast({ msg: "Certificate attached to the publication record.", undo: () => undefined });
        window.setTimeout(() => window.location.assign(`/admin?view=submissions&submission=${encodeURIComponent(payload.submissionId)}`), 650);
      }
    } catch { setServiceState("unavailable"); }
  }, [record, template, currentPage, saveRecord, handleApiState]);

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
          {serviceState === "loading" && <div className="cert-empty-state"><p>Loading certificate workspace…</p></div>}
          {serviceState === "forbidden" && <div className="cert-empty-state"><p>You do not have permission to edit certificates.</p></div>}
          {serviceState === "unavailable" && <div className="cert-empty-state"><p>The certificate service is temporarily unavailable.</p><button className="cert-btn" onClick={() => void loadFromServer()}>Retry</button></div>}
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

  const tabs: RightTab[] = ["data", "page", "export"];
  const tabLabels: Record<RightTab, string> = { data: "Data", fields: "Linked Fields", layers: "Layers", page: "Page", validation: "Validation", export: "Export" };
  const FIELD_LABEL_OVERRIDES: Record<string, string> = { work_title: "Manuscript Title" };
  const fieldOrder = ["author_name", "author_academic_title", "author_role", "author_affiliation", "work_title", "doi", "publication_name", "volume_number", "issue_number", "issue_date", "issn_online", "issn_print", "certificate_number", "date_issued", "issuing_city", "publisher_name"];
  const orderedFields = (section: "author" | "publication" | "certificate") => (template.fields || [])
    .filter((field) => field.section === section && fieldOrder.includes(field.key))
    .sort((a, b) => fieldOrder.indexOf(a.key) - fieldOrder.indexOf(b.key))
    .map((field) => FIELD_LABEL_OVERRIDES[field.key] ? { ...field, label: FIELD_LABEL_OVERRIDES[field.key] } : field);
  const authorFields = orderedFields("author");
  const pubFields = orderedFields("publication");
  const certFields = orderedFields("certificate");
  const visibleFieldKeys = [
    ...(dataOpen.author ? authorFields : []),
    ...(dataOpen.publication ? pubFields : []),
    ...(dataOpen.certificate ? certFields : []),
  ].map((f) => f.key);
  const onFieldKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key !== "Tab") return;
    const i = visibleFieldKeys.indexOf(key);
    if (i < 0) return;
    const next = e.shiftKey ? i - 1 : i + 1;
    if (next < 0 || next >= visibleFieldKeys.length) return;
    e.preventDefault();
    const nk = visibleFieldKeys[next];
    fieldInputRefs.current[nk]?.focus();
    focusFieldOnCanvas(nk);
  };
  const selectedPublicationRecords = record ? records.filter((item) => item.publicationId === record.publicationId) : [];
  const visibleCandidates = importCandidates.filter((candidate) => `${candidate.title} ${candidate.journal}`.toLowerCase().includes(importSearch.toLowerCase()));

  const isTextSelected = selectedBlock?.type === "text";

  const hasEditorSel = (): boolean => {
    if (!editingBlockId) return false;
    const sel = window.getSelection();
    const editor = document.querySelector(".cert-inline-editor");
    return !!(sel && !sel.isCollapsed && editor && editor.contains(sel.anchorNode));
  };
  const dispatchFmt = (style: Partial<BlockStyle>, toggleProp?: string, fontSizeDelta?: number) => {
    window.dispatchEvent(new CustomEvent("cert-apply-format", { detail: { style, toggleProp, fontSizeDelta } }));
  };
  const adjustFontSize = (delta: number) => {
    if (!selectedBlock) return;
    if (hasEditorSel()) { dispatchFmt({}, undefined, delta); return; }
    updateBlockStyle(selectedBlock.id, { fontSize: Math.max(1, selectedBlock.style.fontSize + delta) });
  };
  const clearAllFormatting = () => {
    if (!selectedBlock || selectedBlock.type !== "text") return;
    const segments = selectedBlock.segments?.map((segment) => segment.t === "s" ? { ...segment, style: undefined } : segment);
    updateBlock(selectedBlock.id, {
      style: { ...selectedBlock.style, fontFamily: "Glacial Indifference", fontSize: 12, fontWeight: 400, fontStyle: "normal", textDecoration: "none", textTransform: "none", letterSpacing: 0, lineHeight: 1.5, backgroundColor: "transparent", color: "#152b21" },
      ...(segments ? { segments } : {}),
    });
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
            <span className={`cert-saved-indicator ${saveState === "error" ? "error" : saveState === "saving" ? "saving" : dirty ? "unsaved" : "saved"}`}>{saveState === "error" ? "Save failed — retry" : saveState === "saving" ? "Saving in background…" : dirty ? "Editing · autosaves" : "Saved ✓"}</span>
          </div>
        </div>
        <div className="cert-header-center"><div className="cert-mode-toggle"><button className={mode === "builder" ? "active" : ""} onClick={() => { setMode("builder"); }} title="Lay out the certificate — drag, resize, and style elements">Design</button><button className={mode === "generator" ? "active" : ""} onClick={() => { setMode("generator"); setRightTab("data"); setSelectedBlockId(null); setEditingBlockId(null); }} title="Preview and fill the certificate with real data">Fill</button></div></div>
        <div className="cert-header-right">
          {mode === "builder" && (
            <>
              <button className="cert-btn cert-btn--ghost" onClick={undo} disabled={!undoStack.length} title="Undo (Ctrl+Z)">↩</button>
              <button className="cert-btn cert-btn--ghost" onClick={redo} disabled={!redoStack.length} title="Redo (Ctrl+Y)">↪</button>
              <button className={`cert-btn cert-btn--ghost ${showMargins ? "active" : ""}`} onClick={() => setShowMargins(!showMargins)} title="Toggle safe margins">⊞</button>
              <button className={`cert-btn cert-btn--ghost ${rightOpen ? "active" : ""}`} onClick={() => setRightOpen((v) => !v)} title="Toggle right panel">☰</button>
            </>
          )}
          <button className={`cert-btn ${saveState === "error" ? "cert-btn--warn" : dirty ? "cert-btn--primary" : ""}`} onClick={manualSave} title="Save now — the editor also autosaves in the background">{saveState === "saving" ? "Saving…" : saveState === "error" ? "Retry save" : dirty ? "Save now" : "Saved"}</button>
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
              <button className="cert-fmt-size-btn" onClick={() => adjustFontSize(-1)} title="Decrease selected text or this whole box">−</button>
              <input className="cert-fmt-size" type="number" min={1} max={500} value={selectedBlock.style.fontSize} onChange={(e) => fmt({ fontSize: Math.max(1, +e.target.value) })} title="Font size (px)" />
              <span className="cert-fmt-size-unit">px</span>
              <button className="cert-fmt-size-btn" onClick={() => adjustFontSize(1)} title="Increase selected text or this whole box">+</button>
            </div>
          </div>
          <span className="cert-fmt-sep" />
          <div className="cert-fmt-group">
            <button className={`cert-fmt-btn ${selectedBlock.style.fontWeight >= 700 ? "active" : ""}`} onClick={() => fmt({ fontWeight: 700 }, "fontWeight")} title="Bold"><b>B</b></button>
            <button className={`cert-fmt-btn ${selectedBlock.style.fontStyle === "italic" ? "active" : ""}`} onClick={() => fmt({ fontStyle: "italic" }, "fontStyle")} title="Italic"><i>I</i></button>
            <button className={`cert-fmt-btn ${hasDecoration("underline") ? "active" : ""}`} onClick={() => fmt({ textDecoration: "underline" }, "textDecoration")} title="Underline"><u>U</u></button>
            <button className={`cert-fmt-btn ${hasDecoration("line-through") ? "active" : ""}`} onClick={() => fmt({ textDecoration: "line-through" }, "textDecoration")} title="Strikethrough"><s>S</s></button>
            <button className="cert-fmt-btn" onClick={clearAllFormatting} title="Clear all formatting: reset this text box and its linked fields to Glacial Indifference, 12px">⌫</button>
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

            <div className="cert-left-section">
              <h4 className="cert-left-title">Quick insert</h4>
              <div className="cert-tool-palette">
                <button className="cert-tool-btn" onClick={() => addQuickBlock("author")} title="A linked author name, ready to position"><span className="cert-tool-ico">A</span><span>Author</span></button>
                <button className="cert-tool-btn" onClick={() => addQuickBlock("title")} title="A wrapped linked article title"><span className="cert-tool-ico">T</span><span>Title</span></button>
                <button className="cert-tool-btn" onClick={() => addQuickBlock("citation")} title="A DOI citation line"><span className="cert-tool-ico">⌗</span><span>DOI</span></button>
                <button className="cert-tool-btn" onClick={() => addQuickBlock("date")} title="A linked issue date"><span className="cert-tool-ico">D</span><span>Date</span></button>
                <button className="cert-tool-btn" onClick={() => addQuickBlock("portrait")} title="Upload a photo, then choose Circle crop in its properties"><span className="cert-tool-ico">◯</span><span>Portrait</span></button>
              </div>
            </div>

            <div className="cert-left-section cert-left-tool-section">
              <button className="cert-left-title cert-left-tool-toggle" onClick={() => setLeftToolOpen((open) => ({ ...open, fields: !open.fields }))}>Linked Fields <span>{leftToolOpen.fields ? "−" : "+"}</span></button>
              {leftToolOpen.fields && <>
                <input className="cert-input cert-field-search" placeholder="Search fields…" value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} />
                <div className="cert-field-list">
                  {template.fields.filter((field) => !fieldSearch || field.label.toLowerCase().includes(fieldSearch.toLowerCase()) || field.key.includes(fieldSearch.toLowerCase())).map((field) => {
                    const usage = getFieldUsage(template, field.key);
                    return <div key={field.key} className="cert-field-item"><div className="cert-field-item-head"><strong>{field.label}</strong><code className="cert-field-key">{`{{${field.key}}}`}</code></div><p className="cert-field-usage">Used {usage.count} time{usage.count !== 1 ? "s" : ""}</p><div className="cert-field-item-actions"><button onClick={() => { const pageId = usage.pages[0]; const index = template.pages.findIndex((page) => page.id === pageId); if (index >= 0) setCurrentPageIdx(index); }}>Jump to</button><button onClick={() => { if (currentPage) addBlock(createLinkedBlock(currentPage.id, field.key, 60, 60)); }}>+ Add</button></div></div>;
                  })}
                </div>
              </>}
            </div>

            <div className="cert-left-section cert-left-tool-section">
              <button className="cert-left-title cert-left-tool-toggle" onClick={() => setLeftToolOpen((open) => ({ ...open, layers: !open.layers }))}>Layers <span>{leftToolOpen.layers ? "−" : "+"}</span></button>
              {leftToolOpen.layers && <div className="cert-layers-panel">
                {currentBlocks.length === 0 && <p className="cert-panel-empty-text">No layers on this page.</p>}
                {[...currentBlocks].sort((a, b) => b.zIndex - a.zIndex).map((block) => <div key={block.id} className={`cert-layer-item ${block.id === selectedBlockId ? "selected" : ""} ${block.hidden ? "hidden" : ""}`} onClick={() => handleSelect(block.id)}><span className="cert-layer-icon">{block.type === "text" ? "T" : block.type === "image" ? "Image" : "QR"}</span><span className="cert-layer-name">{block.name}</span><div className="cert-layer-actions"><button onClick={(event) => { event.stopPropagation(); updateBlock(block.id, { hidden: !block.hidden }); }}>{block.hidden ? "Show" : "Hide"}</button><button onClick={(event) => { event.stopPropagation(); updateBlock(block.id, { locked: !block.locked }); }}>{block.locked ? "Unlock" : "Lock"}</button></div></div>)}
              </div>}
            </div>

            <div className="cert-left-section cert-left-tool-section">
              <button className="cert-left-title cert-left-tool-toggle" onClick={() => setLeftToolOpen((open) => ({ ...open, validation: !open.validation }))}>Validation <span>{leftToolOpen.validation ? "−" : "+"}</span></button>
              {leftToolOpen.validation && validation && <div className="cert-validation-panel"><div className="cert-validation-summary"><span className={`cert-val-count ${validation.errors ? "error" : "ok"}`}>{validation.errors} errors</span><span className={`cert-val-count ${validation.warnings ? "warn" : "ok"}`}>{validation.warnings} warnings</span></div><div className="cert-validation-list">{validation.checks.map((check) => <div key={check.id} className={`cert-val-item cert-val-item--${check.status}`}><div><strong>{check.label}</strong><p>{check.message}</p></div>{check.pageId && <button className="cert-val-jump" onClick={() => { const index = template.pages.findIndex((page) => page.id === check.pageId); if (index >= 0) setCurrentPageIdx(index); if (check.blockId) handleSelect(check.blockId); }}>Go to</button>}</div>)}</div></div>}
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
                {isTextSelected && selectedBlock.segments?.some((segment) => segment.t === "f") && (
                  <div className="cert-field-group">
                    <label className="cert-field-label">Generated field emphasis</label>
                    <div className="cert-emphasis-grid">
                      {selectedBlock.segments.map((segment, index) => segment.t === "f" && (
                        <label key={`${segment.k}-${index}`} className="cert-check-row" title={`Bold only the generated ${template.fields.find((field) => field.key === segment.k)?.label || segment.k}`}>
                          <input type="checkbox" checked={Number(segment.style?.fontWeight || 400) >= 600} onChange={(e) => updateBlock(selectedBlock.id, { segments: selectedBlock.segments?.map((item, itemIndex) => item.t === "f" && itemIndex === index ? { ...item, style: { ...item.style, fontWeight: e.target.checked ? 700 : 400 } } : item) })} />
                          <span>Bold {template.fields.find((field) => field.key === segment.k)?.label || segment.k}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {isTextSelected && editingBlockId === selectedBlock.id && editorHasSelection && (
                  <div className="cert-field-group">
                    <label className="cert-field-label">Convert selection to field</label>
                    <input className="cert-input cert-field-search" placeholder="Search fields…" value={convertSearch} onChange={(e) => setConvertSearch(e.target.value)} />
                    <div className="cert-convert-field-list">
                      {template.fields
                        .filter((f) => !convertSearch || f.label.toLowerCase().includes(convertSearch.toLowerCase()) || f.key.includes(convertSearch.toLowerCase()))
                        .map((f) => (
                          <button key={f.key} type="button" className="cert-convert-field-item" onMouseDown={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("cert-insert-field-at-selection", { detail: { fieldKey: f.key } })); setConvertSearch(""); }}>
                            <span>{f.label}</span>
                            <code>{f.key}</code>
                          </button>
                        ))}
                    </div>
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
                    {selectedBlock.assetUrl && <button className="cert-btn" onClick={() => setCropDraft({ blockId: selectedBlock.id, url: selectedBlock.assetUrl || "", x: selectedBlock.style.cropX || 0, y: selectedBlock.style.cropY || 0, zoom: selectedBlock.style.cropZoom || 1 })}>Crop & position photo</button>}
                    <div className="cert-field-row cert-field-row--2">
                      <div className="cert-field-group"><label className="cert-field-label">Radius</label><input className="cert-input" type="number" min={0} max={400} value={selectedBlock.style.borderRadius} onChange={(e) => updateBlockStyle(selectedBlock.id, { borderRadius: +e.target.value })} /></div>
                      <div className="cert-field-group"><label className="cert-field-label">Border</label><input className="cert-input" type="number" min={0} max={40} value={selectedBlock.style.borderWidth || 0} onChange={(e) => updateBlockStyle(selectedBlock.id, { borderWidth: +e.target.value })} /></div>
                    </div>
                    <div className="cert-field-group">
                      <label className="cert-field-label">Photo frame</label>
                      <div className="cert-create-actions">
                        <button className="cert-btn" onClick={() => { const size = Math.min(selectedBlock.width, selectedBlock.height); updateBlock(selectedBlock.id, { imageShape: "circle", width: size, height: size }); updateBlockStyle(selectedBlock.id, { imageShape: "circle", objectFit: "cover", borderRadius: size / 2, borderWidth: 0, borderStyle: "none" }); }}>Circle crop</button>
                        <button className="cert-btn" onClick={() => { updateBlock(selectedBlock.id, { imageShape: "rectangle" }); updateBlockStyle(selectedBlock.id, { imageShape: "rectangle", objectFit: "cover", borderRadius: 0, borderWidth: 5, borderColor: "#152b21", borderStyle: "solid" }); }}>Border frame</button>
                      </div>
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
                  {mode === "builder" && <button className="cert-btn" onClick={copySelectedToOtherPages} title="Copy this element to the same relative position on every other page">Copy to all pages</button>}
                  <button className="cert-btn" onClick={() => updateBlock(selectedBlock.id, { locked: !selectedBlock.locked })}>{selectedBlock.locked ? "Unlock" : "Lock"}</button>
                  <button className="cert-btn cert-btn--danger" onClick={() => deleteBlock(selectedBlock.id)}>Delete</button>
                </div>
              </div>
            )}

            {!selectedBlock && (
              <div className="cert-left-hint">
                <p><strong>Click</strong> an element to select &amp; resize it.</p>
                <p><strong>Double-click</strong> text to edit it on the canvas.</p>
                <p><strong>Highlight</strong> words, then use the <strong>Convert</strong> button that appears to turn them into a linked field.</p>
                <p><strong>Click empty canvas</strong> to deselect.</p>
              </div>
            )}
          </aside>
        )}

        <div className="cert-canvas-col">
          <div className="cert-page-nav cert-page-nav--top">
            <button disabled={currentPageIdx === 0} onClick={() => { setCurrentPageIdx((i) => i - 1); setSelectedBlockId(null); setEditingBlockId(null); }}>‹</button>
            <span className="cert-page-label">Page {currentPageIdx + 1} of {template.pages.length} · {currentPage?.name || ""}</span>
            <button disabled={currentPageIdx >= template.pages.length - 1} onClick={() => { setCurrentPageIdx((i) => i + 1); setSelectedBlockId(null); setEditingBlockId(null); }}>›</button>
            <button className={`cert-thumb-toggle ${showThumbnails ? "active" : ""}`} onClick={() => setShowThumbnails(!showThumbnails)} title="Show all pages">Pages</button>
          </div>
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
              {launchState === "loading" && <div className="cert-empty-state"><p>Loading the manuscript, author, and publication details…</p></div>}
              {launchState === "error" && <div className="cert-import-error">The publication record could not be loaded for this certificate.</div>}
              {rightTab === "data" && (
                <div className="cert-data-panel">
                  <div className="cert-field-section cert-import-section">
                    <div className="cert-data-section-head"><h4 className="cert-field-section-title">Import Manuscript</h4><button className="cert-btn" onClick={() => void loadImportCandidates()} disabled={importState === "loading" || importState === "importing"}>{importState === "loading" ? "Loading…" : "Refresh"}</button></div>
                    <p className="cert-field-hint">Only manuscripts marked For approval appear here. Import creates one certificate for every linked author.</p>
                    <input className="cert-input cert-field-search" value={importSearch} onFocus={() => { if (!importCandidates.length) void loadImportCandidates(); }} onChange={(event) => setImportSearch(event.target.value)} placeholder="Search approved manuscripts…" />
                    {visibleCandidates.map((candidate) => <button key={candidate.publicationId} className="cert-import-candidate" disabled={!candidate.ready || importState === "importing"} onClick={() => void importManuscript(candidate.publicationId)}><strong>{candidate.title}</strong><span>{candidate.journal} · Vol. {candidate.volume || "—"}, Issue {candidate.issue || "—"} · {candidate.authorCount} author{candidate.authorCount === 1 ? "" : "s"}</span>{!candidate.ready && <em>Missing {candidate.missing.join(", ")}</em>}</button>)}
                    {importState === "error" && <p className="cert-import-error">Could not import this manuscript. Please retry.</p>}
                  </div>
                  {record && <div className="cert-field-section cert-record-context">
                    <div className="cert-data-section-head"><h4 className="cert-field-section-title">Imported Certificate</h4>{record.status !== "issued" && <button className="cert-btn" onClick={() => void refreshRecord()}>Refresh from manuscript</button>}</div>
                    {selectedPublicationRecords.length > 1 && <label className="cert-field-label">Author certificate<select className="cert-input" value={record.id} onChange={(event) => setActiveRecordId(event.target.value)}>{selectedPublicationRecords.map((item) => <option key={item.id} value={item.id}>{item.fieldValues.author_name || item.certificateNumber}</option>)}</select></label>}
                    {Array.isArray(record.fieldValues._import_warnings) && record.fieldValues._import_warnings.length > 0 && <p className="cert-import-error">{record.fieldValues._import_warnings.join(" ")}</p>}
                  </div>}
                  <div className="cert-field-section">
                    <button type="button" className="cert-data-section-toggle" onClick={() => setDataOpen((o) => ({ ...o, author: !o.author }))} aria-expanded={dataOpen.author}><h4 className="cert-field-section-title">Author Information</h4><span className="cert-data-section-chev">{dataOpen.author ? "–" : "+"}</span></button>
                    {dataOpen.author && authorFields.map((field) => <div key={field.key} className="cert-field-group"><label className="cert-field-label cert-field-label--loc" onClick={() => focusFieldOnCanvas(field.key)} title="Locate this field on the certificate">{field.label}{field.required && <span className="cert-req">*</span>}</label><div className="cert-field-input-row">{field.key === "author_name" && <button type="button" className={`cert-case-btn${(fieldValues[field.key] || "").length > 0 && fieldValues[field.key] === fieldValues[field.key].toUpperCase() ? " active" : ""}`} title="Convert to ALL CAPS" onClick={() => setFieldValue(field.key, (fieldValues[field.key] || "").toUpperCase())}>AA</button>}<input ref={(el) => { fieldInputRefs.current[field.key] = el; }} className="cert-input" value={fieldValues[field.key] || ""} onChange={(event) => setFieldValue(field.key, event.target.value)} onKeyDown={(event) => onFieldKeyDown(event, field.key)} placeholder={field.placeholder || ""} /></div></div>)}
                  </div>
                  <div className="cert-field-section">
                    <button type="button" className="cert-data-section-toggle" onClick={() => setDataOpen((o) => ({ ...o, publication: !o.publication }))} aria-expanded={dataOpen.publication}><h4 className="cert-field-section-title">Publication Information</h4><span className="cert-data-section-chev">{dataOpen.publication ? "–" : "+"}</span></button>
                    {dataOpen.publication && pubFields.map((field) => <div key={field.key} className="cert-field-group"><label className="cert-field-label cert-field-label--loc" onClick={() => focusFieldOnCanvas(field.key)} title="Locate this field on the certificate">{field.label}{field.required && <span className="cert-req">*</span>}</label><div className="cert-field-input-row">{field.key === "work_title" && <button type="button" className={`cert-case-btn${(fieldValues[field.key] || "").length > 0 && fieldValues[field.key] === fieldValues[field.key].toUpperCase() ? " active" : ""}`} title="Convert to ALL CAPS" onClick={() => setFieldValue(field.key, (fieldValues[field.key] || "").toUpperCase())}>AA</button>}<input ref={(el) => { fieldInputRefs.current[field.key] = el; }} className="cert-input" value={fieldValues[field.key] || ""} onChange={(event) => setFieldValue(field.key, event.target.value)} onKeyDown={(event) => onFieldKeyDown(event, field.key)} placeholder={field.placeholder || ""} /></div></div>)}
                  </div>
                  <div className="cert-field-section">
                    <button type="button" className="cert-data-section-toggle" onClick={() => setDataOpen((o) => ({ ...o, certificate: !o.certificate }))} aria-expanded={dataOpen.certificate}><h4 className="cert-field-section-title">Certificate Information</h4><span className="cert-data-section-chev">{dataOpen.certificate ? "–" : "+"}</span></button>
                    {dataOpen.certificate && certFields.map((field) => <div key={field.key} className="cert-field-group"><label className="cert-field-label cert-field-label--loc" onClick={() => focusFieldOnCanvas(field.key)} title="Locate this field on the certificate">{field.label}{field.required && <span className="cert-req">*</span>}</label><input ref={(el) => { fieldInputRefs.current[field.key] = el; }} className="cert-input" value={fieldValues[field.key] || ""} onChange={(event) => setFieldValue(field.key, event.target.value)} onKeyDown={(event) => onFieldKeyDown(event, field.key)} placeholder={field.placeholder || ""} readOnly={Boolean(record && ["certificate_number", "date_issued", "publisher_name", "issuing_city"].includes(field.key))} /></div>)}
                  </div>
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
                  {template.blocks.some((b) => b.type === "image" && b.assetUrl) && (
                    <div className="cert-field-section">
                      <h4 className="cert-field-section-title">Uploaded Images</h4>
                      <div className="cert-asset-gallery">
                        {template.blocks.filter((b) => b.type === "image" && b.assetUrl).map((b) => (
                          <button key={b.id} className="cert-asset-thumb" title={b.name} onClick={() => { const idx = template.pages.findIndex((p) => p.id === b.pageId); if (idx >= 0) setCurrentPageIdx(idx); setSelectedBlockId(b.id); }}>
                            <img src={b.assetUrl} alt={b.name} />
                            <span>{b.name || "Image"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <label className="cert-check-row cert-compress-toggle" title="Compress page images to JPEG so the PDF stays small. Text stays perfectly sharp.">
                      <input type="checkbox" checked={compressOn} onChange={(e) => setCompressOn(e.target.checked)} />
                      <span>Compress PDF (smaller file)</span>
                    </label>
                    {compressOn && (
                      <div className="cert-field-group cert-compress-control">
                        <div className="cert-compress-head">
                          <label className="cert-field-label">Image quality</label>
                          <span className="cert-compress-quality">{compressQuality}%</span>
                        </div>
                        <input className="cert-input cert-compress-slider" type="range" min={40} max={95} step={1} value={compressQuality} onChange={(e) => setCompressQuality(+e.target.value)} />
                        <div className="cert-compress-estimate">
                          <span>Estimated PDF size</span>
                          <strong>{estimating ? "Analyzing…" : pdfEstimate || "—"}</strong>
                        </div>
                        <p className="cert-field-hint">Lower quality = smaller file. Page 6 (social media) always exports at maximum quality.</p>
                      </div>
                    )}
                    <button className="cert-btn cert-btn--primary cert-btn--full" onClick={downloadCertificatePackage}>Download Pages 1–5 PDF + Page 6 JPG</button>
                    <button className="cert-btn cert-btn--primary cert-btn--full" onClick={exportAllPagesPDF}>Export All Pages as PDF</button>
                    <button className="cert-btn cert-btn--full" onClick={exportCurrentPagePNG}>Export Current Page as PNG</button>
                    <button className="cert-btn cert-btn--full" onClick={exportCurrentPagePDF}>Export Current Page as PDF</button>
                  </div>
                  <div className="cert-field-section">
                    <h4 className="cert-field-section-title">Certificate Status</h4>
                    <div className="cert-status-row">
                      <span>Current: <strong>{record?.status || template.status}</strong></span>
                      {record && record.status === "draft" && (
                        <button className="cert-btn cert-btn--primary" onClick={() => void issueAndAttachCertificate()}>Issue and attach certificate</button>
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

      {cropDraft && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", background: "rgba(10,20,15,.62)", padding: 20 }} onMouseDown={() => setCropDraft(null)}>
          <div style={{ width: "min(560px, 94vw)", background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 24px 70px rgba(0,0,0,.35)" }} onMouseDown={(event) => event.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>Crop & position photo</h3>
            <p style={{ margin: "0 0 14px", color: "#57635c", fontSize: 13 }}>Drag the photo to position it. Use the slider to zoom in or out. The visible frame is what will appear on the certificate.</p>
            <div
              style={{ position: "relative", height: 280, overflow: "hidden", background: "#e8ece9", borderRadius: selectedBlock?.imageShape === "circle" ? "50%" : 8, cursor: "grab", touchAction: "none" }}
              onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.setPointerCapture(event.pointerId); cropPointerRef.current = { x: event.clientX, y: event.clientY, cropX: cropDraft.x, cropY: cropDraft.y, width: rect.width, height: rect.height }; }}
              onPointerMove={(event) => { const start = cropPointerRef.current; if (!start) return; setCropDraft((draft) => draft ? { ...draft, x: Math.max(-100, Math.min(100, start.cropX + ((event.clientX - start.x) / start.width) * 100)), y: Math.max(-100, Math.min(100, start.cropY + ((event.clientY - start.y) / start.height) * 100)) } : draft); }}
              onPointerUp={() => { cropPointerRef.current = null; }}
              onPointerCancel={() => { cropPointerRef.current = null; }}
            >
              <img src={cropDraft.url} alt="Crop preview" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${cropDraft.x}%, ${cropDraft.y}%) scale(${cropDraft.zoom})`, transformOrigin: "center", pointerEvents: "none", userSelect: "none" }} />
            </div>
            <div className="cert-field-group" style={{ marginTop: 14 }}>
              <label className="cert-field-label">Zoom · {Math.round(cropDraft.zoom * 100)}%</label>
              <input className="cert-input" type="range" min="1" max="3" step="0.01" value={cropDraft.zoom} onChange={(event) => setCropDraft((draft) => draft ? { ...draft, zoom: +event.target.value } : draft)} />
            </div>
            <div className="cert-create-actions" style={{ marginTop: 16 }}>
              <button className="cert-btn" onClick={() => setCropDraft((draft) => draft ? { ...draft, x: 0, y: 0, zoom: 1 } : draft)}>Reset</button>
              <button className="cert-btn" onClick={() => setCropDraft(null)}>Cancel</button>
              <button className="cert-btn cert-btn--primary" onClick={() => { updateBlockStyle(cropDraft.blockId, { cropX: cropDraft.x, cropY: cropDraft.y, cropZoom: cropDraft.zoom, objectFit: "cover" }); setCropDraft(null); }}>Apply crop</button>
            </div>
          </div>
        </div>
      )}

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(e) => { handleAddImage(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={bgImageInputRef} type="file" accept="image/*" hidden onChange={(e) => { handleSetBackground(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={replaceImageInputRef} type="file" accept="image/*" hidden onChange={(e) => { handleReplaceImage(e.target.files?.[0]); e.target.value = ""; }} />

      {uploadProgress && (
        <div className={`cert-upload-toast cert-upload-toast--${uploadProgress.status}`}>
          <div className="cert-upload-toast-info">
            <span className="cert-upload-toast-name">{uploadProgress.name}</span>
            <span className="cert-upload-toast-pct">{uploadProgress.status === "error" ? "Failed" : uploadProgress.status === "done" ? "Done" : `${uploadProgress.pct}%`}</span>
          </div>
          <div className="cert-upload-bar"><div className="cert-upload-bar-fill" style={{ width: `${uploadProgress.status === "error" ? 100 : uploadProgress.pct}%` }} /></div>
        </div>
      )}
    </div>
  );
}
