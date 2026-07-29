"use client";

import { Fragment, useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import Link from "next/link";
import { Icon } from "./icon";
import { BookOpenTextIcon } from "@/components/icons/book-open-text";
import { BookmarkIcon } from "@/components/icons/bookmark";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { CopyIcon } from "@/components/icons/copy";
import { DownloadIcon } from "@/components/icons/download";
import { HandCoinsIcon } from "@/components/icons/hand-coins";
import { InfoIcon } from "@/components/icons/info";
import { LoaderCircleIcon } from "@/components/icons/loader-circle";
import { Trash2Icon } from "@/components/icons/trash-2";
import { FileUploadSystem, FileChecklist, PreviewModal, hasAllRequiredFiles, hasActiveUploads } from "./file-upload-system";
import { AuthorPhotoCropper, PhotoSlot, authorInitials } from "./author-photo-cropper";
import { SubmissionProcessing, type ProcessingPhase, type ProcessingStep } from "./processing-overlay";
import type { StoredFile } from "@/lib/file-storage";
import { validateFile, saveBlob, saveMeta, deleteFile, getBlob, formatBytes, sanitizeFilename, PURPOSE_ACCEPT, PURPOSE_MAX_SIZE } from "@/lib/file-storage";

const MAX_SUBMIT_ATTEMPTS = 3;
const MIN_PROCESS_MS = 2800;
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function isRetryable(err: unknown) {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  const fatal = [
    "please upload your main manuscript",
    "larger than 5 mb",
    "could not read",
    "please remove it and upload",
    "not available for the selected journal",
    "please choose a journal",
  ];
  return !fatal.some((token) => msg.includes(token));
}

const localSubmissionKey = "talikha-editorial-submissions-v1";

const STEPS = [
  { id: "manuscript", label: "Manuscript", subtitle: "Title, journal & files", icon: "file" as const },
  { id: "author", label: "Author", subtitle: "Your details", icon: "person" as const },
  { id: "payment", label: "Payment", subtitle: "Billing & payment", icon: "card" as const },
  { id: "review", label: "Review", subtitle: "Confirm & submit", icon: "check" as const },
];

const CATEGORIES = ["Research Article", "Essay", "Poetry", "Fiction", "Book Chapter", "Literary Review", "Commentary"];

const POLICIES_URL = "/editorial-standards";

type CoAuthor = { id: string; firstName: string; middleName: string; familyName: string; academicTitle: string; email: string; affiliation: string; occupation: string; orcid: string; photo: string };

type FormData = {
  academicTitle: string;
  firstName: string;
  middleName: string;
  familyName: string;
  email: string;
  orcid: string;
  affiliation: string;
  occupation: string;
  title: string;
  journal: string;
  category: string;
  keywords: string;
  coAuthorNote: string;
  summary: string;
  photo: string;
  coAuthors: CoAuthor[];
};

const emptyForm: FormData = {
  academicTitle: "",
  firstName: "",
  middleName: "",
  familyName: "",
  email: "",
  orcid: "",
  affiliation: "",
  occupation: "",
  title: "",
  journal: "",
  category: "",
  keywords: "",
  coAuthorNote: "",
  summary: "",
  photo: "",
  coAuthors: [],
};

function fullName(d: Pick<FormData, "academicTitle" | "firstName" | "middleName" | "familyName">) {
  return [d.academicTitle, d.firstName, d.middleName, d.familyName].filter(Boolean).join(" ");
}

function displayName(d: Pick<FormData, "academicTitle" | "firstName" | "middleName" | "familyName">) {
  const name = [d.firstName, d.middleName, d.familyName].filter(Boolean).join(" ");
  return d.academicTitle ? `${name}, ${d.academicTitle}` : name;
}

function coDisplayName(a: Pick<CoAuthor, "academicTitle" | "firstName" | "middleName" | "familyName">) {
  const name = [a.firstName, a.middleName, a.familyName].filter(Boolean).join(" ");
  return a.academicTitle ? `${name}, ${a.academicTitle}` : name;
}

function wordCount(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

async function downloadPhoto(dataUrl: string | undefined, baseName: string) {
  if (!dataUrl) return;
  const blob = await dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = baseName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "author";
  a.download = `${safe}-photo.${dataUrl.indexOf("data:image/png") === 0 ? "png" : "jpg"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="review-row">
      {icon}
      <span className="review-row-label">{label}</span>
      <span className="review-row-value" title={typeof value === "string" ? value : undefined}>{value}</span>
    </div>
  );
}

type JournalOption = { slug: string; title: string; longTitle: string; scope: string; blurb: string; icon: "book" | "feather" | "users"; summaryField: string; summaryHint: string };
type PublicationPlan = { id: string; name: string; desc: string; price: number; eta: string; recommended: boolean };
type PaymentMethod = { id: string; name: string; kind: "gcash" | "maya" | "bank"; desc: string; accountName: string; note: string; scanLabel: string; number?: string; bank?: string; accountNumber?: string };
type Promo = { type: "percent" | "fixed"; value: number };

const PUBLICATION_PLANS: PublicationPlan[] = [
  { id: "standard", name: "Standard Review", desc: "Standard peer review and publication timeline.", price: 2500, eta: "4–6 weeks", recommended: true },
  { id: "priority", name: "Priority Review", desc: "Faster review process and early decision.", price: 3500, eta: "2–3 weeks", recommended: false },
  { id: "premium", name: "Premium Publication", desc: "Expedited review and enhanced visibility.", price: 5000, eta: "1–2 weeks", recommended: false },
];

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "gcash", name: "GCash", kind: "gcash", desc: "Pay securely using your GCash account.", accountName: "InQuira Publishing Inc.", number: "0917 123 4567", scanLabel: "Scan the QR or send to the number below.", note: "Use the exact amount for faster verification." },
  { id: "maya", name: "Maya", kind: "maya", desc: "Pay securely using your Maya wallet.", accountName: "InQuira Publishing Inc.", number: "0917 765 4321", scanLabel: "Send the exact amount to the Maya number below.", note: "Use the exact amount for faster verification." },
  { id: "bank", name: "Bank Transfer", kind: "bank", desc: "Transfer to our bank account and upload the slip.", accountName: "InQuira Publishing Inc.", bank: "Land Bank of the Philippines", accountNumber: "1234 5678 9012", scanLabel: "Transfer the exact amount to the account below.", note: "Keep the deposit slip and add the reference number if you can." },
];

const PROMO_CODES: Record<string, Promo> = {
  EARLYBIRD10: { type: "percent", value: 10 },
  WELCOME150: { type: "fixed", value: 150 },
};

function formatPeso(n: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function computeDiscount(code: string, subtotal: number) {
  const p = PROMO_CODES[code];
  if (!p) return 0;
  const d = p.type === "percent" ? Math.round((subtotal * p.value) / 100) : p.value;
  return Math.max(0, Math.min(d, subtotal));
}

function makeQrModules(size: number): boolean[][] {
  let seed = 20260724;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const g: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const inFinder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
  const finder = (or: number, oc: number) => {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const edge = i === 0 || i === 6 || j === 0 || j === 6;
      const inner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      g[or + i][oc + j] = edge || inner;
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!inFinder(r, c)) g[r][c] = rand() > 0.52;
  return g;
}

const GCASH_QR = makeQrModules(25);

const GLYPH_SIZE = /(?:^|\s)(?:size|h|w)-(\d+(?:\.\d+)?)(?=\s|$)/;
function glyph(Comp: ComponentType<any>) {
  return function Glyph({ className }: { className?: string }) {
    let size: number | undefined;
    if (className) { const match = className.match(GLYPH_SIZE); if (match) size = Math.round(parseFloat(match[1]) * 4); }
    return <Comp className={className} size={size} strokeWidth={1.8} aria-hidden />;
  };
}

const ChevDown = glyph(ChevronDownIcon);
const CopyGlyph = glyph(CopyIcon);
const DownloadGlyph = glyph(DownloadIcon);
const TrashGlyph = glyph(Trash2Icon);
const InfoGlyph = glyph(InfoIcon);
const ClockGlyph = glyph(LoaderCircleIcon);
const DocGlyph = glyph(BookOpenTextIcon);
const TagGlyph = glyph(BookmarkIcon);
const BankGlyph = glyph(HandCoinsIcon);

function GcashMark() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#0a84ff" />
      <path d="M16.4 7.1a6.3 6.3 0 0 1 2.5 2.7" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14.9 9.3a3.7 3.7 0 0 1 1.6 1.8" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <text x="10.6" y="16.6" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui, sans-serif">G</text>
    </svg>
  );
}

function MayaMark() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#0b0b0d" />
      <text x="12" y="15.3" textAnchor="middle" fontSize="7.6" fontWeight="800" fontStyle="italic" fill="#16e0a3" fontFamily="Inter, system-ui, sans-serif">maya</text>
    </svg>
  );
}

function MethodBrand({ kind, className }: { kind: string; className?: string }) {
  return (
    <span className={`bill-brand ${kind === "bank" ? "is-bank" : ""} ${className ?? ""}`}>
      {kind === "gcash" ? <GcashMark /> : kind === "maya" ? <MayaMark /> : <BankGlyph className="h-5 w-5" />}
    </span>
  );
}

function QrSvg({ modules, className }: { modules: boolean[][]; className?: string }) {
  const n = modules.length;
  return (
    <svg className={className} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="Payment QR code">
      <rect x={0} y={0} width={n} height={n} fill="#fff" />
      {modules.map((row, r) => row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#14241c" /> : null)))}
    </svg>
  );
}

export function LocalSubmissionForm({ serverJournals = [] }: { serverJournals?: { slug: string; id: string; issueId: string; title: string; description: string; scope: string; volume: string; issue: string; status: "Accepting submissions" | "Accepting advance submissions" }[] } = {}) {
  const JOURNAL_OPTIONS: JournalOption[] = serverJournals.length > 0
    ? serverJournals.map((sj) => {
        const known = TEMP_JOURNALS.find((t) => t.slug === sj.slug);
        return known ?? { slug: sj.slug, title: sj.title, longTitle: sj.title, scope: sj.scope || sj.description, blurb: sj.description || sj.scope, icon: "book" as const, summaryField: "Abstract", summaryHint: "Summarize the study — its purpose, method, and key findings." };
      })
    : TEMP_JOURNALS;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<StoredFile[]>([]);
  const [paymentRef, setPaymentRef] = useState("");
  const [confirmations, setConfirmations] = useState({ original: false, authorsApprove: false, policies: false, billingAccurate: false, billingDelay: false });
  const [checklistTouched, setChecklistTouched] = useState(false);
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [expandedAuthor, setExpandedAuthor] = useState<string>("primary");
  const [expandedReviewAuthor, setExpandedReviewAuthor] = useState<string | null>(null);
  const [photoCrop, setPhotoCrop] = useState<{ src: string; target: string } | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [abstractOpen, setAbstractOpen] = useState(false);
  const [plan, setPlan] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentPhase, setPaymentPhase] = useState<"configure" | "payment">("configure");
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState("");
  const [proofConfirmed, setProofConfirmed] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [proofError, setProofError] = useState("");
  const [proofDrag, setProofDrag] = useState(false);
  const abstractRef = useRef<HTMLTextAreaElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const billSelectRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [serverSubmitted, setServerSubmitted] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>("idle");
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("preparing");

  useEffect(() => {
    if (!abstractOpen) return;
    const t = window.setTimeout(() => abstractRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAbstractOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [abstractOpen]);

  useEffect(() => {
    if (!journalOpen) return;
    const onDown = (e: MouseEvent) => { if (billSelectRef.current && !billSelectRef.current.contains(e.target as Node)) setJournalOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [journalOpen]);

  useEffect(() => {
    if (!submitting) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [submitting]);

  useEffect(() => {
    if (reference) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [reference]);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  function addCoAuthor() {
    const id = crypto.randomUUID();
    setForm((prev) => ({
      ...prev,
      coAuthors: [...prev.coAuthors, { id, firstName: "", middleName: "", familyName: "", academicTitle: "", email: "", affiliation: "", occupation: "", orcid: "", photo: "" }]
    }));
    setExpandedAuthor(id);
  }

  function updateCoAuthor(id: string, field: keyof CoAuthor, value: string) {
    setForm((prev) => ({
      ...prev,
      coAuthors: prev.coAuthors.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    }));
    if (field === "email" && errors[`co-${id}`]) setErrors((prev) => { const next = { ...prev }; delete next[`co-${id}`]; return next; });
  }

  function removeCoAuthor(id: string) {
    setForm((prev) => ({ ...prev, coAuthors: prev.coAuthors.filter((a) => a.id !== id) }));
    if (expandedAuthor === id) setExpandedAuthor("primary");
  }

  function pickPhoto(target: string) {
    setPhotoError("");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (!f.type.startsWith("image/")) { setPhotoError("Please choose an image file (PNG, JPG, or WebP)."); return; }
      if (f.size > 12 * 1024 * 1024) { setPhotoError("That image is too large — please use one under 12 MB."); return; }
      setPhotoCrop({ src: URL.createObjectURL(f), target });
    };
    input.click();
  }

  function openPhoto(target: string) {
    setPhotoError("");
    const current = target === "primary" ? form.photo : (form.coAuthors.find((a) => a.id === target)?.photo ?? "");
    if (current) setPhotoCrop({ src: current, target });
    else pickPhoto(target);
  }

  function confirmPhoto(dataUrl: string) {
    if (!photoCrop) return;
    if (photoCrop.target === "primary") update("photo", dataUrl);
    else updateCoAuthor(photoCrop.target, "photo", dataUrl);
    if (photoCrop.src.startsWith("blob:")) URL.revokeObjectURL(photoCrop.src);
    setPhotoCrop(null);
  }

  function cancelPhoto() {
    if (photoCrop && photoCrop.src.startsWith("blob:")) URL.revokeObjectURL(photoCrop.src);
    setPhotoCrop(null);
  }

  function removePhoto(target: string) {
    if (target === "primary") update("photo", "");
    else updateCoAuthor(target, "photo", "");
  }

  function toggleConfirm(key: keyof typeof confirmations) {
    setConfirmations((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function validateStep(s: number): Record<string, string> {
    const next: Record<string, string> = {};
    if (s === 0) {
      if (!form.title.trim()) next.title = "Required";
      else if (form.title.trim().length < 5) next.title = "Use at least 5 characters";
      if (!form.journal) next.journal = "Select a journal";
      if (!uploadedFiles.some((f) => f.purpose === "manuscript" && f.status === "completed")) next.manuscript = "Please upload your main manuscript";
    }
    if (s === 1) {
      if (!form.firstName.trim()) next.firstName = "Required";
      if (!form.familyName.trim()) next.familyName = "Required";
      if (!form.email.trim()) next.email = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Invalid email";
      const seen = new Set(form.email.trim() ? [form.email.trim().toLowerCase()] : []);
      for (const a of form.coAuthors) {
        const filled = [a.firstName, a.middleName, a.familyName, a.email, a.affiliation, a.occupation, a.orcid].some((v) => v.trim());
        if (!filled) continue;
        if (!a.firstName.trim() || !a.familyName.trim()) next[`co-${a.id}`] = "Add the co-author's first and family name";
        else if (!a.email.trim()) next[`co-${a.id}`] = "Add the co-author's email";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) next[`co-${a.id}`] = "Invalid co-author email";
        else if (seen.has(a.email.trim().toLowerCase())) next[`co-${a.id}`] = "Duplicate email";
        else seen.add(a.email.trim().toLowerCase());
      }
    }
    if (s === 2) {
      if (!plan) next.plan = "Select a publication plan";
      if (!paymentMethod) next.paymentMethod = "Select a payment method";
      if (paymentRef.trim().length < 3) next.paymentRef = "Enter a valid transaction reference number (at least 3 characters)";
      if (!uploadedFiles.some((f) => f.purpose === "payment-proof" && f.status === "completed")) next.payment = "Upload your payment proof";
      else if (!proofConfirmed) next.proofConfirm = "Confirm the uploaded file is correct";
    }
    setErrors(next);
    return next;
  }

  function next() {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      if (step === 1) {
        const badCo = form.coAuthors.find((a) => errs[`co-${a.id}`]);
        setExpandedAuthor(badCo ? badCo.id : "primary");
      }
      return;
    }
    if (step === 2) setExpandedReviewAuthor(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  const allConfirmed = confirmations.original && confirmations.authorsApprove && confirmations.policies && confirmations.billingAccurate && confirmations.billingDelay;
  const filesReady = hasAllRequiredFiles(uploadedFiles);
  const uploading = hasActiveUploads(uploadedFiles);

  async function runServerSubmission(
    sj: { slug: string; id: string; issueId: string },
    supabase: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
    onStep: (step: ProcessingStep) => void
  ): Promise<string> {
      const completed = uploadedFiles.filter((f) => f.status === "completed");
      const manuscript = completed.find((f) => f.purpose === "manuscript");
      const proof = completed.find((f) => f.purpose === "payment-proof");
      if (!manuscript) throw new Error("Please upload your main manuscript before submitting.");

      const fieldFor = (purpose: string) => (purpose === "payment-proof" ? "paymentProof" : "manuscript");
      const fileDescs: { key: string; field: "manuscript" | "paymentProof" | "authorPhoto"; name: string; type: string; size: number }[] = [];
      const blobFor = new Map<string, () => Promise<Blob>>();
      const addFile = (f: StoredFile) => {
        const raw = (f.id || "").replace(/[^a-zA-Z0-9_-]/g, "");
        const key = (raw.length >= 6 ? raw : raw + "file" + Math.random().toString(36).slice(2, 8)).slice(0, 80);
        fileDescs.push({ key, field: fieldFor(f.purpose) as "manuscript" | "paymentProof", name: f.name.slice(0, 180), type: f.mimeType, size: f.size });
        blobFor.set(key, async () => {
          const blob = await getBlob(f.id);
          if (!blob) throw new Error(`Could not read ${f.name} from this browser. Please remove it and upload it again.`);
          return blob;
        });
      };
      addFile(manuscript);
      if (proof) addFile(proof);

      const meaningful = (a: { firstName: string; middleName: string; familyName: string; email: string; affiliation: string; occupation: string; orcid: string }) =>
        [a.firstName, a.middleName, a.familyName, a.email, a.affiliation, a.occupation, a.orcid].some((v) => v.trim());
      const authorDetails = [
        { firstName: form.firstName.trim(), surname: form.familyName.trim(), middleInitial: form.middleName.trim(), position: form.occupation.trim(), academicTitle: form.academicTitle.trim(), email: form.email.trim(), institution: form.affiliation.trim(), location: "", orcid: form.orcid.trim() },
        ...form.coAuthors.filter(meaningful).map((a) => ({ firstName: a.firstName.trim(), surname: a.familyName.trim(), middleInitial: a.middleName.trim(), position: a.occupation.trim(), academicTitle: a.academicTitle.trim(), email: a.email.trim(), institution: a.affiliation.trim(), location: "", orcid: a.orcid.trim() }))
      ];
      const photoSources = [form.photo, ...form.coAuthors.filter(meaningful).map((a) => a.photo)];
      for (let pi = 0; pi < photoSources.length; pi++) {
        const dataUrl = photoSources[pi];
        if (!dataUrl) continue;
        const photoBlob = await dataUrlToBlob(dataUrl);
        if (photoBlob.size > 5 * 1024 * 1024) throw new Error("One of the author photos is larger than 5 MB. Please use a smaller image.");
        const photoExt = photoBlob.type === "image/png" ? "png" : "jpg";
        const photoName = `author-${String(pi + 1).padStart(3, "0")}.${photoExt}`;
        const photoKey = `aphoto${String(pi + 1).padStart(3, "0")}`;
        fileDescs.push({ key: photoKey, field: "authorPhoto", name: photoName, type: photoBlob.type || "image/jpeg", size: photoBlob.size });
        blobFor.set(photoKey, async () => photoBlob);
      }
      const notes = [form.summary.trim(), form.keywords.trim() ? `Keywords: ${form.keywords.trim()}` : "", form.coAuthorNote.trim() ? `Co-author note: ${form.coAuthorNote.trim()}` : ""]
        .filter(Boolean).join("\n\n").slice(0, 3000);

      const initBody = {
        workingTitle: form.title.trim(),
        publicationType: form.category.trim() || "Manuscript",
        preferredJournal: form.journal,
        journalId: sj.id,
        issueId: sj.issueId,
        authorDetails,
        authorName: fullName(form),
        authorEmail: form.email.trim(),
        affiliation: form.affiliation.trim(),
        phone: "",
        notes,
        consent: true as const,
        turnstileToken: "",
        website: "",
        files: fileDescs,
        publicationPlan: plan,
        paymentMethod,
        paymentReference: paymentRef.trim(),
        promoCode: appliedPromo || "",
        paymentTotal: total
      };

      const initRes = await fetch("/api/submissions/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initBody) });
      const init = (await initRes.json().catch(() => ({}))) as { submissionId?: string; reference?: string; uploads?: { key: string; field: string; path: string; token: string }[]; error?: string };
      if (!initRes.ok || !init.submissionId || !init.uploads) throw new Error(init.error || "The submission service could not start your record. Please try again.");

      onStep("uploading");
      for (const ins of init.uploads) {
        const make = blobFor.get(ins.key);
        if (!make) throw new Error("A prepared file is missing. Please try submitting again.");
        const blob = await make();
        const { error } = await supabase.storage.from("submission-files").uploadToSignedUrl(ins.path, ins.token, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
        if (error) throw new Error(`Could not upload one of your files. ${error.message || "Please try again."}`);
      }

      onStep("verifying");
      const completeRes = await fetch("/api/submissions/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: init.submissionId, uploads: init.uploads.map((u) => ({ field: u.field, path: u.path })) }) });
      const complete = (await completeRes.json().catch(() => ({}))) as { reference?: string; error?: string };
      if (!completeRes.ok || !complete.reference) throw new Error(complete.error || "Your files were uploaded, but the record could not be finalized. Please contact the editorial team.");

      onStep("finalizing");
      return complete.reference;
  }

  async function runLocalSubmission(onStep: (step: ProcessingStep) => void): Promise<string> {
    await wait(700);
    onStep("uploading");
    await wait(700);
    onStep("verifying");
    await wait(700);
    onStep("finalizing");
    await wait(700);
    const now = new Date();
    const nextReference = `TP-${now.getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const stored = JSON.parse(localStorage.getItem(localSubmissionKey) || "[]");
    const records = Array.isArray(stored) ? stored : [];
    const authors = [
      { id: `${nextReference}-author-1`, name: fullName(form), email: form.email, affiliation: form.affiliation, occupation: form.occupation || "Submitting author", orcid: form.orcid || null, photo: form.photo || null },
      ...form.coAuthors.map((a, i) => ({ id: `${nextReference}-author-${i + 2}`, name: coDisplayName(a), email: a.email, affiliation: a.affiliation, occupation: a.occupation || "Co-author", orcid: a.orcid || null, photo: a.photo || null }))
    ];
    const completedFiles = uploadedFiles.filter((f) => f.status === "completed");
    const manuscriptFile = completedFiles.find((f) => f.purpose === "manuscript");
    const paymentProofFile = completedFiles.find((f) => f.purpose === "payment-proof");

    records.unshift({
      id: nextReference,
      title: form.title || "Untitled submission",
      author: fullName(form) || "Unnamed author",
      email: form.email,
      affiliation: form.affiliation,
      journal: JOURNAL_OPTIONS.find((j) => j.slug === form.journal)?.title || form.journal,
      status: "New",
      submittedAt: now.toISOString().slice(0, 10),
      displayDate: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      image: "author-profile-filipino-researcher.webp",
      abstract: form.summary || "Submission saved in this browser for local editorial review.",
      fileName: manuscriptFile?.name || "No manuscript selected",
      paymentProof: Boolean(paymentProofFile),
      paymentFileName: paymentProofFile?.name ?? null,
      paymentRef: paymentRef || null,
      history: [`Saved locally ${now.toLocaleString()}`],
      authors,
      category: form.category,
      keywords: form.keywords,
      coAuthorNote: form.coAuthorNote,
      supportingFiles: completedFiles.filter((f) => f.purpose === "supporting").map((f) => f.name),
      coverImage: completedFiles.find((f) => f.purpose === "cover-image")?.name ?? null,
      uploadedFiles: completedFiles.map((f) => ({ id: f.id, name: f.name, purpose: f.purpose, size: f.size, mimeType: f.mimeType, category: f.category, notes: f.notes, version: f.version })),
      confirmations,
      locked: true
    });
    localStorage.setItem(localSubmissionKey, JSON.stringify(records));
    return nextReference;
  }

  function resetFormState() {
    setForm(emptyForm);
    setUploadedFiles([]);
    setPaymentRef("");
    setPlan("");
    setPaymentMethod("");
    setPaymentPhase("configure");
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError("");
    setProofConfirmed(false);
    setProofError("");
    setConfirmations({ original: false, authorsApprove: false, policies: false, billingAccurate: false, billingDelay: false });
    setChecklistTouched(false);
  }

  async function performSubmit() {
    setSubmitting(true);
    setSubmitError("");
    setProcessingPhase("working");
    setProcessingStep("preparing");

    const sj = (serverJournals ?? []).find((j) => j.slug === form.journal);
    const supabase = getSupabaseBrowser();
    const isServer = Boolean(supabase);
    if (isServer && !sj) {
      setProcessingPhase("failed");
      setSubmitError("Online submission is not available for the selected journal right now. Please choose a journal that is currently open, or contact the editorial team.");
      return;
    }

    let lastError = "";
    for (let current = 1; current <= MAX_SUBMIT_ATTEMPTS; current++) {
      try {
        const startedAt = Date.now();
        const ref = isServer
          ? await runServerSubmission(sj!, supabase!, setProcessingStep)
          : await runLocalSubmission(setProcessingStep);
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_PROCESS_MS) await wait(MIN_PROCESS_MS - elapsed);
        setServerSubmitted(isServer);
        setReference(ref);
        if (!isServer) setMessage("Saved only in this browser. Files are stored locally in your browser's database.");
        setProcessingPhase("succeeded");
        await wait(1500);
        resetFormState();
        setSubmitting(false);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Something went wrong submitting your work. Please try again.";
        const canRetry = isRetryable(err) && current < MAX_SUBMIT_ATTEMPTS;
        if (!canRetry) break;
        await wait(1200);
      }
    }
    setProcessingPhase("failed");
    setSubmitError(lastError);
  }

  function submit() {
    if (submitting) return;
    if (Object.keys(validateStep(0)).length > 0) { setStep(0); return; }
    if (Object.keys(validateStep(1)).length > 0) { setStep(1); return; }
    if (Object.keys(validateStep(2)).length > 0) { setStep(2); return; }
    if (!allConfirmed) { setChecklistTouched(true); return; }
    if (!filesReady) { setChecklistTouched(true); return; }
    if (uploading) return;
    performSubmit();
  }

  function retrySubmit() { performSubmit(); }
  function cancelProcessing() { setSubmitting(false); setProcessingPhase("idle"); }

  const abstractWords = wordCount(form.summary);
  const journalMeta = JOURNAL_OPTIONS.find((j) => j.slug === form.journal);
  const summaryField = journalMeta?.summaryField ?? "Abstract";
  const summaryHint = journalMeta?.summaryHint ?? "Summarize the study — its purpose, method, and key findings.";
  const summaryPlaceholder = `Enter your ${summaryField.toLowerCase()}…`;
  const lastStep = STEPS.length - 1;
  const uploaderName = fullName(form) || "Author";

  const reviewAuthors = [
    { id: "primary", name: displayName(form), initials: authorInitials(form), photo: form.photo, role: form.occupation || "Submitting author", email: form.email, affiliation: form.affiliation, orcid: form.orcid, isPrimary: true },
    ...form.coAuthors.map((a) => ({ id: a.id, name: coDisplayName(a), initials: authorInitials(a), photo: a.photo, role: "Co-author", email: a.email, affiliation: a.affiliation, orcid: a.orcid, isPrimary: false }))
  ];
  const multipleAuthors = reviewAuthors.length > 1;

  const selectedJournal = JOURNAL_OPTIONS.find((j) => j.slug === form.journal);
  const selectedServerJournal = serverJournals.find((journal) => journal.slug === form.journal);
  const selectedPlan = PUBLICATION_PLANS.find((p) => p.id === plan);
  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === paymentMethod);
  const subtotal = selectedPlan ? selectedPlan.price : 0;
  const discount = appliedPromo ? computeDiscount(appliedPromo, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);
  const proofFile = uploadedFiles.find((f) => f.purpose === "payment-proof" && f.status !== "cancelled");
  const proofReady = Boolean(proofFile && proofFile.status === "completed");
  const canConfigureContinue = Boolean(form.journal && plan);
  const canPaymentContinue = Boolean(paymentMethod) && paymentRef.trim().length > 0 && proofReady && proofConfirmed;
  const billingSubtitle = paymentPhase === "payment" ? "Select your payment method, complete the payment, and upload proof to continue." : "Choose the journal and publication plan to see your order summary.";
  const otherMethods = PAYMENT_METHODS.filter((m) => m.id !== paymentMethod);

  function selectJournal(slug: string) { update("journal", slug); setJournalOpen(false); }
  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) { setPromoError("Enter a promo code."); return; }
    if (!PROMO_CODES[code]) { setPromoError("That code isn’t valid."); setAppliedPromo(null); return; }
    setAppliedPromo(code);
    setPromoError("");
    setPromoInput("");
  }
  function clearPromo() { setAppliedPromo(null); setPromoInput(""); setPromoError(""); }
  function copyValue(key: string, value: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) navigator.clipboard.writeText(value).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
  }
  function goPhase(p: "configure" | "payment") {
    if (p === "payment" && (!form.journal || !plan)) return;
    setPaymentPhase(p);
  }
  function pickProof() { proofInputRef.current?.click(); }
  async function onProofFiles(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setProofError("");
    const validation = validateFile(file, "payment-proof", uploadedFiles, PURPOSE_MAX_SIZE["payment-proof"]);
    if (!validation.valid) { setProofError(validation.errors[0] || "We couldn’t accept that file."); return; }
    const id = crypto.randomUUID();
    const san = sanitizeFilename(file.name);
    const meta: StoredFile = { id, name: san.sanitized, originalName: file.name, sanitized: san.wasSanitized, mimeType: file.type || "application/octet-stream", size: file.size, uploadedAt: new Date().toISOString(), uploader: uploaderName, purpose: "payment-proof", required: true, category: "", notes: "", status: "uploading", progress: 25, uploadedBytes: 0, version: 1, replacedBy: null, error: null };
    setUploadedFiles((prev) => [...prev.filter((f) => !(f.purpose === "payment-proof" && f.status !== "cancelled")), meta]);
    setProofConfirmed(false);
    try {
      await saveBlob(id, file);
      await saveMeta(meta);
    } catch {
      setProofError("We couldn’t store that file in this browser.");
      return;
    }
    window.setTimeout(() => {
      const done: StoredFile = { ...meta, status: "completed", progress: 100, uploadedBytes: meta.size };
      setUploadedFiles((prev) => prev.map((f) => (f.id === id ? done : f)));
      saveMeta(done).catch(() => {});
    }, 650);
  }
  async function removeProof() {
    if (!proofFile) return;
    const id = proofFile.id;
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    setProofConfirmed(false);
    try { await deleteFile(id); } catch {}
  }
  async function downloadProof() {
    if (!proofFile) return;
    const blob = await getBlob(proofFile.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = proofFile.originalName || proofFile.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return <>
    {reference ? (
      <motion.section key="lsf-success" className="submission-success" initial={{ opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} aria-live="polite">
        <div className="submission-success-seal" aria-hidden="true"><Icon name="check" className="h-10 w-10" /></div>
        <p className="eyebrow">{serverSubmitted ? "Submission received" : "Submission saved"}</p>
        <h2>{serverSubmitted ? "Your work is now in editorial hands." : "Your local editorial record is ready."}</h2>
        <p className="submission-success-lead">{serverSubmitted ? "Your manuscript and payment proof have been delivered to the protected editorial desk. We will review them and be in touch by email." : message}</p>
        <aside className="submission-receipt"><p>Submission reference</p><strong><Link href={`/track?reference=${encodeURIComponent(reference)}`}>{reference}</Link></strong><span>{serverSubmitted ? "Use this reference as your tracking ticket. Select it to open your progress at any time." : "Copy or screenshot this reference. Use it in Track Submission to follow progress on this device."}</span>{serverSubmitted ? null : <small>Email receipts will be available once an email service is connected.</small>}</aside>
        <div className="submission-success-actions"><button type="button" className="submission-primary" onClick={() => router.push(`/track?reference=${encodeURIComponent(reference)}`)}>Track Submission <Icon name="arrow" className="h-4 w-4" /></button><button type="button" className="submission-secondary" onClick={() => { setReference(""); setServerSubmitted(false); setSubmitError(""); setStep(0); setForm(emptyForm); setErrors({}); }}>Submit another work</button></div>
      </motion.section>
    ) : (
      <div className="submission-panel">
    <nav className="submission-stepper" aria-label="Submission progress">
      {STEPS.map((s, i) => (
        <Fragment key={s.id}>
          {i > 0 && <span className={`stepper-line ${i <= step ? "is-done" : ""}`} aria-hidden="true" />}
          <button type="button" className={`stepper-item ${i === step ? "active" : ""} ${i < step ? "done" : ""}`} onClick={() => { if (i < step) setStep(i); }} aria-current={i === step ? "step" : undefined}>
            <span className="stepper-icon"><Icon name={s.icon} className="h-5 w-5" /></span>
            <span className="stepper-text"><strong>{s.label}</strong><small>{s.subtitle}</small></span>
          </button>
        </Fragment>
      ))}
    </nav>

    {/* Step 0: Manuscript */}
    {step === 0 && <div className="submission-step">
      <div className="submission-panel-heading">
        <p>Step 1 of 4</p>
        <h2>About the manuscript</h2>
        <span>Add your journal, title, abstract, and upload your files.</span>
      </div>

      <div className="floating-grid">
        <div className={`floating-field ${errors.journal ? "has-error" : ""}`}>
          <label htmlFor="journal">Journal</label>
          <select id="journal" value={form.journal} onChange={(e) => update("journal", e.target.value)} className={form.journal ? "" : "is-placeholder"} required>
            <option value="">Select journal</option>
            {JOURNAL_OPTIONS.map((j) => <option key={j.slug} value={j.slug}>{j.title}</option>)}
          </select>
          {errors.journal && <small className="field-error">{errors.journal}</small>}
        </div>
        <div className="floating-field">
          <label htmlFor="category">Submission category</label>
          <select id="category" value={form.category} onChange={(e) => update("category", e.target.value)} className={form.category ? "" : "is-placeholder"}>
            <option value="">Select category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={`floating-field full ${errors.title ? "has-error" : ""}`}>
          {selectedServerJournal && <div className="submission-issue-assignment" role="status"><strong>{selectedServerJournal.title} · Volume {selectedServerJournal.volume}, Issue {selectedServerJournal.issue}</strong><span>{selectedServerJournal.status} · This assignment is managed by the editorial team.</span></div>}
          <label htmlFor="title">Manuscript title</label>
          <input id="title" type="text" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Enter the full title of your manuscript" required />
          {errors.title && <small className="field-error">{errors.title}</small>}
        </div>
        <div className="floating-field">
          <label>{summaryField}</label>
          <button type="button" className="abstract-trigger" onClick={() => setAbstractOpen(true)} aria-haspopup="dialog">
            <span className={`abstract-trigger-text ${form.summary ? "" : "empty"}`}>{form.summary || summaryPlaceholder}</span>
            <span className="abstract-trigger-meta"><span>{form.summary.length.toLocaleString()}</span><Icon name="edit" className="h-4 w-4" /></span>
          </button>
        </div>
        <div className="floating-field">
          <label htmlFor="keywords">Keywords</label>
          <input id="keywords" type="text" value={form.keywords} onChange={(e) => update("keywords", e.target.value)} placeholder="Enter keywords separated by commas" />
          <small className="field-hint">e.g., education, learning, policy, development</small>
        </div>
      </div>

      <FileUploadSystem
        files={uploadedFiles}
        onFilesChange={setUploadedFiles}
        uploader={uploaderName}
        locked={false}
        showZones={true}
        visiblePurposes={["manuscript"]}
        onContinue={next}
      />
    </div>}

    {/* Step 1: Author */}
    {step === 1 && <div className="submission-step">
      <div className="submission-panel-heading">
        <p>Step 2 of 4</p>
        <h2>About the author</h2>
        <span>Your details stay in this browser. Nothing is uploaded.</span>
      </div>

      <div className="auth-shell">
        <div className="auth-section">
          <div className="auth-section-head">
            <span className="auth-section-icon"><Icon name="person" className="h-4 w-4" /></span>
            <div>
              <h3>Corresponding Author</h3>
              <p>The primary contact for this submission.</p>
            </div>
          </div>

          {expandedAuthor === "primary" ? (
            <motion.div key="primary-open" className="auth-expanded" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
              <div className="aphoto-row">
                <PhotoSlot photo={form.photo} initials={authorInitials(form)} size="lg" verified={!!(form.firstName && form.familyName)} onPick={() => openPhoto("primary")} onRemove={() => removePhoto("primary")} label={form.firstName ? `Edit photo for ${form.firstName}` : "Add your profile photo"} />
                <div className="aphoto-copy">
                  <strong>Profile photo</strong>
                  <p>A clear headshot helps editors and readers recognise you. Optional — stored only in this browser.</p>
                  <div className="aphoto-actions">
                    <button type="button" className="aphoto-btn" onClick={() => openPhoto("primary")}><Icon name="image" className="h-4 w-4" /> {form.photo ? "Edit photo" : "Upload photo"}</button>
                    {form.photo && <button type="button" className="aphoto-btn" onClick={() => downloadPhoto(form.photo, displayName(form) || "author")}><DownloadGlyph className="h-4 w-4" /> Download</button>}
                    {form.photo && <button type="button" className="aphoto-btn ghost" onClick={() => removePhoto("primary")}>Remove</button>}
                  </div>
                  {photoError && <p className="aphoto-error">{photoError}</p>}
                </div>
              </div>
              <div className="floating-grid">
              <div className={`floating-field ${errors.firstName ? "has-error" : ""}`}>
                <label htmlFor="firstName">First name <span className="field-required">*</span></label>
                <input id="firstName" type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="Enter first name" required />
                {errors.firstName && <small className="field-error">{errors.firstName}</small>}
              </div>
              <div className="floating-field">
                <label htmlFor="middleName">Middle initial</label>
                <input id="middleName" type="text" value={form.middleName} onChange={(e) => update("middleName", e.target.value)} placeholder="e.g. L." />
              </div>
              <div className={`floating-field ${errors.familyName ? "has-error" : ""}`}>
                <label htmlFor="familyName">Surname <span className="field-required">*</span></label>
                <input id="familyName" type="text" value={form.familyName} onChange={(e) => update("familyName", e.target.value)} placeholder="Enter surname" required />
                {errors.familyName && <small className="field-error">{errors.familyName}</small>}
              </div>
              <div className="floating-field">
                <label htmlFor="academicTitle">Academic title</label>
                <input id="academicTitle" type="text" value={form.academicTitle} onChange={(e) => update("academicTitle", e.target.value)} placeholder="e.g. LPT, PhD, MAEd" />
                <small className="field-hint">Post-nominal letters, e.g. LPT, PhD, MAEd</small>
              </div>
              <div className={`floating-field ${errors.email ? "has-error" : ""}`}>
                <label htmlFor="email">Email address <span className="field-required">*</span></label>
                <input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="name@example.com" required />
                {errors.email && <small className="field-error">{errors.email}</small>}
              </div>
              <div className="floating-field">
                <label htmlFor="orcid">ORCID <span className="field-optional">(optional)</span></label>
                <input id="orcid" type="text" value={form.orcid} onChange={(e) => update("orcid", e.target.value)} placeholder="0000-0000-0000-0000" />
              </div>
              <div className="floating-field">
                <label htmlFor="occupation">Occupation or role</label>
                <input id="occupation" type="text" value={form.occupation} onChange={(e) => update("occupation", e.target.value)} placeholder="e.g. Assistant Professor" />
              </div>
              <div className="floating-field">
                <label htmlFor="affiliation">Affiliation</label>
                <input id="affiliation" type="text" value={form.affiliation} onChange={(e) => update("affiliation", e.target.value)} placeholder="University or institution" />
              </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="primary-collapsed"
              className="auth-collapsed"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <PhotoSlot photo={form.photo} initials={authorInitials(form)} size="sm" verified={!!(form.firstName && form.familyName && form.email)} onPick={() => openPhoto("primary")} label="Edit corresponding author photo" />
              <button type="button" className="auth-collapsed-main" onClick={() => setExpandedAuthor("primary")} aria-label="Edit corresponding author">
                <span className={`auth-collapsed-name ${displayName(form) ? "" : "empty"}`}>{displayName(form) || "Corresponding author not filled in yet"}</span>
                {form.email && <span className="auth-collapsed-meta">{form.email}</span>}
                <span className="auth-collapsed-edit">Edit <Icon name="edit" className="h-3.5 w-3.5" /></span>
              </button>
            </motion.div>
          )}
        </div>

        <div className="auth-section">
          <div className="auth-section-head">
            <span className="auth-section-icon"><Icon name="users" className="h-4 w-4" /></span>
            <div>
              <h3>Co-Authors {form.coAuthors.length > 0 && <span className="auth-count">{form.coAuthors.length}</span>}</h3>
              <p>Add collaborators who contributed to this work.</p>
            </div>
          </div>

          {form.coAuthors.length > 0 && (
            <div className="auth-coauthor-list">
              <AnimatePresence initial={false} mode="popLayout">
                {form.coAuthors.map((author, idx) => {
                  const coName = coDisplayName(author);
                  return expandedAuthor === author.id ? (
                    <motion.div
                      key={author.id}
                      className="auth-coauthor-card"
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -14, transition: { duration: 0.18 } }}
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    >
                      <div className="auth-coauthor-head">
                        <PhotoSlot photo={author.photo} initials={authorInitials(author)} size="md" order={idx + 1} onPick={() => openPhoto(author.id)} onRemove={() => removePhoto(author.id)} label={`Edit photo for co-author ${idx + 1}`} />
                        <div className="auth-coauthor-titles">
                          <span className="auth-coauthor-label">Co-author {idx + 1}</span>
                          <span className={`auth-coauthor-sub ${author.photo ? "has" : "none"}`}>{author.photo ? "Photo added" : "No photo yet"}</span>
                        </div>
                        {author.photo && <button type="button" className="auth-coauthor-dl" onClick={() => downloadPhoto(author.photo, coDisplayName(author) || `co-author-${idx + 1}`)} aria-label={`Download photo for co-author ${idx + 1}`} title="Download photo"><DownloadGlyph className="h-4 w-4" /></button>}
                        <button type="button" className="auth-coauthor-remove" onClick={() => removeCoAuthor(author.id)} aria-label={`Remove co-author ${idx + 1}`}>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                      <div className="floating-grid">
                        <div className="floating-field">
                          <label>First name</label>
                          <input type="text" value={author.firstName} onChange={(e) => updateCoAuthor(author.id, "firstName", e.target.value)} placeholder="First name" />
                        </div>
                        <div className="floating-field">
                          <label>Middle initial</label>
                          <input type="text" value={author.middleName} onChange={(e) => updateCoAuthor(author.id, "middleName", e.target.value)} placeholder="e.g. L." />
                        </div>
                        <div className="floating-field">
                          <label>Surname</label>
                          <input type="text" value={author.familyName} onChange={(e) => updateCoAuthor(author.id, "familyName", e.target.value)} placeholder="Surname" />
                        </div>
                        <div className="floating-field">
                          <label>Academic title</label>
                          <input type="text" value={author.academicTitle} onChange={(e) => updateCoAuthor(author.id, "academicTitle", e.target.value)} placeholder="e.g. LPT, PhD, MAEd" />
                        </div>
                        <div className={`floating-field ${errors[`co-${author.id}`] ? "has-error" : ""}`}>
                          <label>Email</label>
                          <input type="email" value={author.email} onChange={(e) => updateCoAuthor(author.id, "email", e.target.value)} placeholder="name@example.com" />
                          {errors[`co-${author.id}`] && <small className="field-error">{errors[`co-${author.id}`]}</small>}
                        </div>
                        <div className="floating-field">
                          <label>ORCID <span className="field-optional">(optional)</span></label>
                          <input type="text" value={author.orcid} onChange={(e) => updateCoAuthor(author.id, "orcid", e.target.value)} placeholder="0000-0000-0000-0000" />
                        </div>
                        <div className="floating-field full">
                          <label>Affiliation</label>
                          <input type="text" value={author.affiliation} onChange={(e) => updateCoAuthor(author.id, "affiliation", e.target.value)} placeholder="University or institution" />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={author.id}
                      className="auth-collapsed"
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -14, transition: { duration: 0.18 } }}
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    >
                      <PhotoSlot photo={author.photo} initials={authorInitials(author)} size="sm" order={idx + 1} onPick={() => openPhoto(author.id)} label={`Edit photo for co-author ${idx + 1}`} />
                      <button type="button" className="auth-collapsed-main" onClick={() => setExpandedAuthor(author.id)} aria-label={`Edit co-author ${idx + 1}`}>
                        <span className={`auth-collapsed-name ${coName ? "" : "empty"}`}>{coName || `Co-author ${idx + 1} — not filled in yet`}</span>
                        {author.email && <span className="auth-collapsed-meta">{author.email}</span>}
                        <span className="auth-collapsed-edit">Edit <Icon name="edit" className="h-3.5 w-3.5" /></span>
                      </button>
                      <button type="button" className="auth-coauthor-remove" onClick={() => removeCoAuthor(author.id)} aria-label={`Remove co-author ${idx + 1}`}>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          <button type="button" className="auth-add-btn" onClick={addCoAuthor}>
            <Icon name="plus" className="h-4 w-4" />
            Add co-author
          </button>

          <div className="floating-grid" style={{ marginTop: ".75rem" }}>
            <div className="floating-field full">
              <label htmlFor="coAuthorNote">Note about co-authors <span className="field-optional">(optional)</span></label>
              <input id="coAuthorNote" type="text" value={form.coAuthorNote} onChange={(e) => update("coAuthorNote", e.target.value)} placeholder="e.g. author order, equal contribution, or a short note" />
            </div>
          </div>
        </div>
      </div>

      <div className="auth-footer">
        <div className="auth-footer-note">
          <span><Icon name="lock" className="h-4 w-4" /></span>
          <p>Your details stay in this browser. Nothing is uploaded until you submit.</p>
        </div>
        <div className="auth-footer-actions">
          <button type="button" className="submission-secondary" onClick={back}><Icon name="arrow" className="h-4 w-4 rotate-180" /> Back</button>
          <button type="button" className="submission-primary" onClick={next}>Continue <Icon name="arrow" className="h-4 w-4" /></button>
        </div>
      </div>
    </div>}

    {/* Step 2: Payment */}
    {step === 2 && <div className="submission-step">
      <div className="submission-panel-heading">
        <p>Step 3 of 4</p>
        <h2>Billing &amp; Payment</h2>
        <span>{billingSubtitle}</span>
      </div>

      <div className="bill-layout">
        <div className="bill-main">
          <motion.div key={paymentPhase} className="bill-phase" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>

            {paymentPhase === "configure" && <>
              <div className="bill-section">
                <div className="bill-section-head"><h3>1. Journal type</h3><p>Select the journal or publication type for your submission.</p></div>
                <div className={`bill-select ${journalOpen ? "open" : ""} ${errors.journal ? "has-error" : ""}`} ref={billSelectRef}>
                  <button type="button" className="bill-select-trigger" aria-haspopup="listbox" aria-expanded={journalOpen} onClick={() => setJournalOpen((o) => !o)}>
                    {selectedJournal ? <><Icon name={selectedJournal.icon} className="h-5 w-5 bill-j-ico" /><span>{selectedJournal.longTitle}</span></> : <span className="ph">Select a journal</span>}
                    <ChevDown className={`h-4 w-4 bill-chev ${journalOpen ? "open" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {journalOpen && (
                      <motion.ul className="bill-select-menu" role="listbox" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}>
                        {JOURNAL_OPTIONS.map((j) => (
                          <li key={j.slug}>
                            <button type="button" role="option" aria-selected={form.journal === j.slug} className={`bill-select-option ${form.journal === j.slug ? "is-selected" : ""}`} onClick={() => selectJournal(j.slug)}>
                              <span className="opt-ico"><Icon name={j.icon} className="h-5 w-5" /></span>
                              <span className="opt-copy"><strong>{j.longTitle}</strong><p>{j.blurb}</p></span>
                              {form.journal === j.slug && <Icon name="check" className="h-4 w-4 opt-check" />}
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
                {errors.journal && <small className="field-error bill-err">{errors.journal}</small>}
              </div>

              <div className="bill-section">
                <div className="bill-section-head"><h3>2. Publication plan</h3><p>Choose a publication plan that fits your needs.</p></div>
                <div className="bill-plans">
                  {PUBLICATION_PLANS.map((p) => {
                    const sel = plan === p.id;
                    return (
                      <button type="button" key={p.id} className={`bill-plan ${sel ? "is-selected" : ""}`} aria-pressed={sel} onClick={() => { setPlan(p.id); if (errors.plan) setErrors((prev) => { const n = { ...prev }; delete n.plan; return n; }); }}>
                        {p.recommended && <span className="bill-plan-tag">Recommended</span>}
                        <span className={`bill-radio ${sel ? "on" : ""}`}>{sel && <Icon name="check" className="h-3 w-3" />}</span>
                        <strong>{p.name}</strong>
                        <p>{p.desc}</p>
                        <span className="bill-plan-price">{formatPeso(p.price)}</span>
                        <span className="bill-plan-eta">Est. {p.eta}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.plan && <small className="field-error bill-err">{errors.plan}</small>}
              </div>
            </>}

            {paymentPhase === "payment" && <>
              <div className="bill-section">
                <div className="bill-section-head"><h3>3. Payment method</h3><p>Choose how you would like to pay.</p></div>
                <div className="bill-methods">
                  {PAYMENT_METHODS.map((m) => {
                    const sel = paymentMethod === m.id;
                    return (
                      <button type="button" key={m.id} className={`bill-method ${sel ? "is-selected" : ""}`} aria-pressed={sel} onClick={() => setPaymentMethod(m.id)}>
                        <span className={`bill-radio ${sel ? "on" : ""}`}>{sel && <Icon name="check" className="h-3 w-3" />}</span>
                        <MethodBrand kind={m.kind} />
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.paymentMethod && <small className="field-error bill-err">{errors.paymentMethod}</small>}

                <AnimatePresence initial={false}>
                  {selectedMethod && (
                    <motion.div className="bill-pay" key={selectedMethod.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
                      <div className="bill-pay-in">
                        <div className="bill-pay-grid">
                          <div className="bill-qr">
                            {selectedMethod.kind === "gcash" ? (
                              <>
                                <div className="bill-qr-frame"><QrSvg modules={GCASH_QR} className="bill-qr-svg" /><span className="bill-qr-logo"><MethodBrand kind="gcash" className="sm" /></span></div>
                                <span className="bill-qr-cap">SCAN TO PAY WITH GCASH</span>
                              </>
                            ) : (
                              <>
                                <div className={`bill-qr-tile ${selectedMethod.kind}`}><MethodBrand kind={selectedMethod.kind} className="lg" /></div>
                                <span className="bill-qr-cap">{selectedMethod.kind === "maya" ? "SEND VIA MAYA" : "BANK TRANSFER"}</span>
                              </>
                            )}
                          </div>
                          <div className="bill-pay-details">
                            <div className="bill-pay-head"><MethodBrand kind={selectedMethod.kind} className="sm" /><strong>{selectedMethod.name}</strong><span className="bill-pay-ready"><Icon name="check" className="h-3 w-3" /> Ready to pay</span></div>
                            <p className="bill-pay-sub">{selectedMethod.scanLabel}</p>
                            <div className="bill-pay-rows">
                              {selectedMethod.bank && (
                                <div className="bill-pay-row"><span>Bank</span><strong>{selectedMethod.bank}</strong><button type="button" className={`copy-btn ${copiedKey === `${selectedMethod.id}-bank` ? "copied" : ""}`} onClick={() => copyValue(`${selectedMethod.id}-bank`, selectedMethod.bank || "")} aria-label="Copy bank name">{copiedKey === `${selectedMethod.id}-bank` ? <Icon name="check" className="h-3.5 w-3.5" /> : <CopyGlyph className="h-3.5 w-3.5" />}</button></div>
                              )}
                              <div className="bill-pay-row"><span>Account Name</span><strong>{selectedMethod.accountName}</strong><button type="button" className={`copy-btn ${copiedKey === `${selectedMethod.id}-name` ? "copied" : ""}`} onClick={() => copyValue(`${selectedMethod.id}-name`, selectedMethod.accountName)} aria-label="Copy account name">{copiedKey === `${selectedMethod.id}-name` ? <Icon name="check" className="h-3.5 w-3.5" /> : <CopyGlyph className="h-3.5 w-3.5" />}</button></div>
                              {selectedMethod.number && (
                                <div className="bill-pay-row"><span>Mobile Number</span><strong>{selectedMethod.number}</strong><button type="button" className={`copy-btn ${copiedKey === `${selectedMethod.id}-num` ? "copied" : ""}`} onClick={() => copyValue(`${selectedMethod.id}-num`, selectedMethod.number || "")} aria-label="Copy mobile number">{copiedKey === `${selectedMethod.id}-num` ? <Icon name="check" className="h-3.5 w-3.5" /> : <CopyGlyph className="h-3.5 w-3.5" />}</button></div>
                              )}
                              {selectedMethod.accountNumber && (
                                <div className="bill-pay-row"><span>Account Number</span><strong>{selectedMethod.accountNumber}</strong><button type="button" className={`copy-btn ${copiedKey === `${selectedMethod.id}-acc` ? "copied" : ""}`} onClick={() => copyValue(`${selectedMethod.id}-acc`, selectedMethod.accountNumber || "")} aria-label="Copy account number">{copiedKey === `${selectedMethod.id}-acc` ? <Icon name="check" className="h-3.5 w-3.5" /> : <CopyGlyph className="h-3.5 w-3.5" />}</button></div>
                              )}
                              <div className="bill-pay-row amount"><span>Amount Due</span><strong>{formatPeso(total)}</strong></div>
                            </div>
                            <div className="bill-pay-note"><InfoGlyph className="h-4 w-4" /><p>{selectedMethod.note}</p></div>
                          </div>
                        </div>
                        {otherMethods.length > 0 && (
                          <div className="bill-switch">
                            {otherMethods.map((m) => (
                              <button type="button" key={m.id} className="bill-switch-btn" onClick={() => setPaymentMethod(m.id)}><MethodBrand kind={m.kind} className="xs" /> Switch to {m.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="bill-section">
                <div className="bill-section-head"><h3>4. Proof of Payment</h3><p>Enter your transaction reference number and upload proof of payment.</p></div>
                <div className={`floating-field full ${errors.paymentRef ? "has-error" : ""}`}>
                  <label htmlFor="paymentRef">Transaction reference number <span className="field-required">*</span></label>
                  <input id="paymentRef" type="text" value={paymentRef} onChange={(e) => { setPaymentRef(e.target.value); if (errors.paymentRef) setErrors((prev) => { const n = { ...prev }; delete n.paymentRef; return n; }); }} placeholder="e.g., GCA-2026-001245" />
                  <small className="field-hint">This reference number is required for faster verification of your payment.</small>
                  {errors.paymentRef && <small className="field-error">{errors.paymentRef}</small>}
                </div>

                <label className="bill-drop-label">Upload receipt or transaction screenshot <span className="field-required">*</span></label>
                <input ref={proofInputRef} type="file" accept={PURPOSE_ACCEPT["payment-proof"]} className="bill-hidden-input" onChange={(e) => { onProofFiles(e.target.files); e.target.value = ""; }} />
                {!proofFile ? (
                  <div className={`bill-drop ${proofDrag ? "drag" : ""}`} role="button" tabIndex={0} onClick={pickProof} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickProof(); } }} onDragOver={(e) => { e.preventDefault(); setProofDrag(true); }} onDragLeave={() => setProofDrag(false)} onDrop={(e) => { e.preventDefault(); setProofDrag(false); onProofFiles(e.dataTransfer.files); }}>
                    <span className="drop-ico"><Icon name="cloud" className="h-6 w-6" /></span>
                    <span className="drop-title">Drag and drop your file here, or click to <span className="drop-browse">browse</span></span>
                    <span className="drop-sub">Upload a clear receipt or screenshot of your transaction.</span>
                    <span className="drop-chips"><span>JPG</span><span>PNG</span><span>PDF</span><span className="muted">Max file size: 10MB</span></span>
                  </div>
                ) : (
                  <div className="bill-file">
                    <span className="bf-ico"><Icon name={proofFile.mimeType === "application/pdf" ? "file" : "image"} className="h-5 w-5" /></span>
                    <span className="bf-main"><strong>{proofFile.originalName || proofFile.name}</strong><span>{formatBytes(proofFile.size)}</span></span>
                    {proofFile.status === "completed" ? <span className="bill-verified"><Icon name="check" className="h-3.5 w-3.5" /> Verified</span> : <span className="bill-uploading"><span className="bill-spin" /> Verifying…</span>}
                    <span className="bf-actions">
                      <button type="button" onClick={downloadProof} aria-label="Download receipt" disabled={proofFile.status !== "completed"}><DownloadGlyph className="h-4 w-4" /></button>
                      <button type="button" onClick={removeProof} aria-label="Remove receipt"><TrashGlyph className="h-4 w-4" /></button>
                    </span>
                  </div>
                )}
                {proofError && <small className="field-error bill-err">{proofError}</small>}
                {errors.payment && <small className="field-error bill-err">{errors.payment}</small>}

                <label className="check-row bill-confirm">
                  <input type="checkbox" checked={proofConfirmed} onChange={(e) => { setProofConfirmed(e.target.checked); if (errors.proofConfirm) setErrors((prev) => { const n = { ...prev }; delete n.proofConfirm; return n; }); }} />
                  <span className="check-box" aria-hidden="true"><Icon name="check" className="h-3 w-3" /></span>
                  <span className="bill-confirm-text">I have reviewed the uploaded file and confirmed that it is correct.</span>
                </label>
                {errors.proofConfirm && <small className="field-error bill-err">{errors.proofConfirm}</small>}
              </div>
            </>}

          </motion.div>

          <div className="bill-footer">
            <button type="button" className="bill-btn bill-btn--outline" onClick={paymentPhase === "configure" ? back : () => goPhase("configure")}><Icon name="arrow" className="h-4 w-4 rotate-180" /> Back</button>
            {paymentPhase === "payment" && <button type="button" className="bill-btn bill-btn--primary" onClick={next} disabled={!canPaymentContinue}>Continue to Review <Icon name="arrow" className="h-4 w-4" /></button>}
          </div>
        </div>

        <aside className="os-card">
          <div className="os-head"><DocGlyph className="h-5 w-5" /><h3>Order Summary</h3></div>

          <div className="os-row"><span>Journal</span><strong className={selectedJournal ? "" : "os-muted"}>{selectedJournal ? selectedJournal.longTitle : "Not selected"}</strong></div>
          <div className="os-row"><span>Plan</span><strong className={selectedPlan ? "" : "os-muted"}>{selectedPlan ? selectedPlan.name : "Not selected"}</strong></div>
          {paymentPhase !== "payment" && (
            <div className="os-row">
              <span>Payment method</span>
              {selectedMethod ? <strong className="os-brand-val"><MethodBrand kind={selectedMethod.kind} className="xs" />{selectedMethod.name}</strong> : <strong className="os-muted">Not selected</strong>}
            </div>
          )}

          <div className="os-divider" />
          <div className="os-row"><span>Subtotal</span><strong>{formatPeso(subtotal)}</strong></div>
          {discount > 0 && (
            <div className="os-row">
              <span>Discount <button type="button" className="os-tag" onClick={clearPromo} title="Remove promo code"><TagGlyph className="h-3 w-3" />{appliedPromo}<span className="os-tag-x" aria-hidden="true">×</span></button></span>
              <strong className="os-discount">-{formatPeso(discount)}</strong>
            </div>
          )}
          <div className="os-divider" />
          <div className="os-total"><span>Total</span><strong>{formatPeso(total)}</strong></div>

          {discount > 0 && <div className="os-save"><TagGlyph className="h-4 w-4" /><p>You saved <strong>{formatPeso(discount)}</strong> with code <strong>{appliedPromo}</strong>.</p></div>}
          {paymentPhase === "configure" && !canConfigureContinue && <div className="os-note"><InfoGlyph className="h-4 w-4" /><p>Select a journal and plan to see your total.</p></div>}

          {paymentPhase === "payment" && (
            <div className="os-method">
              <span className="os-method-label">Payment method</span>
              {selectedMethod ? (
                <div className="os-method-row"><MethodBrand kind={selectedMethod.kind} className="xs" /><strong>{selectedMethod.name}</strong><button type="button" className="bill-btn bill-btn--ghost bill-btn--sm" onClick={() => setPaymentMethod("")}>Change</button></div>
              ) : (
                <div className="os-method-row"><span className="os-muted">Not selected</span></div>
              )}
            </div>
          )}

          {paymentPhase === "payment" && <>
            <div className="os-status os-status--warn"><ClockGlyph className="h-4 w-4" /><div><span className="os-status-head">Payment status <em>Awaiting verification</em></span><p>Your payment is being verified. You will receive a confirmation once it is approved.</p></div></div>
            <div className="os-status os-status--info"><InfoGlyph className="h-4 w-4" /><p>Your reference number and uploaded receipt will be used to verify your payment.</p></div>
          </>}

          {paymentPhase === "configure" && (
            <div className="os-promo">
              <label htmlFor="promoInput">Promo code <span className="os-opt">(optional)</span></label>
              <div className="os-promo-row">
                <input id="promoInput" type="text" value={promoInput} onChange={(e) => { setPromoInput(e.target.value); if (promoError) setPromoError(""); }} placeholder="Enter code" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }} aria-invalid={!!promoError} />
                <button type="button" className="bill-btn bill-btn--ghost" onClick={applyPromo}>Apply</button>
              </div>
              {promoError && <small className="field-error bill-err">{promoError}</small>}
            </div>
          )}

          {paymentPhase === "configure" && (
            <button type="button" className="bill-btn bill-btn--primary bill-btn--block" disabled={!canConfigureContinue} onClick={() => goPhase("payment")}>
              Continue to Payment <Icon name="arrow" className="h-4 w-4" />
            </button>
          )}

          <div className="os-secure"><Icon name="lock" className="h-3.5 w-3.5" /> Secure and encrypted checkout</div>
        </aside>
      </div>
    </div>}

    {/* Step 3: Review */}
    {step === 3 && <div className="submission-step">
      <div className="submission-panel-heading">
        <p>Step 4 of 4</p>
        <h2>Review &amp; confirm</h2>
        <span>Confirm your manuscript, billing, and payment proof before submitting.</span>
      </div>

      <div className="review-top">
        <div className="review-card">
          <div className="review-card-head"><h3>Manuscript details</h3><button type="button" className="review-edit" onClick={() => setStep(0)}>Edit</button></div>
          <DetailRow icon={<Icon name="file" className="h-4 w-4" />} label="Title" value={form.title || "—"} />
          <DetailRow icon={<Icon name="tag" className="h-4 w-4" />} label="Article type" value={form.category || "—"} />
          <DetailRow icon={<Icon name="list" className="h-4 w-4" />} label={summaryField} value={`${abstractWords} words`} />
          <DetailRow icon={<Icon name="users" className="h-4 w-4" />} label="Co-authors" value={String(form.coAuthors.length)} />
        </div>
        <div className="review-card">
          <div className="review-card-head"><h3>Author details {multipleAuthors && <span className="auth-count">{reviewAuthors.length}</span>}</h3><button type="button" className="review-edit" onClick={() => setStep(1)}>Edit</button></div>

          {multipleAuthors ? (
            <div className="rauthor-list">
              {reviewAuthors.map((a, idx) => {
                const open = expandedReviewAuthor === a.id;
                return (
                  <div key={a.id} className={`rauthor ${open ? "open" : ""}`}>
                    <button type="button" className="rauthor-head" onClick={() => setExpandedReviewAuthor(open ? null : a.id)} aria-expanded={open}>
                      <PhotoSlot photo={a.photo} initials={a.initials} size="xs" order={idx + 1} interactive={false} label="" />
                      <span className="rauthor-name">{a.name || `Author ${idx + 1}`}</span>
                      {a.isPrimary && <span className="rauthor-badge">Corresponding</span>}
                      <span className="rauthor-chev" aria-hidden="true"><Icon name="arrow" className="h-4 w-4" /></span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div key="body" className="rauthor-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                          <div className="rauthor-body-in">
                            <div className="rauthor-photo-row">
                              <PhotoSlot photo={a.photo} initials={a.initials} size="md" verified interactive={false} label="" />
                              <div className="rauthor-photo-meta"><strong>{a.name || "—"}</strong><span>{a.role}{a.isPrimary ? " · Corresponding author" : ""}</span></div>
                              {a.photo && <button type="button" className="aphoto-btn" onClick={() => downloadPhoto(a.photo, a.name || `author-${idx + 1}`)}><DownloadGlyph className="h-4 w-4" /> Download</button>}
                            </div>
                            <DetailRow icon={<Icon name="building" className="h-4 w-4" />} label="Affiliation" value={a.affiliation || "—"} />
                            <DetailRow icon={<Icon name="mail" className="h-4 w-4" />} label="Email" value={a.email || "—"} />
                            {a.orcid && <DetailRow icon={<Icon name="globe" className="h-4 w-4" />} label="ORCID" value={a.orcid} />}
                            <button type="button" className="rauthor-close" onClick={() => setExpandedReviewAuthor(null)}>
                              <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" /> Back to author list
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="rauthor-single">
                <PhotoSlot photo={reviewAuthors[0].photo} initials={reviewAuthors[0].initials} size="md" verified interactive={false} label="" />
                <div><strong>{reviewAuthors[0].name || "—"}</strong><span>{reviewAuthors[0].role}</span></div>
                {reviewAuthors[0].photo && <button type="button" className="aphoto-btn" onClick={() => downloadPhoto(reviewAuthors[0].photo, reviewAuthors[0].name || "author")}><DownloadGlyph className="h-4 w-4" /> Download</button>}
              </div>
              <DetailRow icon={<Icon name="building" className="h-4 w-4" />} label="Affiliation" value={reviewAuthors[0].affiliation || "—"} />
              <DetailRow icon={<Icon name="mail" className="h-4 w-4" />} label="Email" value={reviewAuthors[0].email || "—"} />
              {reviewAuthors[0].orcid && <DetailRow icon={<Icon name="globe" className="h-4 w-4" />} label="ORCID" value={reviewAuthors[0].orcid} />}
            </>
          )}
        </div>
      </div>

      <div className="review-bottom">
        <div className="review-card review-card-wide">
          <FileChecklist files={uploadedFiles} onPreview={setPreviewFile} onEdit={() => setStep(0)} />
        </div>

        <div className="review-card">
          <div className="review-card-head"><h3>Submission checklist</h3></div>
          <div className="submission-checklist">
            <label className="check-row">
              <input type="checkbox" checked={confirmations.original} onChange={() => toggleConfirm("original")} />
              <span className="check-box" aria-hidden="true"><Icon name="check" className="h-3 w-3" /></span>
              <span className="check-copy"><strong>Original work</strong><p>I confirm this manuscript is original and has not been published elsewhere.</p></span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={confirmations.authorsApprove} onChange={() => toggleConfirm("authorsApprove")} />
              <span className="check-box" aria-hidden="true"><Icon name="check" className="h-3 w-3" /></span>
              <span className="check-copy"><strong>All authors approve</strong><p>I confirm all authors have reviewed and approved this submission.</p></span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={confirmations.policies} onChange={() => toggleConfirm("policies")} />
              <span className="check-box" aria-hidden="true"><Icon name="check" className="h-3 w-3" /></span>
              <span className="check-copy"><strong>Editorial policies</strong><p>I agree to Talikha Publishing&apos;s editorial policies and author guidelines.</p></span>
            </label>
          </div>
          <Link href={POLICIES_URL} className="checklist-link">View editorial policies <Icon name="external" className="h-3.5 w-3.5" /></Link>
          {checklistTouched && !allConfirmed && <p className="checklist-error">Please confirm all three statements before submitting.</p>}
          {checklistTouched && !filesReady && <p className="checklist-error">Required files must be uploaded and validated before submitting.</p>}
          {checklistTouched && uploading && <p className="checklist-error">Please wait for all uploads to complete.</p>}
        </div>

        <div className="review-card">
          <div className="review-card-head"><h3>Reference &amp; tracking</h3></div>
          <div className="reference-banner">
            <Icon name="shield" className="h-5 w-5" />
            <span>After submission, you&apos;ll receive a unique tracking number to monitor your review progress.</span>
          </div>
          <div className="reference-meta">
            <div><span>Reference will be issued to</span><strong>{form.email || "your email address"}</strong></div>
            <div><span>Tracking notifications via</span><strong>Email updates</strong></div>
            <div><span>You can always check status using</span><Link href="/track">Track submission <Icon name="arrow" className="h-3.5 w-3.5" /></Link></div>
          </div>
        </div>

        <div className="review-card br-card">
          <div className="br-row"><span className="br-ico"><Icon name={selectedJournal?.icon ?? "book"} className="h-5 w-5" /></span><span className="br-col"><small>Journal type</small><strong>{selectedJournal?.longTitle ?? "—"}</strong></span></div>
          <div className="br-row"><span className="br-ico"><Icon name="file" className="h-5 w-5" /></span><span className="br-col"><small>Publication plan</small><strong>{selectedPlan?.name ?? "—"}</strong></span></div>
          <div className="br-row"><span className="br-ico plain">{selectedMethod ? <MethodBrand kind={selectedMethod.kind} className="sm" /> : <Icon name="card" className="h-5 w-5" />}</span><span className="br-col"><small>Payment method</small><strong>{selectedMethod?.name ?? "—"}</strong></span></div>
          <div className="br-row"><span className="br-ico"><Icon name="file" className="h-5 w-5" /></span><span className="br-col"><small>Transaction reference number</small><strong>{paymentRef || "—"}</strong></span></div>
        </div>

        <div className="review-card br-card">
          <div className="br-proof-head"><span className="br-ico"><Icon name="paperclip" className="h-5 w-5" /></span><div><h3>Uploaded proof</h3><p>Please ensure your proof of payment is clear and complete.</p></div></div>
          {proofFile ? (
            <div className="br-file"><span className="bf-ico"><Icon name={proofFile.mimeType === "application/pdf" ? "file" : "image"} className="h-5 w-5" /></span><span className="bf-main"><strong>{proofFile.originalName || proofFile.name}</strong><span>{proofFile.mimeType === "application/pdf" ? "PDF" : "JPEG"} · {formatBytes(proofFile.size)}</span></span><span className="bill-verified"><Icon name="check" className="h-3.5 w-3.5" /> Verified</span></div>
          ) : (
            <p className="fchecklist-empty">No proof of payment uploaded.</p>
          )}
          <div className="br-notes"><InfoGlyph className="h-4 w-4" /><div><strong>Important notes</strong><p>Your payment and proof will be verified by our editorial team. You will receive a confirmation once verification is complete.</p></div></div>
          <div className="submission-checklist br-checks">
            <label className="check-row"><input type="checkbox" checked={confirmations.billingAccurate} onChange={() => toggleConfirm("billingAccurate")} /><span className="check-box" aria-hidden="true"><Icon name="check" className="h-3 w-3" /></span><span className="bill-confirm-text">I confirm that all payment details and uploaded proof are accurate.</span></label>
            <label className="check-row"><input type="checkbox" checked={confirmations.billingDelay} onChange={() => toggleConfirm("billingDelay")} /><span className="check-box" aria-hidden="true"><Icon name="check" className="h-3 w-3" /></span><span className="bill-confirm-text">I understand that incorrect or incomplete details may delay verification and publication.</span></label>
          </div>
          {checklistTouched && (!confirmations.billingAccurate || !confirmations.billingDelay) && <p className="checklist-error">Please confirm both billing statements before submitting.</p>}
        </div>
      </div>
    </div>}

    {step === 3 && <div className="submission-footer">
      <div className="footer-note">
        <span><Icon name="lock" className="h-4 w-4" /></span>
        {step === lastStep ? (
          <p>Your data and files are securely processed and stored.<br />We never share your information with third parties.</p>
        ) : (
          <p>No files, email addresses, or submission details leave this browser.<br />Open the Talikha admin panel on this device to review saved entries.</p>
        )}
      </div>
      <div className="footer-actions">
        {step > 0 && <button type="button" className="submission-secondary" onClick={back}><Icon name="arrow" className="h-4 w-4 rotate-180" /> Back to billing</button>}
        {step < lastStep && <button type="button" className="submission-primary" onClick={next}>Continue <Icon name="arrow" className="h-4 w-4" /></button>}
        {submitError && <p role="alert" style={{ margin: "0 0 12px", padding: "10px 14px", borderRadius: 12, background: "#fdecec", color: "#9f1d1d", fontSize: 14, fontWeight: 600 }}>{submitError}</p>}
        {step === lastStep && <button type="button" className="submission-primary" onClick={submit} disabled={uploading || submitting}>{submitting ? "Submitting…" : uploading ? "Uploading…" : "Confirm & submit"} <Icon name="arrow" className="h-4 w-4" /></button>}
      </div>
    </div>}

    <AnimatePresence>
      {abstractOpen && (
        <motion.div
          key="abstract-overlay"
          className="abstract-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
          onClick={() => setAbstractOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={summaryField}
        >
          <motion.div
            className="abstract-modal"
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ type: "tween", duration: 0.17, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "center center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="abstract-modal-head">
              <h3>{summaryField}</h3>
              <p className="abstract-modal-hint">{summaryHint}</p>
            </div>
            <div className="abstract-modal-body">
              <textarea ref={abstractRef} value={form.summary} onChange={(e) => update("summary", e.target.value)} maxLength={10000} placeholder={summaryPlaceholder} />
            </div>
            <div className="abstract-modal-foot">
              <span className="abstract-counter">{form.summary.length.toLocaleString()} / 10,000 characters</span>
              <button type="button" className="submission-primary" onClick={() => setAbstractOpen(false)}>Done</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}

    <AnimatePresence>
      {photoCrop && (
        <AuthorPhotoCropper
          key="author-photo-crop"
          src={photoCrop.src}
          title={photoCrop.target === "primary" ? (displayName(form) || "Corresponding author") : (coDisplayName(form.coAuthors.find((a) => a.id === photoCrop.target) ?? { firstName: "", middleName: "", familyName: "", academicTitle: "" }) || "Co-author")}
          onCancel={cancelPhoto}
          onConfirm={confirmPhoto}
        />
      )}
    </AnimatePresence>
      </div>
    )}
    <AnimatePresence>
      {submitting && <SubmissionProcessing key="lsf-processing" phase={processingPhase} step={processingStep} reference={reference} serverSubmitted={serverSubmitted} errorMessage={submitError} onRetry={retrySubmit} onBack={cancelProcessing} />}
    </AnimatePresence>
  </>;
}

const TEMP_JOURNALS: JournalOption[] = [
  { slug: "inquira", title: "InQuira", longTitle: "InQuira Research Journal", scope: "Research & scholarship", blurb: "Peer-reviewed research articles across all disciplines.", icon: "book", summaryField: "Abstract", summaryHint: "Summarize the study — its purpose, method, and key findings." },
  { slug: "lumera", title: "Lumera", longTitle: "Lumera Literary Journal", scope: "Essays, poetry & fiction", blurb: "Creative works, essays, and literary studies.", icon: "feather", summaryField: "Description", summaryHint: "Describe what your piece is about — its theme, voice, and intent." },
];
