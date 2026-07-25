"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Clock3, FileCheck2, FileText, PenLine, Search, ShieldCheck, Sparkles } from "lucide-react";

const submissionKey = "talikha-editorial-submissions-v1";

type StageKey = "review" | "progress" | "polishing" | "published";

const stages: { key: StageKey; label: string; icon: typeof FileText; description: string; statuses: string[] }[] = [
  { key: "review", label: "Editorial Review", icon: FileCheck2, description: "Our editorial team checks your submission for scope, originality, and formatting.", statuses: ["New"] },
  { key: "progress", label: "In Progress", icon: PenLine, description: "Your manuscript is being evaluated by our editorial board and reviewers.", statuses: ["In progress", "Review"] },
  { key: "polishing", label: "Revision & Proofing", icon: Sparkles, description: "Accepted manuscripts go through revision rounds, approval, and final proofing.", statuses: ["Accepted", "For approval", "Revise", "Scheduled for publishing"] },
  { key: "published", label: "Published", icon: FileText, description: "Your work is now live and accessible to readers worldwide.", statuses: ["Published"] },
];

type LocalSubmission = {
  id: string;
  title: string;
  author: string;
  email: string;
  journal: string;
  status: string;
  displayDate: string;
  submittedAt: string;
  history?: string[];
};

function currentStage(status: string) {
  return stages.find((s) => s.statuses.includes(status)) || stages[0];
}

function stageDate(submission: LocalSubmission, stage: typeof stages[number]) {
  const entry = [...(submission.history || [])].reverse().find((item) =>
    stage.statuses.some((s) => item.includes(`Moved to ${s}`)),
  );
  if (entry?.includes(" · ")) {
    const recordedAt = entry.split(" · ").at(-1) || "";
    const date = new Date(recordedAt);
    return Number.isNaN(date.valueOf())
      ? recordedAt.replace(/,?\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?$/i, "")
      : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  }
  return stage.key === "review" ? submission.displayDate : null;
}

export function LocalTrackingForm() {
  const [reference, setReference] = useState("");
  const [submission, setSubmission] = useState<LocalSubmission | null>(null);
  const [error, setError] = useState("");

  function findSubmission(value: string) {
    try {
      const records = JSON.parse(localStorage.getItem(submissionKey) || "[]");
      return Array.isArray(records) ? records.find((r) => String(r.id).toUpperCase() === value.trim().toUpperCase()) || null : null;
    } catch { return null; }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const record = findSubmission(reference);
    setSubmission(record);
    setError(record ? "" : "We could not find that reference on this device. Check the reference and try again.");
  }

  useEffect(() => {
    const supplied = new URLSearchParams(window.location.search).get("reference")?.trim();
    if (!supplied) return;
    const record = findSubmission(supplied);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads URL ?reference= on mount; cannot read window.location during SSR render
    setReference(supplied);
    setSubmission(record);
    setError(record ? "" : "We could not find that reference on this device.");
  }, []);

  useEffect(() => {
    const sync = () => { if (!submission) return; const updated = findSubmission(submission.id); if (updated) setSubmission(updated); };
    window.addEventListener("storage", sync);
    const timer = window.setInterval(sync, 1500);
    return () => { window.removeEventListener("storage", sync); window.clearInterval(timer); };
  }, [submission]);

  const stage = submission ? currentStage(submission.status) : null;
  const stageIndex = stage ? stages.findIndex((s) => s.key === stage.key) : -1;

  return (
    <div className="track-form-wrap">
      {/* Search form */}
      <form onSubmit={submit} className="track-search-card">
        <label className="track-search-label">
          <Search className="h-4 w-4 text-[#6b756d]" />
          <span>Submission reference</span>
        </label>
        <div className="track-search-row">
          <input required value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TP-2026-XXXXXXXX" className="track-search-input" />
          <button type="submit" className="track-search-btn">Track submission</button>
        </div>
      </form>
      <p className="track-search-hint"><ShieldCheck className="h-4 w-4" />Your reference opens only its matching local submission record on this device.</p>
      {error ? <p role="alert" className="track-error">{error}</p> : null}

      {/* Results */}
      {submission && stage && (
        <section className="track-results">
          {/* Submission header */}
          <div className="track-results-header">
            <span className={`track-status-badge ${stage.key === "published" ? "published" : stage.key === "polishing" ? "polishing" : "active"}`}>{stage.label}</span>
            <p className="track-eyebrow">Submission progress</p>
            <h2 className="track-title">{submission.title}</h2>
            <p className="track-subtitle">{submission.journal} · {submission.id}</p>
          </div>

          {/* Timeline */}
          <div className="track-timeline">
            {stages.map((s, i) => {
              const Icon = s.icon;
              const complete = i < stageIndex;
              const isCurrent = i === stageIndex;
              const date = stageDate(submission, s);
              const stateLabel = complete ? "Complete" : isCurrent ? "Current" : "Pending";
              return (
                <div key={s.key} className={`track-step ${complete ? "complete" : ""} ${isCurrent ? "current" : ""}`}>
                  <div className="track-step-top">
                    <span className="track-step-icon">
                      {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="track-step-state">{stateLabel}</span>
                  </div>
                  <h3 className="track-step-title">{s.label}</h3>
                  <p className="track-step-desc">{s.description}</p>
                  <time className="track-step-date"><Clock3 className="h-3.5 w-3.5" />{date || (i <= stageIndex ? submission.displayDate : "Pending")}</time>
                  {i < stages.length - 1 && <span className={`track-step-arrow ${complete ? "filled" : ""}`} aria-hidden="true">→</span>}
                </div>
              );
            })}
          </div>

          {/* Activity log */}
          {submission.history && submission.history.length > 0 && (
            <div className="track-history">
              <h3 className="track-history-title">Activity log</h3>
              <ol className="track-history-list">
                {[...submission.history].reverse().map((entry, i) => (
                  <li key={i} className="track-history-item">
                    <span className="track-history-dot" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
