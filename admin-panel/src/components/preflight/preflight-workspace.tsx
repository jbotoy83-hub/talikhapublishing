import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Columns2,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import "./preflight-workspace.css";

type Artifact = {
  id: string;
  fileKind: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  versionNumber: number;
  selected: boolean;
};

type PreflightCheck = {
  id: string;
  check_key: string;
  check_group: string;
  title: string;
  mode: "automatic" | "manual" | "calculated";
  blocking: boolean;
  status: "not_reviewed" | "pass" | "confirmed" | "warning" | "fail";
  observed_summary?: string | null;
  evidence: Record<string, unknown>;
  blocker?: { message: string; page?: number; fixAction: string } | null;
  issue_note?: string | null;
  confirmed_at?: string | null;
};

type PreflightDetail = {
  run: { id: string; status: string; automatic_blocker_count: number; warning_count: number; updated_at: string } | null;
  checks: PreflightCheck[];
  blockers: Array<{ code: string; message: string }>;
  artifacts: Artifact[];
  source: Record<string, unknown>;
  final: Record<string, unknown>;
  previewUrl: string;
  permissions: { canEdit: boolean; canSubmit: boolean; canApprove: boolean };
};

const artifactTabs = [
  ["manuscript", "Author original"],
  ["production_manuscript", "Production manuscript"],
  ["final_pdf", "Final PDF"],
  ["peer_review", "Peer-review result"],
  ["publication_certificate", "Certificate"],
  ["social_media_artwork", "Social artwork"],
] as const;

function DocumentPane({ artifact, zoom, rotation, onLoaded }: { artifact?: Artifact; zoom: number; rotation: number; onLoaded: (id: string) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setUrl("");
    setError("");
    if (!artifact) return () => controller.abort();
    fetch(`/api/admin/files/${artifact.id}?stream=1`, { credentials: "same-origin", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`File could not be loaded (${response.status}).`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        onLoaded(artifact.id);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "File could not be loaded.");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artifact, onLoaded]);

  if (!artifact) return <div className="pf-empty"><FileSearch /><strong>No artifact attached</strong><span>Return to the production record and attach or select this file.</span></div>;
  if (error) return <div className="pf-empty pf-error"><AlertCircle /><strong>Artifact unavailable</strong><span>{error}</span></div>;
  if (!url) return <div className="pf-empty"><Loader2 className="pf-spin" /><strong>Loading {artifact.name}</strong></div>;
  const style = { transform: `scale(${zoom}) rotate(${rotation}deg)` };
  if (artifact.mimeType.startsWith("image/")) return <div className="pf-image-stage"><img src={url} alt={artifact.name} style={style} /></div>;
  if (artifact.mimeType === "application/pdf") return <iframe title={artifact.name} src={`${url}#toolbar=0&navpanes=0&view=FitH`} style={style} />;
  return <div className="pf-empty"><FileSearch /><strong>{artifact.name}</strong><span>This format opens through the secure download control.</span></div>;
}

function ComparisonValue({ label, source, final }: { label: string; source: unknown; final: unknown }) {
  const expected = Array.isArray(source) ? `${source.length} author record(s)` : String(source || "Not supplied");
  const observed = Array.isArray(final) ? `${final.length} linked profile(s)` : String(final || "Not set");
  const matches = expected.trim().toLocaleLowerCase() === observed.trim().toLocaleLowerCase();
  return <div className="pf-compare-value"><span>{label}</span><div><small>Submitted</small><strong>{expected}</strong></div><div><small>Final</small><strong>{observed}</strong></div>{matches && <em><Check size={12} /> Same</em>}</div>;
}

export function PreflightWorkspace({ submissionId, reference, title, onClose, onSubmitted }: {
  submissionId: string;
  reference: string;
  title: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [detail, setDetail] = useState<PreflightDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [activeKind, setActiveKind] = useState("manuscript");
  const [compare, setCompare] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selectedCheck, setSelectedCheck] = useState(0);
  const [loadedArtifacts, setLoadedArtifacts] = useState<Set<string>>(new Set());
  const [previewOpened, setPreviewOpened] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"documents" | "checklist">("documents");
  const [issueCheck, setIssueCheck] = useState<PreflightCheck | null>(null);
  const [issueNote, setIssueNote] = useState("");
  const [peerRows, setPeerRows] = useState([{ criterion: "", awarded: 0, maximum: 0 }]);
  const [peerDate, setPeerDate] = useState("");
  const [displayedTotal, setDisplayedTotal] = useState(0);
  const rightRef = useRef<HTMLDivElement>(null);

  const load = async (run = false) => {
    setSyncing(run);
    setMessage("");
    const response = await fetch(`/api/admin/submissions/${submissionId}/preflight`, { method: run ? "POST" : "GET", credentials: "same-origin" }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setLoading(false);
    setSyncing(false);
    if (!response?.ok || !body) {
      setMessage(body?.error || "Quality control could not be loaded.");
      return;
    }
    setDetail(body);
    if (!run && !body.run) void load(true);
  };

  useEffect(() => { void load(false); }, [submissionId]);
  const artifactsByKind = useMemo(() => new Map((detail?.artifacts || []).filter((item) => item.selected).map((item) => [item.fileKind, item])), [detail]);
  const activeArtifact = artifactsByKind.get(activeKind);
  const originalArtifact = artifactsByKind.get("manuscript");
  const finalArtifact = artifactsByKind.get("final_pdf");
  const grouped = useMemo(() => {
    const groups = new Map<string, PreflightCheck[]>();
    for (const check of detail?.checks || []) groups.set(check.check_group, [...(groups.get(check.check_group) || []), check]);
    return [...groups.entries()];
  }, [detail]);
  const orderedChecks = detail?.checks || [];
  const blockers = orderedChecks.filter((check) => check.blocking && (check.status === "fail" || check.status === "not_reviewed")).length;
  const ready = detail?.run?.status === "ready";
  const submitted = detail?.run?.status === "submitted";

  const artifactLoadedFor = (check: PreflightCheck) => {
    const artifactId = typeof check.evidence?.artifactId === "string" ? check.evidence.artifactId : "";
    const artifactKind = String(check.evidence?.artifactKind || "");
    if (artifactKind === "public_preview") return previewOpened;
    return Boolean(artifactId && loadedArtifacts.has(artifactId));
  };

  const saveCheck = async (check: PreflightCheck, status: "not_reviewed" | "confirmed" | "fail", note = "", evidence?: Record<string, unknown>) => {
    if (!detail) return;
    const before = detail;
    setDetail({ ...detail, checks: detail.checks.map((item) => item.id === check.id ? { ...item, status, issue_note: note } : item) });
    const response = await fetch(`/api/admin/submissions/${submissionId}/preflight/checks/${check.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, issueNote: note || undefined, evidence }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body) {
      setDetail(before);
      setMessage(body?.error || "The check could not be saved; its previous state was restored.");
      return;
    }
    setDetail(body);
    setMessage(status === "confirmed" ? "Check confirmed and synced." : status === "fail" ? "Issue saved as a publication blocker." : "Check reopened.");
  };

  const openCheck = (check: PreflightCheck) => {
    const kind = String(check.evidence?.artifactKind || "");
    if (kind === "public_preview") {
      window.open(detail?.previewUrl, "_blank", "noopener,noreferrer");
      setPreviewOpened(true);
    } else if (kind) setActiveKind(kind);
    const index = orderedChecks.findIndex((item) => item.id === check.id);
    if (index >= 0) setSelectedCheck(index);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") setCompare(false);
      if (/^[1-6]$/.test(event.key)) setActiveKind(artifactTabs[Number(event.key) - 1][0]);
      if (event.key === "j" || event.key === "ArrowDown") setSelectedCheck((value) => Math.min(orderedChecks.length - 1, value + 1));
      if (event.key === "k" || event.key === "ArrowUp") setSelectedCheck((value) => Math.max(0, value - 1));
      if (event.key === " " && orderedChecks[selectedCheck]?.mode !== "automatic") {
        event.preventDefault();
        const check = orderedChecks[selectedCheck];
        if (artifactLoadedFor(check)) void saveCheck(check, "confirmed");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orderedChecks, selectedCheck, loadedArtifacts, previewOpened]);

  const submit = async () => {
    setSyncing(true);
    const response = await fetch(`/api/admin/submissions/${submissionId}/preflight/submit`, { method: "POST", credentials: "same-origin" }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setSyncing(false);
    if (!response?.ok || !body) {
      setMessage(body?.error || "The publication could not be submitted.");
      return;
    }
    setDetail(body);
    setMessage("Locked quality-control evidence submitted for administrator approval.");
    onSubmitted();
  };

  if (loading) return <div className="pf-shell pf-loading"><Loader2 className="pf-spin" /><strong>Preparing publication quality control…</strong></div>;
  return <div className="pf-shell">
    <header className="pf-topbar">
      <button type="button" className="pf-back" onClick={onClose}><ArrowLeft /> Back to publication record</button>
      <div className="pf-title"><span>{reference}</span><strong>{title}</strong></div>
      <div className="pf-sync">{syncing ? <><Loader2 className="pf-spin" /> Syncing</> : <><ShieldCheck /> Saved</>}</div>
      <span className={`pf-state pf-state-${detail?.run?.status || "not_started"}`}>{(detail?.run?.status || "not started").replaceAll("_", " ")}</span>
      <span className="pf-count">{blockers} blocker{blockers === 1 ? "" : "s"}</span>
      <button type="button" className="pf-submit" disabled={!ready || syncing || submitted} onClick={() => void submit()}>{submitted ? "Submitted" : "Submit for approval"}</button>
    </header>
    <nav className="pf-mobile-switch" aria-label="Quality-control workspace panels">
      <button type="button" className={mobilePanel === "documents" ? "active" : ""} onClick={() => setMobilePanel("documents")}>Documents</button>
      <button type="button" className={mobilePanel === "checklist" ? "active" : ""} onClick={() => setMobilePanel("checklist")}>Checklist <span>{blockers}</span></button>
    </nav>

    <main className={`pf-main show-${mobilePanel}`}>
      <section className="pf-document">
        <nav className="pf-tabs" aria-label="Publication artifacts">
          {artifactTabs.map(([kind, label], index) => <button type="button" key={kind} className={activeKind === kind ? "active" : ""} onClick={() => { setActiveKind(kind); setCompare(false); }}><span>{index + 1}</span>{label}{!artifactsByKind.has(kind) && <i />}</button>)}
        </nav>
        <div className="pf-toolbar">
          <div><button type="button" title="Search document"><Search /></button><button type="button" onClick={() => setZoom((value) => Math.max(.6, value - .1))}><ZoomOut /></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + .1))}><ZoomIn /></button><button type="button" onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw /></button></div>
          <div><button type="button" className={compare ? "active" : ""} disabled={!originalArtifact || !finalArtifact} onClick={() => setCompare((value) => !value)}><Columns2 /> Compare</button>{activeArtifact && <a href={`/api/admin/files/${activeArtifact.id}`} download={activeArtifact.name}><Download /> Download</a>}</div>
        </div>
        <div className={`pf-stage${compare ? " comparing" : ""}`}>
          {compare ? <>
            <div className="pf-stage-column"><span>Author original</span><DocumentPane artifact={originalArtifact} zoom={zoom} rotation={rotation} onLoaded={(id) => setLoadedArtifacts((current) => new Set(current).add(id))} /></div>
            <div className="pf-stage-column"><span>Final PDF</span><DocumentPane artifact={finalArtifact} zoom={zoom} rotation={rotation} onLoaded={(id) => setLoadedArtifacts((current) => new Set(current).add(id))} /></div>
          </> : <DocumentPane artifact={activeArtifact} zoom={zoom} rotation={rotation} onLoaded={(id) => setLoadedArtifacts((current) => new Set(current).add(id))} />}
        </div>
        <footer className="pf-document-footer"><span>{activeArtifact ? `${activeArtifact.name} · version ${activeArtifact.versionNumber}` : "No current artifact"}</span><button type="button" onClick={() => void load(true)}><RefreshCw /> Rerun automatic checks</button></footer>
      </section>

      <aside className="pf-review" ref={rightRef}>
        <section className={`pf-summary ${ready || submitted ? "ready" : "blocked"}`}>
          {ready || submitted ? <CheckCircle2 /> : <AlertCircle />}
          <div><span>Publication quality control</span><h2>{submitted ? "Submitted" : ready ? "Ready" : "Blocked"}</h2><p>{submitted ? "This evidence snapshot is locked for administrator review." : ready ? "All required checks are current. Submit the locked snapshot for approval." : `${blockers} required check${blockers === 1 ? " is" : "s are"} preventing approval.`}</p></div>
        </section>
        {message && <p className="pf-message" role="status">{message}</p>}
        <section className="pf-source-card">
          <header><div><span>Immutable source record</span><h3>Author submission</h3></div><ShieldCheck /></header>
          <ComparisonValue label="Title" source={detail?.source.title} final={detail?.final.title} />
          <ComparisonValue label="Authors" source={detail?.source.authors} final={detail?.final.authors} />
          <ComparisonValue label="Affiliation" source={detail?.source.affiliation} final={detail?.final.affiliation} />
          <ComparisonValue label="DOI" source="Not assigned by author" final={detail?.final.doi} />
          <ComparisonValue label="Pages" source="Not assigned" final={detail?.final.pages} />
          <a href={detail?.previewUrl} target="_blank" rel="noreferrer" onClick={() => setPreviewOpened(true)}><ExternalLink /> Open protected public preview</a>
        </section>
        <div className="pf-check-groups">
          {grouped.map(([group, checks]) => <section key={group} className="pf-check-group">
            <header><h3>{group}</h3><span>{checks.filter((check) => check.status === "pass" || check.status === "confirmed").length}/{checks.length}</span></header>
            {checks.map((check) => {
              const selected = orderedChecks[selectedCheck]?.id === check.id;
              const canConfirm = check.mode !== "automatic" && artifactLoadedFor(check) && !submitted;
              return <article key={check.id} className={`pf-check pf-check-${check.status}${selected ? " selected" : ""}`} onClick={() => openCheck(check)}>
                <button type="button" className="pf-check-state" aria-label={check.status} disabled={check.mode === "automatic" || !canConfirm} onClick={(event) => { event.stopPropagation(); void saveCheck(check, check.status === "confirmed" ? "not_reviewed" : "confirmed"); }}>
                  {check.status === "pass" || check.status === "confirmed" ? <Check /> : check.status === "fail" ? <X /> : <span />}
                </button>
                <div><strong>{check.title}</strong><small>{check.mode === "automatic" ? "Automatic" : check.mode === "calculated" ? "Calculated from entered evidence" : canConfirm ? "Ready for confirmation" : "Open the evidence before confirming"}</small>{check.blocker?.message && <p>{check.blocker.message}</p>}{check.observed_summary && <p>{check.observed_summary}</p>}</div>
                {check.mode !== "automatic" && <div className="pf-check-actions">
                  {check.check_key === "peer.scores" && <button type="button" onClick={(event) => { event.stopPropagation(); openCheck(check); setIssueCheck(check); }}>Enter scores</button>}
                  <button type="button" disabled={submitted} onClick={(event) => { event.stopPropagation(); setIssueCheck(check); setIssueNote(check.issue_note || ""); }}>Issue</button>
                </div>}
              </article>;
            })}
          </section>)}
        </div>
        <div className="pf-sticky"><button type="button" disabled={!ready || syncing || submitted} onClick={() => void submit()}>{submitted ? "Submitted for approval" : ready ? "Submit locked snapshot for approval" : `Resolve ${blockers} blocker${blockers === 1 ? "" : "s"}`}</button></div>
      </aside>
    </main>

    {issueCheck && <div className="pf-dialog-backdrop" role="presentation" onMouseDown={() => setIssueCheck(null)}>
      <section className="pf-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>{issueCheck.check_group}</span><h2>{issueCheck.check_key === "peer.scores" ? "Peer-review evidence" : "Record a quality issue"}</h2></div><button type="button" onClick={() => setIssueCheck(null)}><X /></button></header>
        {issueCheck.check_key === "peer.scores" ? <>
          <div className="pf-score-meta"><label>Review date shown<input type="date" value={peerDate} onChange={(event) => setPeerDate(event.target.value)} /></label><label>Displayed total<input type="number" min="0" max="100" value={displayedTotal} onChange={(event) => setDisplayedTotal(Number(event.target.value))} /></label></div>
          <div className="pf-score-table"><div><span>Criterion</span><span>Awarded</span><span>Maximum</span></div>{peerRows.map((row, index) => <div key={index}><input value={row.criterion} onChange={(event) => setPeerRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, criterion: event.target.value } : item))} /><input type="number" value={row.awarded} onChange={(event) => setPeerRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, awarded: Number(event.target.value) } : item))} /><input type="number" value={row.maximum} onChange={(event) => setPeerRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, maximum: Number(event.target.value) } : item))} /></div>)}</div>
          <button type="button" className="pf-add-row" onClick={() => setPeerRows((rows) => [...rows, { criterion: "", awarded: 0, maximum: 0 }])}>+ Add criterion</button>
          <div className="pf-score-total"><span>Calculated</span><strong>{peerRows.reduce((sum, row) => sum + row.awarded, 0)} / {peerRows.reduce((sum, row) => sum + row.maximum, 0)}</strong></div>
          <button type="button" className="pf-dialog-primary" onClick={() => { void saveCheck(issueCheck, "confirmed", "", { rows: peerRows, reviewDate: peerDate, displayedTotal }); setIssueCheck(null); }}>Validate and save scores</button>
        </> : <>
          <p>Describe exactly what must be corrected. This note is internal and immediately blocks approval.</p>
          <textarea autoFocus maxLength={1000} value={issueNote} onChange={(event) => setIssueNote(event.target.value)} placeholder="Example: The DOI on page 1 still shows the previous value." />
          <button type="button" className="pf-dialog-danger" disabled={!issueNote.trim()} onClick={() => { void saveCheck(issueCheck, "fail", issueNote); setIssueCheck(null); }}>Save as blocker</button>
        </>}
      </section>
    </div>}
  </div>;
}
