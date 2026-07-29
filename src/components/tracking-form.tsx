"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Search, Download, Award, FileText, MessageSquare } from "lucide-react";

type AuthorRequest = {
  id: string;
  title: string;
  description: string;
  request_type: string;
  status: string;
  due_at: string | null;
  response_choice: "yes" | "no" | null;
  responded_at: string | null;
};

type TrackingResult = {
  trackingNumber: string;
  reference: string;
  title: string;
  currentStageLabel: string;
  progress: { label: string; complete: boolean; current: boolean }[];
  events: { id: string; public_title: string | null; public_description: string | null; created_at: string }[];
  requests: AuthorRequest[];
  files: { id: string; file_kind: string; original_name: string; mime_type: string; size_bytes: number; url: string }[];
  certificates: { certificate_number: string; status: string; issued_at: string | null; holder_name: string; work_title: string; download_url: string | null }[];
  reviewEvents: { id: string; public_title: string | null; public_description: string | null; created_at: string }[];
};

type Lookup = { reference: string };

export function TrackingForm() {
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  async function trackReference(nextReference: string) {
    const cleanedReference = nextReference.trim();
    if (!cleanedReference) return;
    setPending(true);
    setError("");
    setResult(null);
    const response = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: cleanedReference })
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(body?.error || "Tracking is temporarily unavailable. Please try again.");
      return;
    }
    setLookup({ reference: cleanedReference });
    setResult(body as TrackingResult);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextReference = reference.trim();
    window.history.replaceState(null, "", `/track?reference=${encodeURIComponent(nextReference)}`);
    await trackReference(nextReference);
  }

  useEffect(() => {
    const suppliedReference = new URLSearchParams(window.location.search).get("reference")?.trim();
    if (!suppliedReference) return;
    setReference(suppliedReference);
    void trackReference(suppliedReference);
  }, []);

  async function respondToRequest(requestId: string, choice: "yes" | "no") {
    if (!lookup) return;
    setError("");
    setRespondingId(requestId);
    const response = await fetch("/api/track/requests/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: lookup.reference, requestId, choice })
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setRespondingId(null);
    if (!response?.ok) {
      setError(body?.error || "We could not record that response. Please try again.");
      return;
    }
    setResult((current) => current ? {
      ...current,
      requests: current.requests.map((request) => request.id === requestId ? {
        ...request,
        status: body.request.status,
        response_choice: body.request.response_choice,
        responded_at: body.request.responded_at
      } : request)
    } : current);
  }

  return <div className="w-full">
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="grid gap-2 text-sm font-medium text-slate-700">Submission reference<input required name="reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="TAL-2026-XXXXXXXX" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100" /></label>
      <button disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}{pending ? "Checking" : "Track study"}</button>
    </form>
    <p className="mt-3 text-sm text-slate-500">Your submission reference is your tracking ticket. Open its link directly whenever you need to check your record.</p>
    {error ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</p> : null}
    {result ? <TrackingResultPanel result={result} respondingId={respondingId} onRespond={respondToRequest} /> : null}
  </div>;
}

function TrackingResultPanel({ result, respondingId, onRespond }: { result: TrackingResult; respondingId: string | null; onRespond: (requestId: string, choice: "yes" | "no") => void }) {
  return <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-violet-700">Submission status</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{result.title}</h2><p className="mt-2 text-sm text-slate-500">{result.reference} <span aria-hidden="true">·</span> {result.trackingNumber}</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700">{result.currentStageLabel}</span></div>
    <ol className="mt-7 grid gap-3 sm:grid-cols-5">{result.progress.map((step) => <li key={step.label} className="relative"><div className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium ${step.current ? "bg-violet-600 text-white" : step.complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>{step.complete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <span className={`h-2 w-2 rounded-full ${step.current ? "bg-white" : "bg-slate-300"}`} />}{step.label}</div></li>)}</ol>
    <div className={result.requests.length ? "mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]" : "mt-8"}>
      <section><h3 className="text-base font-semibold text-slate-900">Activity</h3><div className="mt-4 space-y-4">{result.events.map((event) => <article key={event.id} className="border-l-2 border-violet-200 pl-4"><p className="text-sm font-semibold text-slate-800">{event.public_title || "Editorial update"}</p><p className="mt-1 text-sm leading-6 text-slate-600">{event.public_description || "Your record has been updated."}</p><time className="mt-2 block text-xs text-slate-500">{new Date(event.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</time></article>)}{!result.events.length ? <p className="text-sm leading-6 text-slate-500">There are no author-visible updates yet. Your progress is shown above.</p> : null}</div></section>
      {result.requests.length > 0 ? <aside className="rounded-lg bg-slate-50 p-4"><h3 className="text-sm font-semibold text-slate-900">Action required</h3><div className="mt-3 space-y-4">{result.requests.map((request) => <article key={request.id} className="border-b border-slate-200 pb-4 last:border-0 last:pb-0"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-800">{request.title}</p>{request.response_choice ? <span className={`rounded-full px-2 py-1 text-xs font-semibold ${request.response_choice === "yes" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{request.response_choice === "yes" ? "Approved" : "Declined"}</span> : null}</div><p className="mt-1 text-sm leading-6 text-slate-600">{request.description}</p><p className="mt-1 text-xs font-medium capitalize text-violet-700">{request.status.replaceAll("_", " ")}{request.due_at ? ` · Due ${new Date(request.due_at).toLocaleDateString("en-PH")}` : ""}</p>{request.status === "open" ? <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={respondingId === request.id} onClick={() => onRespond(request.id, "yes")} className="min-h-9 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{respondingId === request.id ? "Saving…" : "Yes, approve"}</button><button type="button" disabled={respondingId === request.id} onClick={() => onRespond(request.id, "no")} className="min-h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60">No, decline</button></div> : request.responded_at ? <p className="mt-2 text-xs text-slate-500">Response recorded {new Date(request.responded_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p> : null}</article>)}</div></aside> : null}
    </div>

    {result.files.length > 0 && <section className="mt-8"><h3 className="flex items-center gap-2 text-base font-semibold text-slate-900"><FileText className="h-4 w-4 text-violet-600" /> Manuscript &amp; files</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{result.files.map((f) => <a key={f.id} href={f.url} download={f.original_name} className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-violet-300 hover:bg-violet-50 hover:shadow-sm"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-violet-100 text-violet-700 transition group-hover:bg-violet-200"><Download className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{f.original_name}</span><span className="text-xs text-slate-500">{f.file_kind === "authorPhoto" ? "Profile photo" : f.file_kind === "manuscript" ? "Manuscript" : f.file_kind} · {(f.size_bytes / 1024).toFixed(0)} KB</span></span></a>)}</div></section>}

    {result.certificates.length > 0 && <section className="mt-8"><h3 className="flex items-center gap-2 text-base font-semibold text-slate-900"><Award className="h-4 w-4 text-amber-600" /> Certificate</h3><div className="mt-3 space-y-3">{result.certificates.map((cert) => <div key={cert.certificate_number} className={`rounded-lg border p-4 transition ${cert.status === "issued" ? "border-emerald-200 bg-emerald-50" : cert.status === "revoked" ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{cert.certificate_number}</p><p className="mt-1 text-xs text-slate-600">{cert.holder_name}{cert.work_title ? ` — ${cert.work_title}` : ""}</p>{cert.issued_at && <p className="mt-1 text-xs text-slate-500">Issued {new Date(cert.issued_at).toLocaleDateString("en-PH", { dateStyle: "long" })}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${cert.status === "issued" ? "bg-emerald-100 text-emerald-800" : cert.status === "revoked" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>{cert.status}</span></div>{cert.download_url && <a href={cert.download_url} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md"><Download className="h-4 w-4" /> Download certificate</a>}</div>)}</div></section>}

    {result.reviewEvents.length > 0 && <section className="mt-8"><h3 className="flex items-center gap-2 text-base font-semibold text-slate-900"><MessageSquare className="h-4 w-4 text-blue-600" /> Peer review</h3><div className="mt-3 space-y-3">{result.reviewEvents.map((event) => <article key={event.id} className="border-l-2 border-blue-200 pl-4"><p className="text-sm font-semibold text-slate-800">{event.public_title || "Review update"}</p><p className="mt-1 text-sm leading-6 text-slate-600">{event.public_description || ""}</p><time className="mt-1 block text-xs text-slate-500">{new Date(event.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</time></article>)}</div></section>}

  </section>;
}
