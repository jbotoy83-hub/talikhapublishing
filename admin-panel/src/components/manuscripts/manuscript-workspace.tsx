import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LexicalEditor } from "lexical";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  ImageIcon,
  Info,
  Layers,
  LockKeyhole,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "@/components/icons";
import { manuscriptApi, ManuscriptApiError, downloadPreview } from "./api";
import { EditorsHub } from "./editors-hub";
import { fetchPrivateSource, importManuscriptOffThread } from "./import-client";
import {
  applyTalikhaPreset,
  convertLinkedFieldToFixed,
  insertLinkedField,
  ManuscriptEditor,
  scrollToOutlineHeading,
  type ManuscriptOutlineItem,
} from "./manuscript-editor";
import { ManuscriptComparison, compareManuscriptParagraphs } from "./comparison";
import { manuscriptRecovery } from "./recovery";
import type {
  EditorMetrics,
  LinkedFieldBinding,
  ManuscriptDetail,
  ManuscriptEditorState,
  ManuscriptFieldValue,
  ManuscriptManualConfirmations,
  ManuscriptPageSettings,
  ManuscriptPanel,
  ManuscriptSaveState,
  ManuscriptVerificationKey,
} from "./types";
import { defaultManuscriptPageSettings, manuscriptPlainTextFromState, manuscriptVerificationKeys } from "./types";
import "@fontsource/tinos/latin-400.css";
import "@fontsource/tinos/latin-400-italic.css";
import "@fontsource/tinos/latin-700.css";
import "@fontsource/arimo/latin-400.css";
import "@fontsource/arimo/latin-700.css";
import "@fontsource/carlito/latin-400.css";
import "@fontsource/caladea/latin-400.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-700.css";
import "@fontsource/courier-prime/latin-400.css";
import "./manuscripts.css";

type FieldChange = { key: string; label: string; kind: "text" | "image"; previous: string; current: string; previousFileId: string | null; currentFileId: string | null };

const verificationLabels: Record<ManuscriptVerificationKey, string> = {
  title: "Title matches the original and submission record",
  authors: "All author names and details are complete and in order",
  paragraphs: "Paragraphs, blank lines, and reading order were reviewed",
  tables: "Tables and their contents were checked",
  figures: "Figures, images, and captions were checked",
  footnotes: "Footnotes and note markers were checked",
  flaggedPages: "Every flagged or low-confidence page was reviewed",
};

function submissionFromUrl() {
  return new URLSearchParams(window.location.search).get("submission") || "";
}

function updateSubmissionUrl(submissionId: string | null, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "manuscripts");
  if (submissionId) url.searchParams.set("submission", submissionId);
  else url.searchParams.delete("submission");
  window.history[replace ? "replaceState" : "pushState"]({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function shortHash(value: string | null) {
  return value ? value.slice(0, 10) : "Pending hash";
}

function dateTime(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function stateLabel(state: ManuscriptSaveState) {
  if (state === "saved") return "All changes saved";
  if (state === "saving") return "Saving…";
  if (state === "unsaved") return "Unsaved changes";
  if (state === "offline") return "Saved for recovery";
  if (state === "conflict") return "Edit conflict";
  return "Read-only";
}

function deriveBindings(state: ManuscriptEditorState, bindings: LinkedFieldBinding[]) {
  const status = new Map<string, boolean>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Record<string, unknown>;
    if (node.type === "linked-field" || node.type === "linked-image") {
      const key = String(node.fieldKey || "");
      const overridden = node.overridden === true || (node.type === "linked-field" && String(node.text || "") !== String(node.sourceValue || ""));
      if (key) status.set(key, status.get(key) === true || overridden);
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  visit(state);
  return bindings.map((binding) => status.has(binding.key) ? { ...binding, overridden: status.get(binding.key) === true } : binding);
}

function PanelButton({ id, active, icon, label, onClick }: { id: ManuscriptPanel; active: ManuscriptPanel; icon: React.ReactNode; label: string; onClick: (id: ManuscriptPanel) => void }) {
  return <button type="button" className={active === id ? "is-active" : ""} onClick={() => onClick(id)}>{icon}<span>{label}</span></button>;
}

function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "success"; children: React.ReactNode }) {
  return <div className={`me-notice is-${tone}`}>{tone === "warning" ? <AlertTriangle size={17} /> : tone === "success" ? <CheckCircle2 size={17} /> : <Info size={17} />}<div>{children}</div></div>;
}

export function ManuscriptWorkspace() {
  const [submissionId, setSubmissionId] = useState(submissionFromUrl);
  const [detail, setDetail] = useState<ManuscriptDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(submissionFromUrl()));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editorState, setEditorState] = useState<ManuscriptEditorState | null>(null);
  const [pageSettings, setPageSettings] = useState<ManuscriptPageSettings>(defaultManuscriptPageSettings);
  const [bindings, setBindings] = useState<LinkedFieldBinding[]>([]);
  const [confirmations, setConfirmations] = useState<ManuscriptManualConfirmations>({});
  const [outline, setOutline] = useState<ManuscriptOutlineItem[]>([]);
  const [metrics, setMetrics] = useState<EditorMetrics>({ words: 0, characters: 0, paragraphs: 0, selectedWords: 0 });
  const [saveState, setSaveState] = useState<ManuscriptSaveState>("saved");
  const [activePanel, setActivePanel] = useState<ManuscriptPanel>("fields");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [zoom, setZoom] = useState(100);
  const [editorKey, setEditorKey] = useState(0);
  const [fieldChanges, setFieldChanges] = useState<FieldChange[]>([]);
  const [selectedFieldChanges, setSelectedFieldChanges] = useState<Set<string>>(new Set());
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeSummary, setFinalizeSummary] = useState("Final DOCX and PDF attached");
  const [finalizing, setFinalizing] = useState(false);
  const [finalFiles, setFinalFiles] = useState<{ docxUrl: string; pdfUrl: string } | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [pageEstimate, setPageEstimate] = useState(1);

  const editorRef = useRef<LexicalEditor | null>(null);
  const detailRef = useRef<ManuscriptDetail | null>(null);
  const editorStateRef = useRef<ManuscriptEditorState | null>(null);
  const contentTextRef = useRef("");
  const pageSettingsRef = useRef(pageSettings);
  const bindingsRef = useRef(bindings);
  const confirmationsRef = useRef(confirmations);
  const revisionRef = useRef(0);
  const dirtyTokenRef = useRef(0);
  const savedTokenRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const saveBlockedRef = useRef(false);
  const skipInitialChangeRef = useRef(true);

  const applyDetail = useCallback(async (next: ManuscriptDetail, allowRecovery = false) => {
    dirtyTokenRef.current = 0;
    savedTokenRef.current = 0;
    saveBlockedRef.current = false;
    detailRef.current = next;
    setDetail(next);
    let state = next.draft.editorState;
    let settings = next.draft.pageSettings;
    let nextBindings = next.draft.fieldBindings;
    let nextConfirmations = next.draft.manualConfirmations;
    let text = next.draft.contentText;
    if (allowRecovery) {
      const recovery = await manuscriptRecovery.read(next.document.id).catch(() => undefined);
      if (recovery && recovery.baseRevision === next.draft.revision && new Date(recovery.savedAt).getTime() > new Date(next.draft.updatedAt).getTime()) {
        if (window.confirm("Talikha found unsent manuscript edits from this browser. Restore them now?")) {
          state = recovery.editorState;
          settings = recovery.pageSettings;
          nextBindings = recovery.fieldBindings;
          nextConfirmations = recovery.manualConfirmations;
          text = recovery.contentText;
          dirtyTokenRef.current = 1;
          savedTokenRef.current = 0;
          setSaveState("unsaved");
        } else await manuscriptRecovery.clear(next.document.id).catch(() => undefined);
      } else if (recovery) await manuscriptRecovery.clear(next.document.id).catch(() => undefined);
    }
    editorStateRef.current = state;
    contentTextRef.current = text;
    pageSettingsRef.current = settings;
    bindingsRef.current = nextBindings;
    confirmationsRef.current = nextConfirmations;
    revisionRef.current = next.draft.revision;
    setEditorState(state);
    setPageSettings(settings);
    setBindings(nextBindings);
    setConfirmations(nextConfirmations);
    setMetrics({ words: next.draft.importReport?.editorWords || 0, characters: text.length, paragraphs: next.draft.importReport?.editorParagraphs || (text ? text.split(/\n+/).filter(Boolean).length : 0), selectedWords: 0 });
    skipInitialChangeRef.current = true;
    setEditorKey((value) => value + 1);
    if (!dirtyTokenRef.current || dirtyTokenRef.current === savedTokenRef.current) setSaveState(next.lease.editable ? "saved" : "read_only");
  }, []);

  useEffect(() => {
    const onPopState = () => setSubmissionId(submissionFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!submissionId) { setDetail(null); setEditorState(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessage("");
    setSourceBlob(null);
    setFinalFiles(null);
    dirtyTokenRef.current = 0;
    savedTokenRef.current = 0;
    void manuscriptApi.open(submissionId).then(async (next) => { if (!cancelled) await applyDetail(next, true); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "The manuscript workspace could not be opened."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [applyDetail, submissionId]);

  useEffect(() => {
    const documentId = detail?.document.id;
    if (!documentId || !detail.lease.editable) return;
    const interval = window.setInterval(() => {
      void manuscriptApi.lease(documentId, "heartbeat").then((next) => {
        detailRef.current = next;
        setDetail((current) => current ? { ...current, lease: next.lease } : current);
      }).catch(() => setSaveState("read_only"));
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      void manuscriptApi.lease(documentId, "release").catch(() => undefined);
    };
  }, [detail?.document.id, detail?.lease.editable]);

  const ensureSource = useCallback(async () => {
    const current = detailRef.current;
    if (!current) throw new Error("The manuscript source is unavailable.");
    if (sourceBlob) return sourceBlob;
    setSourceLoading(true);
    try {
      const blob = await fetchPrivateSource(current.document.sourceFileId);
      setSourceBlob(blob);
      return blob;
    } finally { setSourceLoading(false); }
  }, [sourceBlob]);

  const markDirty = useCallback(() => {
    const current = detailRef.current;
    if (!current?.lease.editable || !editorStateRef.current) return;
    dirtyTokenRef.current += 1;
    setSaveState("unsaved");
    void manuscriptRecovery.write({ documentId: current.document.id, baseRevision: revisionRef.current, editorState: editorStateRef.current, pageSettings: pageSettingsRef.current, fieldBindings: bindingsRef.current, manualConfirmations: confirmationsRef.current, contentText: contentTextRef.current, savedAt: new Date().toISOString() }).catch(() => undefined);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => { void persistDraft(); }, 900);
  }, []);

  async function persistDraft() {
    const current = detailRef.current;
    if (!current?.lease.editable || !editorStateRef.current || dirtyTokenRef.current === savedTokenRef.current) return;
    if (savePromiseRef.current) { await savePromiseRef.current; if (dirtyTokenRef.current !== savedTokenRef.current && !saveBlockedRef.current) return persistDraft(); return; }
    const token = dirtyTokenRef.current;
    const baseRevision = revisionRef.current;
    setSaveState("saving");
    savePromiseRef.current = manuscriptApi.save(current.document.id, {
      baseRevision,
      editorState: editorStateRef.current,
      contentText: contentTextRef.current,
      pageSettings: pageSettingsRef.current,
      fieldBindings: bindingsRef.current,
      fieldSnapshot: current.draft.fieldSnapshot,
      importReport: current.draft.importReport,
      sourceSnapshot: current.draft.sourceSnapshot,
      manualConfirmations: confirmationsRef.current,
    }).then((saved) => {
      saveBlockedRef.current = false;
      revisionRef.current = saved.revision;
      savedTokenRef.current = token;
      setDetail((value) => value ? { ...value, document: { ...value.document, currentRevision: saved.revision }, draft: { ...value.draft, revision: saved.revision, updatedAt: saved.updatedAt, contentHash: saved.contentHash, editorState: editorStateRef.current!, contentText: contentTextRef.current, pageSettings: pageSettingsRef.current, fieldBindings: bindingsRef.current, manualConfirmations: confirmationsRef.current } } : value);
      if (dirtyTokenRef.current === token) { setSaveState("saved"); void manuscriptRecovery.clear(current.document.id).catch(() => undefined); }
      else {
        setSaveState("unsaved");
        if (editorStateRef.current) void manuscriptRecovery.write({ documentId: current.document.id, baseRevision: saved.revision, editorState: editorStateRef.current, pageSettings: pageSettingsRef.current, fieldBindings: bindingsRef.current, manualConfirmations: confirmationsRef.current, contentText: contentTextRef.current, savedAt: new Date().toISOString() }).catch(() => undefined);
      }
    }).catch((reason) => {
      saveBlockedRef.current = true;
      if (reason instanceof ManuscriptApiError && reason.code === "EDIT_CONFLICT") setSaveState("conflict");
      else setSaveState("offline");
      setMessage(reason instanceof Error ? reason.message : "Changes remain in browser recovery storage.");
    }).finally(() => { savePromiseRef.current = null; });
    await savePromiseRef.current;
    if (dirtyTokenRef.current !== savedTokenRef.current && !saveBlockedRef.current) {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => { void persistDraft(); }, 350);
    }
  }

  const ensureSaved = async () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    await persistDraft();
    if (dirtyTokenRef.current !== savedTokenRef.current) throw new Error("Resolve the unsaved draft before continuing.");
  };

  const retrySave = async () => {
    saveBlockedRef.current = false;
    setMessage("");
    await persistDraft();
  };

  const copyUnsentText = async () => {
    try {
      await navigator.clipboard.writeText(contentTextRef.current);
      setMessage("The current manuscript text was copied. Browser recovery remains available.");
    } catch {
      setMessage("The browser could not copy the manuscript. Select the document text and copy it manually before reloading.");
    }
  };

  const reloadServerDraft = async () => {
    const current = detailRef.current;
    if (!current || !window.confirm("Reload the authoritative server draft? Unsent edits will be removed from the canvas. Copy them first if they are needed.")) return;
    setLoading(true);
    setMessage("");
    try {
      const latest = await manuscriptApi.detail(current.document.id);
      await manuscriptRecovery.clear(current.document.id).catch(() => undefined);
      await applyDetail(latest, false);
      setMessage("The latest server draft is loaded and the edit conflict is resolved.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The server draft could not be reloaded.");
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentChange = useCallback((state: ManuscriptEditorState, contentText: string, nextOutline: ManuscriptOutlineItem[]) => {
    editorStateRef.current = state;
    contentTextRef.current = contentText;
    const nextBindings = deriveBindings(state, bindingsRef.current);
    bindingsRef.current = nextBindings;
    setEditorState(state);
    setBindings(nextBindings);
    setOutline(nextOutline);
    window.requestAnimationFrame(() => {
      const root = editorRef.current?.getRootElement();
      if (root) setPageEstimate(Math.max(1, Math.ceil((root.scrollHeight + 192) / (pageSettingsRef.current.orientation === "portrait" ? 1123 : 794))));
    });
    if (skipInitialChangeRef.current) { skipInitialChangeRef.current = false; return; }
    markDirty();
  }, [markDirty]);

  const changePageSettings = (patch: Partial<ManuscriptPageSettings>) => {
    const next = { ...pageSettingsRef.current, ...patch };
    pageSettingsRef.current = next;
    setPageSettings(next);
    markDirty();
  };

  const openSubmission = (id: string) => { updateSubmissionUrl(id); setSubmissionId(id); };
  const backToHub = () => { updateSubmissionUrl(null); setSubmissionId(""); };

  const runImport = async () => {
    const current = detailRef.current;
    if (!current?.lease.editable) return;
    setError("");
    setMessage("");
    try {
      await ensureSaved();
      const blob = await ensureSource();
      const payload = await importManuscriptOffThread(blob, current.document.sourceFileName, current.document.sourceMimeType, setImportProgress);
      setImportProgress("Verifying conversion against the secure original…");
      await manuscriptApi.import(current.document.id, revisionRef.current, payload);
      await applyDetail(await manuscriptApi.detail(current.document.id));
      setMessage("The manuscript was imported and independently checked against the original text.");
      setActivePanel("compare");
      setComparisonOpen(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The manuscript could not be imported."); }
    finally { setImportProgress(""); }
  };

  const previewFields = async () => {
    const current = detailRef.current;
    if (!current) return;
    try {
      const response = await manuscriptApi.fieldSync(current.document.id, { action: "preview" }) as unknown as { changes: FieldChange[] };
      setFieldChanges(response.changes || []);
      setSelectedFieldChanges(new Set((response.changes || []).map((change) => change.key)));
      setMessage(response.changes?.length ? `${response.changes.length} linked-field update${response.changes.length === 1 ? "" : "s"} ready for review.` : "Linked fields already match the submission record.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Linked fields could not be checked."); }
  };

  const applyFieldUpdates = async () => {
    const current = detailRef.current;
    if (!current) return;
    try {
      await ensureSaved();
      await manuscriptApi.fieldSync(current.document.id, { action: "apply", baseRevision: revisionRef.current, selectedKeys: Array.from(selectedFieldChanges) });
      await applyDetail(await manuscriptApi.detail(current.document.id));
      setFieldChanges([]);
      setMessage("Selected linked fields were updated. Overrides and fixed text were left unchanged.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Linked fields could not be applied."); }
  };

  const checkpoint = async () => {
    const current = detailRef.current;
    if (!current) return;
    const summary = window.prompt("Checkpoint name", "Editorial checkpoint");
    if (summary === null) return;
    try { await ensureSaved(); const result = await manuscriptApi.checkpoint(current.document.id, summary); await applyDetail(result.detail); setMessage("Checkpoint created in immutable history."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The checkpoint could not be created."); }
  };

  const restoreVersion = async (versionId: string, versionNumber: number) => {
    const current = detailRef.current;
    if (!current || !window.confirm(`Restore version ${versionNumber} as a new version? The current state remains in history.`)) return;
    try { await ensureSaved(); const result = await manuscriptApi.restore(current.document.id, versionId); await applyDetail(result.detail); setMessage(`Version ${versionNumber} was restored as a new immutable version.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The version could not be restored."); }
  };

  const takeLease = async (action: "acquire" | "takeover") => {
    const current = detailRef.current;
    if (!current) return;
    try { await applyDetail(await manuscriptApi.lease(current.document.id, action)); setMessage(action === "takeover" ? "A safety checkpoint was created and the editing lease was transferred." : "Editing lease acquired."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The editing lease could not be acquired."); }
  };

  const finalize = async () => {
    const current = detailRef.current;
    if (!current) return;
    setFinalizing(true);
    setError("");
    try {
      await ensureSaved();
      const output = await manuscriptApi.finalize(current.document.id, confirmationsRef.current, finalizeSummary);
      setFinalFiles({ docxUrl: output.docxUrl, pdfUrl: output.pdfUrl });
      setFinalizeOpen(false);
      await applyDetail(await manuscriptApi.detail(current.document.id));
      setMessage("Final DOCX and searchable PDF were versioned and attached to the publication record.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The manuscript could not be finalized."); }
    finally { setFinalizing(false); }
  };

  const currentEditorText = editorState ? manuscriptPlainTextFromState(editorState) : "";
  const findings = useMemo(() => detail ? compareManuscriptParagraphs(detail.draft.sourceSnapshot.paragraphs, currentEditorText) : [], [currentEditorText, detail]);
  const fieldsByGroup = useMemo(() => {
    const groups = new Map<string, ManuscriptFieldValue[]>();
    for (const field of detail?.fields || []) groups.set(field.group, [...(groups.get(field.group) || []), field]);
    return groups;
  }, [detail?.fields]);

  if (!submissionId) return <EditorsHub onOpenManuscript={openSubmission} />;
  if (loading) return <div className="me-workspace-loading"><RefreshCw size={24} /><strong>Opening the manuscript workspace</strong><span>Loading the private source, draft, linked fields, and lease state…</span></div>;
  if (error && !detail) return <div className="me-workspace-fatal"><AlertTriangle size={28} /><h2>Manuscript Editor unavailable</h2><p>{error}</p><button type="button" className="me-primary-button" onClick={backToHub}><ArrowLeft size={17} />Back to Editors</button></div>;
  if (!detail || !editorState) return null;

  const editable = detail.lease.editable && detail.permissions.canEdit;
  const importReport = detail.draft.importReport;
  const warnings = importReport?.warnings || [];

  return <div className="me-workspace">
    <header className="me-command-bar">
      <button type="button" className="me-icon-button" title="Back to Editors" aria-label="Back to Editors" onClick={backToHub}><ArrowLeft size={18} /></button>
      <div className="me-document-identity"><strong>{detail.submission.title}</strong><span>{detail.submission.reference} · {detail.document.sourceFileName}</span></div>
      <div className="me-source-version" title={detail.document.sourceSha256 || "The source hash is created on first import"}><ShieldCheck size={15} /><span>Source</span><strong>{shortHash(detail.document.sourceSha256)}</strong></div>
      <div className={`me-lease-status ${editable ? "is-editable" : "is-readonly"}`}><span className="me-presence-dot" /><div><small>{editable ? "Editing lease" : "Read-only"}</small><strong>{editable ? "You" : detail.lease.ownerName || (detail.permissions.published ? "Published" : "No active editor")}</strong></div></div>
      <div className={`me-save-status is-${saveState}`}>{saveState === "saving" ? <RefreshCw size={15} /> : saveState === "conflict" || saveState === "offline" ? <AlertTriangle size={15} /> : saveState === "read_only" ? <LockKeyhole size={15} /> : <Check size={15} />}<span>{stateLabel(saveState)}</span></div>
      <div className="me-command-actions">
        <button type="button" className="me-command-button" disabled={!editable} onClick={() => void checkpoint()}><Save size={16} />Checkpoint</button>
        <button type="button" className={`me-command-button ${comparisonOpen ? "is-active" : ""}`} onClick={() => { setComparisonOpen((value) => !value); setActivePanel("compare"); void ensureSource().catch((reason) => setError(reason.message)); }}><Layers size={16} />Compare</button>
        <details className="me-command-menu"><summary className="me-command-button"><Eye size={16} />Preview<ChevronDown size={14} /></summary><div><button type="button" onClick={() => void downloadPreview(detail.document.id, "docx", detail.submission.title).catch((reason) => setError(reason.message))}>DOCX preview</button><button type="button" onClick={() => void downloadPreview(detail.document.id, "pdf", detail.submission.title).catch((reason) => setError(reason.message))}>PDF preview</button></div></details>
        <details className="me-command-menu"><summary className="me-command-button"><Download size={16} />Download<ChevronDown size={14} /></summary><div><a href={`/api/admin/files/${detail.document.sourceFileId}?download=1`}>Immutable original</a>{detail.versions.find((version) => version.docxFileId) ? <a href={`/api/admin/files/${detail.versions.find((version) => version.docxFileId)?.docxFileId}?download=1`}>Latest DOCX</a> : null}{detail.versions.find((version) => version.pdfFileId) ? <a href={`/api/admin/files/${detail.versions.find((version) => version.pdfFileId)?.pdfFileId}?download=1`}>Latest PDF</a> : null}</div></details>
        <button type="button" className="me-finalize-button" disabled={!editable || !detail.permissions.canFinalize} onClick={() => setFinalizeOpen(true)}><FileCheck2 size={16} />Finalize & attach</button>
      </div>
      <button type="button" className="me-mobile-panel-button" onClick={() => setLeftOpen(true)}><BookOpen size={17} />Outline</button><button type="button" className="me-mobile-panel-button" onClick={() => setRightOpen(true)}><SlidersHorizontal size={17} />Tools</button>
    </header>

    {error ? <div className="me-global-message is-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")}><X size={15} /></button></div> : null}
    {message ? <div className="me-global-message"><CheckCircle2 size={17} /><span>{message}</span><button type="button" onClick={() => setMessage("")}><X size={15} /></button></div> : null}
    {saveState === "offline" ? <div className="me-recovery-banner"><AlertTriangle size={16} /><span>Autosave is paused. Your unsent edits remain in this browser.</span><div className="me-recovery-actions"><button type="button" onClick={() => void copyUnsentText()}>Copy manuscript text</button><button type="button" onClick={() => void retrySave()}>Retry save</button></div></div> : null}
    {saveState === "conflict" ? <div className="me-recovery-banner"><AlertTriangle size={16} /><span>A newer server revision exists. Your unsent edits remain in browser recovery until you resolve this conflict.</span><div className="me-recovery-actions"><button type="button" onClick={() => void copyUnsentText()}>Copy manuscript text</button><button type="button" onClick={() => void reloadServerDraft()}>Reload server draft</button></div></div> : null}
    {!editable ? <div className="me-readonly-banner"><LockKeyhole size={16} /><span>{detail.permissions.published ? "This manuscript is published and permanently read-only." : detail.lease.ownerName ? `${detail.lease.ownerName} currently holds the editing lease.` : "This finalized draft is read-only until you acquire a new editing lease."}</span>{!detail.permissions.published && detail.permissions.canEdit ? <button type="button" onClick={() => void takeLease(detail.lease.canForceTakeover ? "takeover" : "acquire")}>{detail.lease.canForceTakeover ? "Create checkpoint & take over" : "Acquire editing lease"}</button> : null}</div> : null}

    <div className={`me-editor-layout ${comparisonOpen ? "is-comparing" : ""}`}>
      <aside className={`me-left-panel ${leftOpen ? "is-mobile-open" : ""}`}><button type="button" className="me-drawer-close" onClick={() => setLeftOpen(false)}><X size={16} /></button>
        <section><div className="me-panel-heading"><span>Document outline</span><small>{outline.length} headings</small></div><nav className="me-outline">{outline.length ? outline.map((item, index) => <button type="button" key={`${item.key}-${index}`} style={{ paddingLeft: `${12 + (item.level - 1) * 14}px` }} onClick={() => { if (editorRef.current) scrollToOutlineHeading(editorRef.current, index); setLeftOpen(false); }}>{item.text}</button>) : <p>Apply heading styles to build the outline.</p>}</nav></section>
        <section><div className="me-panel-heading"><span>Document structure</span></div><dl className="me-structure-stats"><div><dt>Paragraphs</dt><dd>{metrics.paragraphs}</dd></div><div><dt>Tables</dt><dd>{importReport?.tables ?? 0}</dd></div><div><dt>Images</dt><dd>{importReport?.images ?? 0}</dd></div><div><dt>Footnotes</dt><dd>{importReport?.footnotes ?? 0}</dd></div><div><dt>Source pages</dt><dd>{importReport?.sourcePages || "—"}</dd></div></dl></section>
        <section><div className="me-panel-heading"><span>Import & source</span></div>{importReport ? <div className="me-import-card"><div className="me-coverage-ring" style={{ "--coverage": `${Math.round(importReport.normalizedTextCoverage * 100)}%` } as React.CSSProperties}><strong>{Math.round(importReport.normalizedTextCoverage * 100)}%</strong></div><div><strong>Text coverage</strong><span>{importReport.sourceWords.toLocaleString()} source words</span></div></div> : <Notice>Import the original to create a structured editable draft and accuracy report.</Notice>}<button type="button" className="me-panel-action" disabled={!editable || Boolean(importProgress)} onClick={() => void runImport()}><Upload size={16} />{importReport ? "Re-import original" : "Import original manuscript"}</button>{importProgress ? <div className="me-import-progress"><RefreshCw size={16} />{importProgress}</div> : null}</section>
        <section><div className="me-panel-heading"><span>Import warnings</span><small>{warnings.length}</small></div><div className="me-warning-list">{warnings.length ? warnings.map((warning, index) => <button type="button" key={`${warning.code}-${index}`} onClick={() => { setActivePanel("compare"); setComparisonOpen(true); void ensureSource(); }}><AlertTriangle size={15} /><span>{warning.message}</span>{warning.page ? <small>p. {warning.page}</small> : null}</button>) : <p>No automatic import warnings.</p>}</div></section>
      </aside>

      <main className="me-editor-main">
        {comparisonOpen ? <div className="me-comparison-surface"><div className="me-surface-heading"><div><span className="me-eyebrow">Verification workspace</span><h2>Original vs. converted manuscript</h2></div><button type="button" className="me-secondary-button" onClick={() => setComparisonOpen(false)}><X size={16} />Return to editor</button></div>{sourceLoading ? <div className="me-viewer-loading"><RefreshCw size={18} />Loading the immutable original…</div> : <ManuscriptComparison sourceBlob={sourceBlob} fileName={detail.document.sourceFileName} mimeType={detail.document.sourceMimeType} sourceParagraphs={detail.draft.sourceSnapshot.paragraphs} convertedText={contentTextRef.current} />}</div> : <ManuscriptEditor key={`${detail.document.id}-${editorKey}`} initialState={editorState} editable={editable} pageSettings={pageSettings} zoom={zoom} onReady={(editor) => { editorRef.current = editor; }} onDocumentChange={handleDocumentChange} onMetricsChange={setMetrics} />}
      </main>

      <aside className={`me-right-panel ${rightOpen ? "is-mobile-open" : ""}`}><button type="button" className="me-drawer-close" onClick={() => setRightOpen(false)}><X size={16} /></button>
        <nav className="me-panel-tabs" aria-label="Manuscript panels"><PanelButton id="fields" active={activePanel} icon={<Layers size={15} />} label="Fields" onClick={setActivePanel} /><PanelButton id="page" active={activePanel} icon={<Settings size={15} />} label="Page" onClick={setActivePanel} /><PanelButton id="compare" active={activePanel} icon={<Eye size={15} />} label="Compare" onClick={setActivePanel} /><PanelButton id="history" active={activePanel} icon={<Clock3 size={15} />} label="History" onClick={setActivePanel} /></nav>
        <div className="me-panel-content">
          {activePanel === "fields" ? <div className="me-fields-panel"><div className="me-panel-intro"><div><h3>Linked fields</h3><p>Insert authoritative submission data. Copied values behave as normal text.</p></div><button type="button" title="Check for source updates" aria-label="Check linked-field updates" onClick={() => void previewFields()}><RefreshCw size={16} /></button></div>{fieldChanges.length ? <div className="me-field-diff"><strong>Review source updates</strong>{fieldChanges.map((change) => <label key={change.key}><input type="checkbox" checked={selectedFieldChanges.has(change.key)} onChange={(event) => setSelectedFieldChanges((current) => { const next = new Set(current); if (event.target.checked) next.add(change.key); else next.delete(change.key); return next; })} /><span><b>{change.label}</b><del>{change.previous || "Empty"}</del><ins>{change.current || "Empty"}</ins></span></label>)}<button type="button" className="me-primary-button" disabled={!editable || !selectedFieldChanges.size} onClick={() => void applyFieldUpdates()}>Apply selected updates</button></div> : null}{Array.from(fieldsByGroup.entries()).map(([group, fields]) => <section className="me-field-group" key={group}><div className="me-field-group-heading"><strong>{group}</strong><span>{fields.length}</span></div>{fields.map((field) => { const binding = bindings.find((item) => item.key === field.key); return <div className={`me-field-row ${binding?.overridden ? "is-overridden" : ""} ${binding?.frozen ? "is-frozen" : ""}`} key={field.key}><div className="me-field-value">{field.kind === "image" ? field.value ? <img src={field.value} alt={field.label} /> : <span className="me-field-image-empty"><ImageIcon size={17} /></span> : null}<span><small>{field.label}{field.private ? " · Private" : ""}</small><strong>{field.value || "Not provided"}</strong><em>{binding?.frozen ? "Frozen at finalization" : binding?.overridden ? "Overridden" : field.sourcePath}</em></span></div><div className="me-field-actions"><button type="button" disabled={!editable} title={`Insert ${field.label}`} onClick={() => editorRef.current && insertLinkedField(editorRef.current, field)}>Insert</button><button type="button" disabled={!editable} title="Convert every occurrence to fixed text" onClick={() => { if (!editorRef.current) return; convertLinkedFieldToFixed(editorRef.current, field.key); const next = bindingsRef.current.map((item) => item.key === field.key ? { ...item, overridden: true } : item); bindingsRef.current = next; setBindings(next); markDirty(); }}>Fix</button></div></div>; })}</section>)}</div> : null}
          {activePanel === "page" ? <div className="me-page-panel"><div className="me-panel-intro"><div><h3>Page setup</h3><p>A4 guides are live; exact pagination is calculated for preview and export.</p></div></div><label>Orientation<select value={pageSettings.orientation} disabled={!editable} onChange={(event) => changePageSettings({ orientation: event.target.value as "portrait" | "landscape" })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><fieldset><legend>Margins (mm)</legend><div className="me-margin-grid">{([['marginTopMm','Top'],['marginRightMm','Right'],['marginBottomMm','Bottom'],['marginLeftMm','Left']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min="5" max="60" step="0.1" value={pageSettings[key]} disabled={!editable} onChange={(event) => changePageSettings({ [key]: Number(event.target.value) })} /></label>)}</div></fieldset><label>Header<input value={pageSettings.headerText} disabled={!editable} onChange={(event) => changePageSettings({ headerText: event.target.value })} placeholder="Optional header text" /></label><label>Footer<input value={pageSettings.footerText} disabled={!editable} onChange={(event) => changePageSettings({ footerText: event.target.value })} placeholder="Optional footer text" /></label><label className="me-switch-row"><span><strong>Page numbers</strong><small>Centered in exported footer</small></span><input type="checkbox" checked={pageSettings.pageNumbers} disabled={!editable} onChange={(event) => changePageSettings({ pageNumbers: event.target.checked })} /></label><label className="me-switch-row"><span><strong>Ruler and margins</strong><small>Show print alignment guides</small></span><input type="checkbox" checked={pageSettings.showRuler} onChange={(event) => changePageSettings({ showRuler: event.target.checked })} /></label><label className="me-switch-row"><span><strong>5 mm alignment grid</strong><small>Guide only; never exported</small></span><input type="checkbox" checked={pageSettings.showGrid} onChange={(event) => changePageSettings({ showGrid: event.target.checked })} /></label><div className="me-preset-card"><span>Talikha formatting preset</span><strong>Clean manuscript</strong><p>A4, 25.4 mm margins, 12 pt serif, 1.5 spacing, 6 pt paragraph spacing, and print-ready heading hierarchy.</p><button type="button" disabled={!editable} onClick={() => { changePageSettings({ ...defaultManuscriptPageSettings }); if (editorRef.current) applyTalikhaPreset(editorRef.current); }}>Apply preset</button><small>Never applied automatically</small></div></div> : null}
          {activePanel === "compare" ? <div className="me-compare-panel"><div className="me-panel-intro"><div><h3>Conversion check</h3><p>Review the immutable original beside the editable reconstruction.</p></div></div>{importReport ? <><div className="me-comparison-score"><strong>{Math.round(importReport.normalizedTextCoverage * 100)}%</strong><span>normalized text coverage</span></div><dl className="me-compare-counts"><div><dt>Original paragraphs</dt><dd>{importReport.sourceParagraphs}</dd></div><div><dt>Editor paragraphs</dt><dd>{metrics.paragraphs}</dd></div><div><dt>Differences</dt><dd>{findings.length}</dd></div><div><dt>Flagged pages</dt><dd>{importReport.lowConfidencePages.length}</dd></div></dl><button type="button" className="me-primary-button" onClick={() => { setComparisonOpen(true); void ensureSource().catch((reason) => setError(reason.message)); }}>Open comparison workspace</button>{warnings.length ? <Notice tone="warning">Automatic warnings guide review but never block editing.</Notice> : <Notice tone="success">No import warnings were detected. Manual verification is still required.</Notice>}</> : <><Notice>Import the source manuscript before comparing.</Notice><button type="button" className="me-primary-button" disabled={!editable} onClick={() => void runImport()}>Import original</button></>}</div> : null}
          {activePanel === "history" ? <div className="me-history-panel"><div className="me-panel-intro"><div><h3>Version history</h3><p>Imports, checkpoints, restores, and finals are immutable.</p></div><button type="button" title="Create checkpoint" disabled={!editable} onClick={() => void checkpoint()}><Save size={16} /></button></div><div className="me-history-timeline">{detail.versions.length ? detail.versions.map((version) => <article key={version.id}><span className={`me-version-dot is-${version.kind}`} /><div><header><strong>Version {version.versionNumber}</strong><span>{version.kind}</span></header><p>{version.changeSummary || "No change summary"}</p><small>{dateTime(version.createdAt)}{version.createdByName ? ` · ${version.createdByName}` : ""}</small><footer>{version.docxFileId ? <a href={`/api/admin/files/${version.docxFileId}?download=1`}>DOCX</a> : null}{version.pdfFileId ? <a href={`/api/admin/files/${version.pdfFileId}?download=1`}>PDF</a> : null}<button type="button" disabled={!editable || version.id === detail.document.currentVersionId} onClick={() => void restoreVersion(version.id, version.versionNumber)}>Restore as new</button></footer></div></article>) : <div className="me-empty-history"><Clock3 size={20} />The first import creates version 1.</div>}</div></div> : null}
        </div>
      </aside>
    </div>

    <footer className="me-status-bar"><span>Page estimate <strong>{pageEstimate}</strong></span><span>Words <strong>{metrics.words.toLocaleString()}</strong></span><span>Characters <strong>{metrics.characters.toLocaleString()}</strong></span><span>Paragraphs <strong>{metrics.paragraphs.toLocaleString()}</strong></span><span>Selected <strong>{metrics.selectedWords.toLocaleString()}</strong></span><label>Zoom<input type="range" min="50" max="200" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><strong>{zoom}%</strong></label><button type="button" onClick={() => setZoom(100)}>Actual size</button><button type="button" onClick={() => setZoom(80)}>Fit width</button><span className={`me-status-save is-${saveState}`}>{stateLabel(saveState)}</span></footer>

    {finalizeOpen ? <div className="me-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !finalizing) setFinalizeOpen(false); }}><section className="me-finalize-dialog" role="dialog" aria-modal="true" aria-labelledby="finalize-title"><header><div><span className="me-eyebrow">Immutable output</span><h2 id="finalize-title">Finalize and attach manuscript</h2></div><button type="button" aria-label="Close" disabled={finalizing} onClick={() => setFinalizeOpen(false)}><X size={17} /></button></header><Notice tone="warning"><strong>Manual-first quality control</strong><p>Confirm each item against the immutable original. Automatic checks assist this review but do not replace it.</p></Notice><div className="me-finalize-checklist">{manuscriptVerificationKeys.map((key) => <label key={key}><input type="checkbox" checked={confirmations[key] === true} onChange={(event) => { const next = { ...confirmationsRef.current, [key]: event.target.checked }; confirmationsRef.current = next; setConfirmations(next); markDirty(); }} /><span><Check size={15} />{verificationLabels[key]}</span></label>)}</div><label className="me-finalize-summary">Version summary<textarea value={finalizeSummary} maxLength={500} onChange={(event) => setFinalizeSummary(event.target.value)} /></label><div className="me-finalize-output"><div><FileText size={20} /><span><strong>Production DOCX</strong><small>Editable, versioned attachment</small></span></div><div><FileCheck2 size={20} /><span><strong>Searchable PDF</strong><small>Selectable text, publication attachment</small></span></div></div><footer><button type="button" className="me-secondary-button" disabled={finalizing} onClick={() => setFinalizeOpen(false)}>Cancel</button><button type="button" className="me-finalize-button" disabled={finalizing || manuscriptVerificationKeys.some((key) => confirmations[key] !== true)} onClick={() => void finalize()}>{finalizing ? <RefreshCw size={16} /> : <FileCheck2 size={16} />}{finalizing ? "Generating both files…" : "Finalize & attach both files"}</button></footer></section></div> : null}
    {finalFiles ? <div className="me-final-files-toast"><CheckCircle2 size={20} /><div><strong>Final manuscript attached</strong><span>Both versioned files are ready.</span></div><a href={finalFiles.docxUrl}>DOCX</a><a href={finalFiles.pdfUrl}>PDF</a><button type="button" onClick={() => setFinalFiles(null)}><X size={15} /></button></div> : null}
  </div>;
}

export default ManuscriptWorkspace;
