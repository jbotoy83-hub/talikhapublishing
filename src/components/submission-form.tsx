"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { submissionFileRules } from "@/lib/submission";
import { Icon } from "./icon";
import { TurnstileWidget } from "./turnstile-widget";

type FileField = "manuscript" | "authorPhoto" | "paymentProof";
type Upload = { key: string; field: FileField; file: File; name: string };
type UploadInstruction = { key: string; field: FileField; path: string; token: string };
type JournalOption = { id: string; slug: string; title: string; description: string; scope: string; accent: string; issue: { id: string; volume: string; number: string } };
type Author = { id: string; saved: boolean; firstName: string; middleInitial: string; surname: string; academicTitle: string; email: string; institution: string; orcid: string };
type ReviewSection = { title: string; rows: Array<[string, string]> };

const steps = ["Manuscript", "Authors", "Review", "Complete"];
const sampleSubmissionKey = "talikha-editorial-submissions-v1";
const fileKey = () => Math.random().toString(36).slice(2, 12);
const createAuthor = (id: string): Author => ({ id, saved: false, firstName: "", middleInitial: "", surname: "", academicTitle: "", email: "", institution: "", orcid: "" });
const valueFor = (form: HTMLFormElement, name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || "";
const fileBadge = (file: File) => file.name.split(".").pop()?.toUpperCase() || "FILE";

export function SubmissionForm({ journals, turnstileSiteKey, previewMode = false, sampleMode = false }: { journals: JournalOption[]; turnstileSiteKey: string; previewMode?: boolean; sampleMode?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const authorSequence = useRef(2);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [successEmail, setSuccessEmail] = useState("");
  const [selectedJournal, setSelectedJournal] = useState("");
  const [previewJournal, setPreviewJournal] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [authors, setAuthors] = useState<Author[]>([createAuthor("author-1")]);
  const [authorErrors, setAuthorErrors] = useState<string[]>([]);
  const [review, setReview] = useState<ReviewSection[]>([]);
  const [turnstileToken, setTurnstileToken] = useState(previewMode ? "preview" : "");
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const selected = journals.find((journal) => journal.slug === selectedJournal);
  const preview = journals.find((journal) => journal.slug === (previewJournal || selectedJournal));
  const savedAuthors = authors.filter((author) => author.saved);

  useEffect(() => {
    const uploadGrid = formRef.current?.querySelector(".submission-manuscript-upload-grid");
    if (!uploadGrid || uploadGrid.parentElement?.querySelector("[data-payment-details]")) return;
    const details = document.createElement("div");
    details.dataset.paymentDetails = "true";
    details.className = "submission-field-grid";
    details.setAttribute("aria-label", "Payment details");
    details.innerHTML = `<label>Payment method *<input name="paymentMethod" required maxlength="40" autocomplete="off" placeholder="e.g. GCash, bank transfer" /></label><label>Payment reference *<input name="paymentReference" required minlength="3" maxlength="200" autocomplete="off" placeholder="Transaction or reference number" /></label>`;
    uploadGrid.insertAdjacentElement("afterend", details);
    return () => details.remove();
  }, []);

  function pickFiles(field: FileField, files: FileList | null) {
    const selectedFiles = Array.from(files || []);
    const rule = submissionFileRules[field];
    const invalid = selectedFiles.find((file) => file.size > rule.max || !(rule.types as readonly string[]).includes(file.type));
    if (invalid) { setState("error"); setMessage(`${invalid.name} is not an accepted ${field === "manuscript" ? "Word" : "file"} file or is too large.`); return; }
    setUploads((current) => [...current.filter((item) => item.field !== field || field === "authorPhoto"), ...selectedFiles.map((file) => ({ key: fileKey(), field, file, name: file.name }))]);
    setState("idle"); setMessage("");
  }

  function saveAuthor(id: string) {
    const form = formRef.current; if (!form) return;
    const detail = { firstName: valueFor(form, `firstName-${id}`), middleInitial: valueFor(form, `middleInitial-${id}`), surname: valueFor(form, `surname-${id}`), academicTitle: valueFor(form, `academicTitle-${id}`), email: valueFor(form, `email-${id}`), institution: valueFor(form, `institution-${id}`), orcid: valueFor(form, `orcid-${id}`) };
    const missing = (["firstName", "middleInitial", "surname", "institution", "email"] as const).filter((key) => !detail[key]);
    if (missing.length) { setAuthorErrors(missing.map((key) => `${key}-${id}`)); setState("error"); setMessage("Complete the highlighted author fields before saving."); return; }
    setAuthors((current) => current.map((author) => author.id === id ? { ...author, ...detail, saved: true } : author));
    setAuthorErrors([]); setState("idle"); setMessage("");
  }

  function validate(currentStep: number) {
    const form = formRef.current; if (!form) return false;
    if (currentStep === 0) {
      if (!valueFor(form, "workingTitle") || !selected) { setState("error"); setMessage("Add your manuscript title and choose InQuira or Lumera."); return false; }
      if (!uploads.some((item) => item.field === "manuscript") || !uploads.some((item) => item.field === "paymentProof") || !valueFor(form, "paymentMethod") || !valueFor(form, "paymentReference")) { setState("error"); setMessage("Attach one payment proof and provide its payment method and reference before continuing."); return false; }
    }
    if (currentStep === 1) {
      if (!savedAuthors.length || savedAuthors.length !== authors.length) { setState("error"); setMessage("Save the corresponding author and every co-author before continuing."); return false; }
      if (uploads.filter((item) => item.field === "authorPhoto").length < savedAuthors.length) { setState("error"); setMessage("Add one formal or profile photo for each listed author."); return false; }
    }
    setState("idle"); setMessage(""); return true;
  }

  function buildReview() {
    const form = formRef.current; if (!form || !selected) return;
    setReview([
      { title: "Manuscript", rows: [["Title", valueFor(form, "workingTitle")], ["Journal", selected.title], ["Destination", `Volume ${selected.issue.volume} · Issue ${selected.issue.number} (locked)`], ["Manuscript", uploads.find((item) => item.field === "manuscript")?.name || "Not uploaded"], ["Payment proof", uploads.find((item) => item.field === "paymentProof")?.name || "Not uploaded"], ["Payment method", valueFor(form, "paymentMethod")], ["Payment reference", valueFor(form, "paymentReference")]] },
      { title: `Authors (${savedAuthors.length})`, rows: savedAuthors.map((author, index) => [`${index === 0 ? "Corresponding author" : `Co-author ${index}`}`, `${author.firstName} ${author.middleInitial} ${author.surname} · ${author.email}${author.orcid ? ` · ORCID ${author.orcid}` : ""} · photo attached`]) },
    ]);
  }

  function goTo(next: number) {
    if (previewMode) {
      if (next === 2) buildReview();
      setStep(Math.max(0, Math.min(next, 2)));
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (next > step && !validate(step)) return;
    if (next === 2) buildReview();
    setStep(Math.max(0, Math.min(next, 2)));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sampleMode) {
      const form = event.currentTarget;
      const now = new Date();
      const primary = savedAuthors[0];
      // eslint-disable-next-line react-hooks/purity -- Math.random() is inside an event handler (submit), not render; false positive
      const sampleReference = `TP-${now.getFullYear()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const sampleRecord = {
        id: sampleReference,
        title: valueFor(form, "workingTitle") || "Sample manuscript",
        author: primary ? `${primary.firstName} ${primary.middleInitial} ${primary.surname}`.replace(/\s+/g, " ").trim() : "Sample author",
        email: primary?.email || "sample@example.test",
        journal: selected?.title || "InQuira",
        authors: savedAuthors.map((author) => ({
          firstName: author.firstName,
          middleInitial: author.middleInitial,
          surname: author.surname,
          academicTitle: author.academicTitle,
          email: author.email,
          institution: author.institution,
          orcid: author.orcid,
        })),
        status: "New",
        displayDate: now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }),
        submittedAt: now.toISOString(),
        history: [`Sample submission created · ${now.toLocaleString("en-PH")}`],
      };
      try {
        const existing = JSON.parse(window.localStorage.getItem(sampleSubmissionKey) || "[]");
        const records = Array.isArray(existing) ? existing : [];
        window.localStorage.setItem(sampleSubmissionKey, JSON.stringify([sampleRecord, ...records]));
      } catch {
        setState("error"); setMessage("This browser could not save the local sample record."); return;
      }
      setReference(sampleReference); setSuccessEmail(sampleRecord.email); setStep(3); setState("success"); return;
    }
    if (previewMode) { setStep(3); setState("success"); return; }
    if (!validate(2) || !selected) return;
    if (turnstileSiteKey && !turnstileToken) { setState("error"); setMessage("Complete the security check before submitting."); return; }
    const form = event.currentTarget;
    setState("sending"); setMessage("Creating your protected submission record…");
    try {
      const primary = savedAuthors[0];
      const initResponse = await fetch("/api/submissions/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workingTitle: valueFor(form, "workingTitle"), publicationType: "Manuscript", preferredJournal: selected.slug, journalId: selected.id, issueId: selected.issue.id, authorName: `${primary.firstName} ${primary.middleInitial} ${primary.surname}`.trim(), authorEmail: primary.email, affiliation: primary.institution, phone: "", authorDetails: savedAuthors.map((author) => ({ firstName: author.firstName, surname: author.surname, middleInitial: author.middleInitial, position: "", academicTitle: author.academicTitle, email: author.email, institution: author.institution, location: "", orcid: author.orcid })), paymentMethod: valueFor(form, "paymentMethod"), paymentReference: valueFor(form, "paymentReference"), notes: valueFor(form, "notes"), turnstileToken, website: valueFor(form, "website"), consent: (form.elements.namedItem("consent") as HTMLInputElement | null)?.checked === true, files: uploads.map(({ key, field, file, name }) => ({ key, field, name, type: file.type, size: file.size })) }) });
      const init = await initResponse.json() as { submissionId?: string; reference?: string; uploads?: UploadInstruction[]; error?: string };
      if (!initResponse.ok || !init.submissionId || !init.uploads) throw new Error(init.error || "The secure submission service is unavailable.");
      const supabase = getSupabaseBrowser(); if (!supabase) throw new Error("The secure storage connection is not configured.");
      setMessage("Uploading files directly to protected storage…");
      for (const instruction of init.uploads) {
        const upload = uploads.find((item) => item.key === instruction.key); if (!upload) throw new Error("A selected file is missing.");
        const renamed = new File([upload.file], upload.name, { type: upload.file.type, lastModified: upload.file.lastModified });
        const { error } = await supabase.storage.from("submission-files").uploadToSignedUrl(instruction.path, instruction.token, renamed, { contentType: upload.file.type, upsert: false });
        if (error) throw new Error(`Could not upload ${upload.name}. Please try again.`);
      }
      const completeResponse = await fetch("/api/submissions/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: init.submissionId, uploads: init.uploads.map(({ field, path }) => ({ field, path })) }) });
      const complete = await completeResponse.json() as { reference?: string; error?: string };
      if (!completeResponse.ok) throw new Error(complete.error || "The submission could not be finalized.");
      setReference(complete.reference || init.reference || ""); setSuccessEmail(primary.email); setStep(3); setState("success"); form.reset();
    } catch (error) { setTurnstileToken(""); setTurnstileAttempt((value) => value + 1); setState("error"); setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again."); }
  }

  const renderUpload = (upload: Upload) => <article className="submission-file-card" key={upload.key}><b className="submission-file-badge">{fileBadge(upload.file)}</b><div><strong>{upload.field === "authorPhoto" ? "Author profile photo" : upload.field === "paymentProof" ? "Payment proof" : "Manuscript"}</strong><span>{upload.name}</span></div><button type="button" onClick={() => setUploads((current) => current.filter((item) => item.key !== upload.key))}>Remove</button></article>;
  const journalClass = (journal: JournalOption) => journal.slug === "inquira" ? "submission-journal-inquira" : "submission-journal-lumera";

  if (sampleMode && state === "success") return <section className="submission-success" aria-live="polite"><nav className="submission-steps" aria-label="Submission progress">{steps.map((label, index) => <span key={label} className="complete"><i>{index < 3 ? <Icon name="check" className="h-4 w-4" /> : 4}</i><b>{label}</b></span>)}</nav><div className="submission-success-seal" aria-hidden="true"><Icon name="check" className="h-10 w-10" /></div><p className="eyebrow">Step 4 of 4 · Local sample complete</p><h2>Your sample is ready to track.</h2><p className="submission-success-lead">This temporary record is saved only in this browser. No files, details, or publication request were sent online.</p><aside className="submission-receipt"><p>Sample reference</p><strong>{reference}</strong><span>Use this reference to test the Track Submission page on this device.</span></aside><div className="submission-success-actions"><Link className="submission-primary" href={`/track?reference=${encodeURIComponent(reference)}`}>Track sample submission</Link><button type="button" className="submission-secondary" onClick={() => { setState("idle"); setStep(2); }}>Back to review</button></div></section>;

  if (previewMode && state === "success") return <section className="submission-success" aria-live="polite"><nav className="submission-steps" aria-label="Submission progress">{steps.map((label, index) => <span key={label} className="complete"><i>{index < 3 ? <Icon name="check" className="h-4 w-4" /> : 4}</i><b>{label}</b></span>)}</nav><div className="submission-success-seal" aria-hidden="true"><Icon name="check" className="h-10 w-10" /></div><p className="eyebrow">Step 4 of 4 · Completion preview</p><h2>This is how the final receipt will appear.</h2><p className="submission-success-lead">Nothing has been sent. Once the journal library is connected, this stage will show the generated reference number and delivery guidance.</p><aside className="submission-receipt"><p>Editorial receipt</p><strong>Generated after submission</strong><span>A reference number is only created after a real protected submission.</span></aside><section className="submission-success-journey" aria-label="What happens next"><article><span>01</span><b>Submission verified</b><p>Your protected files and author record will be received successfully.</p></article><article><span>02</span><b>Editorial check</b><p>The team will review completeness, journal fit, and editorial readiness.</p></article><article><span>03</span><b>Response within 3–7 working days</b><p>Authors will receive the next steps by email.</p></article></section><div className="submission-success-actions"><button type="button" className="submission-primary" onClick={() => { setState("idle"); setStep(2); }}>Back to review</button><Link className="submission-secondary" href="/">Home</Link></div></section>;

  if (state === "success") return <section className="submission-success" aria-live="polite"><nav className="submission-steps" aria-label="Submission progress">{steps.map((label, index) => <span key={label} className={index <= 3 ? "complete" : ""}><i>{index < 3 ? <Icon name="check" className="h-4 w-4" /> : 4}</i><b>{label}</b></span>)}</nav><div className="submission-success-seal" aria-hidden="true"><Icon name="check" className="h-10 w-10" /></div><p className="eyebrow">Step 4 of 4 · Submission complete</p><h2>Your work is now in editorial hands.</h2><p className="submission-success-lead">Your files and author information have been sent to the protected editorial review queue. We will use <strong>{successEmail}</strong> for follow-up.</p><aside className="submission-receipt"><p>Editorial receipt</p><strong><Link href={`/track?reference=${encodeURIComponent(reference)}`}>{reference}</Link></strong><span>Use this reference as your tracking ticket. Select it at any time to open your submission record.</span></aside><section className="submission-success-journey" aria-label="What happens next"><article><span>01</span><b>Submission verified</b><p>Your protected files and author record have been received successfully.</p></article><article><span>02</span><b>Editorial check</b><p>The team will review completeness, journal fit, and editorial readiness.</p></article><article><span>03</span><b>Response within 3–7 working days</b><p>We will contact you at your email address with the next steps.</p></article></section><div className="submission-success-actions"><Link className="submission-primary" href={`/track?reference=${encodeURIComponent(reference)}`}>Track submission</Link><Link className="submission-secondary" href="/">Home</Link></div></section>;

  return <form ref={formRef} id="submissionForm" onSubmit={submit} noValidate><nav className="submission-steps" aria-label="Submission progress">{steps.map((label, index) => <button key={label} type="button" className={`${index === step ? "active" : ""} ${index < step ? "complete" : ""}`} aria-current={index === step ? "step" : undefined} disabled={index === 3} onClick={() => index <= step ? goTo(index) : undefined}><span>{index < step ? <Icon name="check" className="h-4 w-4" /> : index + 1}</span><b>{label}</b></button>)}</nav><div className="submission-progress" aria-hidden="true"><i style={{ width: `${(step + 1) * 25}%` }} /></div><p className={`submission-form-error ${state === "error" ? "visible" : ""}`} role="alert">{state === "error" ? message : ""}</p><input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
    <section className="submission-panel" data-submit-step="0" hidden={step !== 0}><div className="submission-panel-heading"><p>Step 1 of 4</p><h2>Manuscript</h2><span>Start with your work, choose its journal home, then securely attach the manuscript and payment proof.</span></div>{previewMode && <aside className="submission-preview-notice"><strong>{sampleMode ? "Local sample mode" : "Preview mode"}</strong><span>{sampleMode ? "Complete the flow to create a trackable sample in this browser only. Nothing is sent or published online." : "You can review the complete form now. Submission stays unavailable until the journal library and current issues are connected."}</span></aside>}<label className="submission-full-field">Manuscript title *<input name="workingTitle" required minLength={5} maxLength={300} placeholder="Enter the title of your manuscript" /></label><fieldset className="submission-choice-group submission-journal-group"><legend>Choose a journal *</legend><p>Hover or focus a journal to explore its purpose, scope, and the work it welcomes.</p><div className="submission-choice-layout"><div className="submission-choice-list submission-journal-list" role="radiogroup" aria-label="Journal"><>{journals.map((journal) => <button key={journal.id} type="button" role="radio" aria-checked={selectedJournal === journal.slug} className={`${selectedJournal === journal.slug ? "selected" : ""} ${journalClass(journal)}`} onMouseEnter={() => setPreviewJournal(journal.slug)} onFocus={() => setPreviewJournal(journal.slug)} onMouseLeave={() => setPreviewJournal("")} onBlur={() => setPreviewJournal("")} onClick={() => { setSelectedJournal(journal.slug); setState("idle"); setMessage(""); }}><span>{selectedJournal === journal.slug && <Icon name="check" className="h-4 w-4" />}</span><div><strong>{journal.title}</strong><b>{journal.slug === "inquira" ? "Inquiry, research & ideas" : "Creative scholarship & voices"}</b></div></button>)}</></div><aside className={`submission-choice-preview submission-journal-preview ${preview ? journalClass(preview) : ""}`} aria-live="polite">{preview ? <><p>Journal fit</p><h3>{preview.title}</h3><span>{preview.description}</span><b>Best for: {preview.scope}</b></> : <><p>Find your editorial home</p><h3>Explore each journal</h3><span>Hover or focus a card for a quick journal preview.</span></>}</aside></div></fieldset>{selected && <aside className={`submission-issue-destination ${journalClass(selected)}`}><span>{previewMode ? "Destination preview" : "Locked destination"}</span><strong>{selected.title}</strong><p>Volume {selected.issue.volume} · Issue {selected.issue.number}</p><small>{previewMode ? "The real current volume and issue will replace these placeholders when configured." : "This issue is set by the editorial team and cannot be changed in the form."}</small></aside>}<div className="submission-upload-grid submission-manuscript-upload-grid"><label className="submission-upload"><Icon name="file" className="h-6 w-6" /><strong>Word manuscript *</strong><span>One .doc or .docx file · up to 15 MB</span><input type="file" accept="application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx" onChange={(event) => pickFiles("manuscript", event.target.files)} /></label><label className="submission-upload"><Icon name="file" className="h-6 w-6" /><strong>Payment proof *</strong><span>JPG, PNG, WebP, or PDF · up to 5 MB</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => pickFiles("paymentProof", event.target.files)} /></label></div><div className="submission-file-list">{uploads.filter((item) => item.field !== "authorPhoto").map(renderUpload)}</div><details className="submission-guide"><summary>Manuscript and payment guidance</summary><p>Use a complete, readable Word manuscript. Upload a clear payment receipt or screenshot that shows the transaction details. Both files remain private and are checked before your record is finalized.</p></details></section>
    <section className="submission-panel" data-submit-step="1" hidden={step !== 1}><div className="submission-panel-heading"><p>Step 2 of 4</p><h2>Authors</h2><span>Add the corresponding author first, then any co-authors. A formal or profile photo is required for each author.</span></div><label className="submission-upload submission-author-photo-upload"><Icon name="users" className="h-6 w-6" /><strong>Author photos *</strong><span>JPG or PNG · one formal/profile photo for every author</span><input type="file" multiple accept="image/jpeg,image/png" onChange={(event) => pickFiles("authorPhoto", event.target.files)} /></label><div className="submission-file-list">{uploads.filter((item) => item.field === "authorPhoto").map(renderUpload)}</div>{authors.map((author, index) => <fieldset className="submission-author-card" key={author.id}><legend>{index === 0 ? "Corresponding author" : `Co-author ${index}`}</legend>{author.saved ? <article className="submission-author-summary"><div><p>{index === 0 ? "Corresponding author" : "Co-author"}</p><strong>{author.firstName} {author.middleInitial} {author.surname}</strong></div><button type="button" className="submission-edit-author" onClick={() => setAuthors((current) => current.map((item) => item.id === author.id ? { ...item, saved: false } : item))}>Edit author</button></article> : <div className="submission-field-grid submission-author-name-row"><label>First name *<input name={`firstName-${author.id}`} required maxLength={80} autoComplete="given-name" className={authorErrors.includes(`firstName-${author.id}`) ? "submission-field-error" : undefined} defaultValue={author.firstName} /></label><label>Middle initial *<input name={`middleInitial-${author.id}`} required maxLength={80} className={authorErrors.includes(`middleInitial-${author.id}`) ? "submission-field-error" : undefined} defaultValue={author.middleInitial} /></label><label>Surname *<input name={`surname-${author.id}`} required maxLength={80} autoComplete="family-name" className={authorErrors.includes(`surname-${author.id}`) ? "submission-field-error" : undefined} defaultValue={author.surname} /></label><label>Affiliation *<input name={`institution-${author.id}`} required maxLength={240} className={authorErrors.includes(`institution-${author.id}`) ? "submission-field-error" : undefined} placeholder="School, institution, or organization" defaultValue={author.institution} /></label><label>Academic title<input name={`academicTitle-${author.id}`} maxLength={80} placeholder="e.g. LPT, MAEd, PhD" defaultValue={author.academicTitle} /></label><label>Email address *<input name={`email-${author.id}`} required type="email" maxLength={254} autoComplete="email" className={authorErrors.includes(`email-${author.id}`) ? "submission-field-error" : undefined} defaultValue={author.email} /></label><label>ORCID<input name={`orcid-${author.id}`} maxLength={120} placeholder="0000-0000-0000-0000" defaultValue={author.orcid} /></label><button type="button" className="submission-save-author" onClick={() => saveAuthor(author.id)}>Save author</button></div>}{authors.length > 1 && <button type="button" className="submission-remove-author" onClick={() => setAuthors((current) => current.filter((item) => item.id !== author.id))}>Remove co-author</button>}</fieldset>)}<button type="button" className="submission-add-author" onClick={() => setAuthors((current) => [...current, createAuthor(`author-${authorSequence.current++}`)])}>Add co-author</button></section>
    <section className="submission-panel" data-submit-step="2" hidden={step !== 2}><div className="submission-panel-heading"><p>Step 3 of 4</p><h2>Review</h2><span>Check every detail before your files are sent to the protected editorial queue.</span></div><div className="submission-review">{review.map((section) => <section key={section.title}><h3>{section.title}</h3>{section.rows.map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}</section>)}</div><label className="submission-full-field">Notes for the editorial team <textarea name="notes" rows={4} maxLength={3000} placeholder="Optional comments or instructions" /></label><label className="submission-consent"><input type="checkbox" name="consent" required /><span>I confirm that the manuscript, author information, payment proof, and photo attachments are accurate and that I have permission to submit them.</span></label>{turnstileSiteKey ? <TurnstileWidget key={turnstileAttempt} siteKey={turnstileSiteKey} onTokenChange={setTurnstileToken} /> : null}</section>
    {state === "sending" && <p className="submission-form-status" role="status">{message}</p>}<div className="submission-actions"><button type="button" className="submission-secondary" hidden={step === 0 || state === "sending"} onClick={() => goTo(step - 1)}><Icon name="arrow" className="h-4 w-4" /> Back</button>{step < 2 ? <button type="button" className="submission-primary" onClick={() => goTo(step + 1)}>Save & continue <Icon name="arrow" className="h-4 w-4" /></button> : <button type="submit" className="submission-primary" disabled={state === "sending" || Boolean(turnstileSiteKey && !turnstileToken)}>{state === "sending" ? "Completing securely…" : "Complete submission"} <Icon name="check" className="h-4 w-4" /></button>}<span>Step {step + 1} of 4</span></div></form>;
}
