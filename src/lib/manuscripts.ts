import "server-only";

import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { AdminUser } from "@/lib/auth";
import {
  blankManuscriptEditorState,
  defaultManuscriptPageSettings,
  manuscriptParagraphs,
  manuscriptPlainTextFromState,
  manuscriptVerificationKeys,
  manuscriptWordCount,
  type LinkedFieldBinding,
  type ManuscriptDetail,
  type ManuscriptDocument,
  type ManuscriptDraft,
  type ManuscriptEditorState,
  type ManuscriptFieldValue,
  type ManuscriptImportPayload,
  type ManuscriptImportReport,
  type ManuscriptJson,
  type ManuscriptManualConfirmations,
  type ManuscriptPageSettings,
  type ManuscriptSubmissionSummary,
  type ManuscriptVersion,
} from "@/lib/manuscript-editor-contract";
import { renderManuscriptDocx, renderManuscriptPdf, type ManuscriptExportInput } from "@/lib/manuscript-export";
import { calculateTextCoverage, extractManuscriptSource } from "@/lib/manuscript-import-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

const LEASE_SECONDS = 120;
const EDITOR_STATE_LIMIT = 10 * 1024 * 1024;
const CONTENT_TEXT_LIMIT = 4 * 1024 * 1024;
const MAX_NODES = 50_000;
const MAX_IMAGES = 100;

const eligibleStages = [
  "review_accepted",
  "production_ready",
  "production_preparation",
  "production_proof",
  "production_records",
  "production_ready_to_publish",
  "production_scheduled",
  "published",
] as const;

const stageLabels: Record<string, string> = {
  review_accepted: "Accepted",
  production_ready: "Ready for production",
  production_preparation: "Manuscript preparation",
  production_proof: "Author proof",
  production_records: "Publication records",
  production_ready_to_publish: "Ready to publish",
  production_scheduled: "Scheduled",
  published: "Published",
};

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type JsonRecord = Record<string, unknown>;

export class ManuscriptServiceError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "MANUSCRIPT_ERROR") {
    super(message);
    this.name = "ManuscriptServiceError";
  }
}

const objectValue = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const arrayValue = (value: unknown): JsonRecord[] => Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
const firstRelation = (value: unknown): JsonRecord => Array.isArray(value) ? objectValue(value[0]) : objectValue(value);
const stringValue = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);
const uuidValue = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
const nowIso = () => new Date().toISOString();
const leaseExpiry = () => new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
const isExpired = (value: string | null | undefined) => !value || new Date(value).getTime() <= Date.now();
const isLocalDevelopmentUser = (user: AdminUser) => process.env.NODE_ENV !== "production" && user.id === "local-development-admin";

function asJson(value: unknown): Json {
  return value as Json;
}

function asEditorState(value: unknown): ManuscriptEditorState {
  const root = objectValue(objectValue(value).root);
  if (root.type !== "root" || !Array.isArray(root.children)) return blankManuscriptEditorState;
  return value as ManuscriptEditorState;
}

function asPageSettings(value: unknown): ManuscriptPageSettings {
  const settings = objectValue(value);
  return {
    ...defaultManuscriptPageSettings,
    ...settings,
    size: "A4",
    orientation: settings.orientation === "landscape" ? "landscape" : "portrait",
    marginTopMm: boundedNumber(settings.marginTopMm, 5, 60, 25.4),
    marginRightMm: boundedNumber(settings.marginRightMm, 5, 60, 25.4),
    marginBottomMm: boundedNumber(settings.marginBottomMm, 5, 60, 25.4),
    marginLeftMm: boundedNumber(settings.marginLeftMm, 5, 60, 25.4),
    headerText: stringValue(settings.headerText).slice(0, 300),
    footerText: stringValue(settings.footerText).slice(0, 300),
    pageNumbers: settings.pageNumbers !== false,
    showGrid: settings.showGrid === true,
    showRuler: settings.showRuler !== false,
  };
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function asBindings(value: unknown): LinkedFieldBinding[] {
  return arrayValue(value).map((item): LinkedFieldBinding => ({
    key: stringValue(item.key),
    label: stringValue(item.label),
    group: item.group === "Authors" || item.group === "Publication" ? item.group : "Submission",
    kind: item.kind === "image" ? "image" : "text",
    value: stringValue(item.value),
    sourcePath: stringValue(item.sourcePath),
    authorPosition: Number.isInteger(item.authorPosition) ? Number(item.authorPosition) : undefined,
    fileId: typeof item.fileId === "string" ? item.fileId : null,
    private: item.private === true,
    lastAppliedValue: stringValue(item.lastAppliedValue ?? item.value),
    overridden: item.overridden === true,
    frozen: item.frozen === true,
  })).filter((item) => item.key);
}

function asFieldSnapshot(value: unknown) {
  return Object.fromEntries(Object.entries(objectValue(value)).map(([key, item]) => [key, objectValue(item) as ManuscriptFieldValue]));
}

function asImportReport(value: unknown): ManuscriptImportReport | null {
  const report = objectValue(value);
  return report.format === "docx" || report.format === "pdf" ? report as ManuscriptImportReport : null;
}

function asConfirmations(value: unknown): ManuscriptManualConfirmations {
  const source = objectValue(value);
  return Object.fromEntries(manuscriptVerificationKeys.map((key) => [key, source[key] === true]));
}

function hashDraft(editorState: ManuscriptEditorState, pageSettings: ManuscriptPageSettings, contentText: string) {
  return createHash("sha256").update(JSON.stringify({ editorState, pageSettings, contentText })).digest("hex");
}

function inspectNodeLimits(value: unknown) {
  let nodes = 0;
  let images = 0;
  let embeddedImageBytes = 0;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    nodes += 1;
    if (nodes > MAX_NODES) throw new ManuscriptServiceError("This draft contains too many document nodes.", 413, "NODE_LIMIT");
    const record = node as JsonRecord;
    if (record.type === "image" || record.type === "linked-image") {
      images += 1;
      const source = stringValue(record.src);
      if (source.startsWith("data:")) embeddedImageBytes += Math.ceil((source.split(",")[1]?.length || 0) * 0.75);
    }
    if (images > MAX_IMAGES || embeddedImageBytes > 20 * 1024 * 1024) throw new ManuscriptServiceError("This draft contains too many or excessively large images.", 413, "IMAGE_LIMIT");
    Object.values(record).forEach((child) => {
      if (Array.isArray(child)) child.forEach(visit);
    });
  };
  visit(value);
}

function validateDraft(editorState: ManuscriptEditorState, contentText: string) {
  const serialized = JSON.stringify(editorState);
  if (Buffer.byteLength(serialized, "utf8") > EDITOR_STATE_LIMIT) throw new ManuscriptServiceError("This draft is too large to save safely.", 413, "DRAFT_LIMIT");
  if (Buffer.byteLength(contentText, "utf8") > CONTENT_TEXT_LIMIT) throw new ManuscriptServiceError("This manuscript contains too much plain text for one draft.", 413, "TEXT_LIMIT");
  inspectNodeLimits(editorState);
}

function fieldNode(field: ManuscriptFieldValue, style = "") {
  return {
    detail: 0,
    format: 0,
    mode: "normal",
    style,
    text: field.value,
    type: "linked-field",
    version: 1,
    fieldKey: field.key,
    fieldLabel: field.label,
    sourcePath: field.sourcePath,
    sourceValue: field.value,
    overridden: false,
    frozen: false,
    private: field.private === true,
  };
}

function textNode(text: string, format = 0, style = "") {
  return { detail: 0, format, mode: "normal", style, text, type: "text", version: 1 };
}

function paragraph(children: ManuscriptJson[], format = "left", extra: JsonRecord = {}) {
  return { children, direction: null, format, indent: 0, type: "manuscript-paragraph", version: 1, spacingAfterPt: 6, lineSpacing: 1.5, ...extra };
}

function headingNode(children: ManuscriptJson[], tag: "h1" | "h2") {
  return { children, direction: null, format: tag === "h1" ? "center" : "left", indent: 0, type: "heading", version: 1, tag };
}

function buildInitialEditorState(fields: ManuscriptFieldValue[]): ManuscriptEditorState {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const title = byKey.get("submission.title");
  const abstract = byKey.get("submission.abstract");
  const authorNames = fields.filter((field) => /^author\.\d+\.name$/.test(field.key));
  const affiliations = fields.filter((field) => /^author\.\d+\.affiliation$/.test(field.key) && field.value);
  const authorChildren: ManuscriptJson[] = [];
  authorNames.forEach((field, index) => {
    if (index) authorChildren.push(textNode(", "));
    authorChildren.push(fieldNode(field, "font-family: Liberation Serif; font-size: 12pt;"));
  });
  const affiliationChildren: ManuscriptJson[] = [];
  affiliations.forEach((field, index) => {
    if (index) affiliationChildren.push(textNode(" · "));
    affiliationChildren.push(fieldNode(field, "font-family: Liberation Serif; font-size: 10pt;"));
  });
  const children: ManuscriptJson[] = [];
  if (title) children.push(headingNode([fieldNode(title, "font-family: Liberation Serif; font-size: 16pt;")], "h1") as ManuscriptJson);
  if (authorChildren.length) children.push(paragraph(authorChildren, "center", { spacingAfterPt: 3 }) as ManuscriptJson);
  if (affiliationChildren.length) children.push(paragraph(affiliationChildren, "center", { spacingAfterPt: 12 }) as ManuscriptJson);
  if (abstract?.value) {
    children.push(headingNode([textNode("Abstract")], "h2") as ManuscriptJson);
    children.push(paragraph([fieldNode(abstract, "font-family: Liberation Serif; font-size: 12pt;")], "justify") as ManuscriptJson);
  }
  children.push(paragraph([], "left") as ManuscriptJson);
  return { root: { children, direction: null, format: "", indent: 0, type: "root", version: 1 } };
}

function bindingsFor(fields: ManuscriptFieldValue[]): LinkedFieldBinding[] {
  return fields.map((field) => ({ ...field, lastAppliedValue: field.value, overridden: false, frozen: false }));
}

function snapshotFor(fields: ManuscriptFieldValue[]) {
  return Object.fromEntries(fields.map((field) => [field.key, field]));
}

function authorDetailsFromSnapshot(submission: JsonRecord): JsonRecord[] {
  return arrayValue(submission.author_details).map((author, index) => ({
    position: index + 1,
    first_name: stringValue(author.firstName),
    middle_initial: stringValue(author.middleInitial),
    surname: stringValue(author.surname),
    position_title: stringValue(author.position),
    academic_title: stringValue(author.academicTitle),
    email: stringValue(author.email),
    institution: stringValue(author.institution),
    affiliation: stringValue(author.affiliation || author.institution),
    orcid: stringValue(author.orcid),
    photo_file_id: null,
  }));
}

async function sourceFields(admin: AdminClient, submissionId: string): Promise<ManuscriptFieldValue[]> {
  const [submissionResult, authorsResult, recordResult] = await Promise.all([
    admin.from("submissions").select("id,reference,tracking_number,title,abstract,publication_type,author_name,author_email,affiliation,author_details,preferred_journal_id,assigned_issue_id,journal_title_snapshot,volume_snapshot,issue_snapshot,preferred_journal:journals(title),assigned_issue:issues(volume,issue_number,publication_date)").eq("id", submissionId).maybeSingle(),
    admin.from("submission_authors").select("position,first_name,middle_initial,surname,position_title,academic_title,email,institution,affiliation,orcid,photo_file_id").eq("submission_id", submissionId).order("position"),
    admin.from("publication_records").select("id,doi,metadata,journal:journals(title),issue:issues(volume,issue_number,publication_date),publication:publications(title,abstract,content_type,volume,issue_number,pages,doi,publication_date)").eq("submission_id", submissionId).maybeSingle(),
  ]);
  if (submissionResult.error || !submissionResult.data) throw new ManuscriptServiceError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  const submission = submissionResult.data as unknown as JsonRecord;
  const record = objectValue(recordResult.data);
  const publication = firstRelation(record.publication);
  const journal = firstRelation(record.journal);
  const issue = firstRelation(record.issue);
  const preferredJournal = firstRelation(submission.preferred_journal);
  const assignedIssue = firstRelation(submission.assigned_issue);
  const recordMetadata = objectValue(record.metadata);
  const authors = authorsResult.data?.length ? authorsResult.data as unknown as JsonRecord[] : authorDetailsFromSnapshot(submission);
  const fields: ManuscriptFieldValue[] = [];
  const add = (field: ManuscriptFieldValue) => fields.push(field);
  add({ key: "submission.title", label: "Submission title", group: "Submission", kind: "text", value: stringValue(publication.title || submission.title), sourcePath: publication.title ? "publications.title" : "submissions.title" });
  add({ key: "submission.reference", label: "Submission reference", group: "Submission", kind: "text", value: stringValue(submission.reference || submission.tracking_number), sourcePath: "submissions.reference" });
  add({ key: "submission.abstract", label: "Abstract", group: "Submission", kind: "text", value: stringValue(publication.abstract || submission.abstract), sourcePath: publication.abstract ? "publications.abstract" : "submissions.abstract" });
  add({ key: "submission.journal", label: "Journal", group: "Submission", kind: "text", value: stringValue(journal.title || preferredJournal.title || submission.journal_title_snapshot), sourcePath: journal.title ? "publication_records.journal" : "submissions.preferred_journal" });
  add({ key: "submission.category", label: "Category", group: "Submission", kind: "text", value: stringValue(publication.content_type || recordMetadata.category || submission.publication_type), sourcePath: publication.content_type ? "publications.content_type" : "submissions.publication_type" });
  add({ key: "publication.doi", label: "DOI", group: "Publication", kind: "text", value: stringValue(record.doi || publication.doi), sourcePath: "publication_records.doi" });
  add({ key: "publication.volume", label: "Volume", group: "Publication", kind: "text", value: stringValue(issue.volume || publication.volume || assignedIssue.volume || submission.volume_snapshot), sourcePath: issue.volume ? "issues.volume" : "submissions.volume_snapshot" });
  add({ key: "publication.issue", label: "Issue", group: "Publication", kind: "text", value: stringValue(issue.issue_number || publication.issue_number || assignedIssue.issue_number || submission.issue_snapshot), sourcePath: issue.issue_number ? "issues.issue_number" : "submissions.issue_snapshot" });
  add({ key: "publication.pages", label: "Pages", group: "Publication", kind: "text", value: stringValue(publication.pages || recordMetadata.pages), sourcePath: "publications.pages" });
  add({ key: "publication.date", label: "Publication date", group: "Publication", kind: "text", value: stringValue(publication.publication_date || issue.publication_date || assignedIssue.publication_date), sourcePath: publication.publication_date ? "publications.publication_date" : "issues.publication_date" });
  authors.forEach((author, index) => {
    const position = Number(author.position || index + 1);
    const base = `author.${position}`;
    const name = [author.first_name, author.middle_initial, author.surname].map(stringValue).filter(Boolean).join(" ");
    add({ key: `${base}.name`, label: `Author ${position} name`, group: "Authors", kind: "text", value: name || (position === 1 ? stringValue(submission.author_name) : ""), sourcePath: `submission_authors[position=${position}]`, authorPosition: position });
    add({ key: `${base}.academicTitle`, label: `Author ${position} academic title`, group: "Authors", kind: "text", value: stringValue(author.academic_title), sourcePath: `submission_authors[position=${position}].academic_title`, authorPosition: position });
    add({ key: `${base}.email`, label: `Author ${position} email`, group: "Authors", kind: "text", value: stringValue(author.email || (position === 1 ? submission.author_email : "")), sourcePath: `submission_authors[position=${position}].email`, authorPosition: position, private: true });
    add({ key: `${base}.occupation`, label: `Author ${position} occupation or role`, group: "Authors", kind: "text", value: stringValue(author.position_title), sourcePath: `submission_authors[position=${position}].position_title`, authorPosition: position });
    add({ key: `${base}.affiliation`, label: `Author ${position} affiliation`, group: "Authors", kind: "text", value: stringValue(author.affiliation || author.institution || (position === 1 ? submission.affiliation : "")), sourcePath: `submission_authors[position=${position}].affiliation`, authorPosition: position });
    add({ key: `${base}.photo`, label: `Author ${position} profile photo`, group: "Authors", kind: "image", value: author.photo_file_id ? `/api/admin/files/${stringValue(author.photo_file_id)}?stream=1` : "", sourcePath: `submission_authors[position=${position}].photo_file_id`, authorPosition: position, fileId: typeof author.photo_file_id === "string" ? author.photo_file_id : null });
  });
  return fields;
}

async function profileNames(admin: AdminClient, ids: Array<string | null | undefined>) {
  const valid = Array.from(new Set(ids.filter((id): id is string => Boolean(id && uuidValue(id)))));
  if (!valid.length) return new Map<string, string>();
  const { data } = await admin.from("profiles").select("id,display_name,email").in("id", valid);
  return new Map((data || []).map((profile) => [profile.id, profile.display_name || profile.email || "Staff member"]));
}

async function latestManuscriptFiles(admin: AdminClient, submissionIds: string[]) {
  if (!submissionIds.length) return { bySubmission: new Map<string, JsonRecord>(), byId: new Map<string, JsonRecord>() };
  const { data } = await admin.from("submission_files").select("id,submission_id,original_name,mime_type,sha256,created_at").in("submission_id", submissionIds).eq("file_kind", "manuscript").order("created_at", { ascending: false });
  const bySubmission = new Map<string, JsonRecord>();
  const byId = new Map<string, JsonRecord>();
  for (const row of data || []) {
    const record = row as unknown as JsonRecord;
    if (!bySubmission.has(row.submission_id)) bySubmission.set(row.submission_id, record);
    byId.set(row.id, record);
  }
  return { bySubmission, byId };
}

function importStatus(reportValue: unknown, file: JsonRecord | undefined): ManuscriptSubmissionSummary["importStatus"] {
  if (!file) return "unsupported";
  const mime = stringValue(file.mime_type).toLowerCase();
  const name = stringValue(file.original_name).toLowerCase();
  if (mime === "application/msword" || name.endsWith(".doc")) return "unsupported";
  const report = asImportReport(reportValue);
  if (!report) return "not_started";
  return report.warnings.some((warning) => warning.severity === "warning" || warning.severity === "error") ? "warning" : "ready";
}

export async function listEligibleManuscripts(): Promise<ManuscriptSubmissionSummary[]> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  const { data: submissions, error } = await admin.from("submissions").select("id,reference,tracking_number,title,author_name,current_stage,source_manuscript_file_id,journal_title_snapshot,preferred_journal:journals(title)").in("current_stage", [...eligibleStages]).order("updated_at", { ascending: false }).limit(300);
  if (error) throw new ManuscriptServiceError(error.message, 500, "ELIGIBLE_QUERY_FAILED");
  const submissionRows = (submissions || []) as unknown as JsonRecord[];
  const submissionIds = submissionRows.map((row) => stringValue(row.id));
  const [{ data: documents }, files] = await Promise.all([
    submissionIds.length ? admin.from("manuscript_documents").select("id,submission_id,status,updated_at,updated_by").in("submission_id", submissionIds) : Promise.resolve({ data: [] }),
    latestManuscriptFiles(admin, submissionIds),
  ]);
  const documentRows = (documents || []) as unknown as JsonRecord[];
  const documentIds = documentRows.map((row) => stringValue(row.id));
  const { data: drafts } = documentIds.length ? await admin.from("manuscript_drafts").select("document_id,updated_at,updated_by,import_report").in("document_id", documentIds) : { data: [] };
  const draftsByDocument = new Map(((drafts || []) as unknown as JsonRecord[]).map((draft) => [stringValue(draft.document_id), draft]));
  const docsBySubmission = new Map(documentRows.map((document) => [stringValue(document.submission_id), document]));
  const names = await profileNames(admin, [...documentRows.map((row) => stringValue(row.updated_by)), ...((drafts || []) as unknown as JsonRecord[]).map((row) => stringValue(row.updated_by))]);
  return submissionRows.map((submission) => {
    const id = stringValue(submission.id);
    const document = docsBySubmission.get(id);
    const draft = document ? draftsByDocument.get(stringValue(document.id)) : undefined;
    const pointer = typeof submission.source_manuscript_file_id === "string" ? submission.source_manuscript_file_id : null;
    const fallbackFile = files.bySubmission.get(id);
    const file = pointer ? files.byId.get(pointer) || fallbackFile : fallbackFile;
    const stage = stringValue(submission.current_stage);
    const journal = firstRelation(submission.preferred_journal);
    return {
      id,
      reference: stringValue(submission.reference || submission.tracking_number || id),
      title: stringValue(submission.title || "Untitled manuscript"),
      author: stringValue(submission.author_name || "Author pending"),
      journal: stringValue(journal.title || submission.journal_title_snapshot || "Journal pending"),
      stage,
      stageLabel: stageLabels[stage] || stage,
      sourceFileId: file ? stringValue(file.id) : pointer,
      sourceFileName: file ? stringValue(file.original_name) : null,
      sourceMimeType: file ? stringValue(file.mime_type) : null,
      documentId: document ? stringValue(document.id) : null,
      documentStatus: stage === "published" ? "read_only" : document ? document.status === "finalized" ? "finalized" : "draft" : "not_started",
      importStatus: importStatus(draft?.import_report, file),
      lastEditor: names.get(stringValue(draft?.updated_by || document?.updated_by)) || null,
      lastSavedAt: stringValue(draft?.updated_at || document?.updated_at) || null,
    };
  });
}

async function submissionForDocument(admin: AdminClient, documentId: string) {
  const { data: document, error } = await admin.from("manuscript_documents").select("*").eq("id", documentId).maybeSingle();
  if (error || !document) throw new ManuscriptServiceError("Manuscript document not found.", 404, "DOCUMENT_NOT_FOUND");
  const { data: submission } = await admin.from("submissions").select("id,reference,tracking_number,title,abstract,publication_type,author_name,current_stage,journal_title_snapshot,preferred_journal:journals(title)").eq("id", document.submission_id).maybeSingle();
  if (!submission) throw new ManuscriptServiceError("The linked submission no longer exists.", 404, "SUBMISSION_NOT_FOUND");
  return { document, submission: submission as unknown as JsonRecord };
}

async function acquireLease(admin: AdminClient, documentId: string, user: AdminUser, force = false) {
  const { document, submission } = await submissionForDocument(admin, documentId);
  const published = submission.current_stage === "published";
  if (published) return document;
  if (isLocalDevelopmentUser(user)) return document;
  const available = force || !document.lease_owner_id || document.lease_owner_id === user.id || isExpired(document.lease_expires_at);
  if (!available) return document;
  const query = admin.from("manuscript_documents").update({ lease_owner_id: uuidValue(user.id), lease_expires_at: leaseExpiry(), updated_by: uuidValue(user.id) }).eq("id", documentId).eq("updated_at", document.updated_at);
  const { data: updated } = await query.select("*").maybeSingle();
  if (updated) return updated;
  const { data: current } = await admin.from("manuscript_documents").select("*").eq("id", documentId).single();
  return current;
}

export async function createOrOpenManuscript(submissionId: string, user: AdminUser) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  const { data: submission } = await admin.from("submissions").select("id,current_stage,source_manuscript_file_id").eq("id", submissionId).maybeSingle();
  if (!submission) throw new ManuscriptServiceError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  if (!eligibleStages.includes(submission.current_stage as (typeof eligibleStages)[number])) throw new ManuscriptServiceError("The Manuscript Editor becomes available after editorial acceptance.", 409, "STAGE_NOT_ELIGIBLE");
  const { data: existing } = await admin.from("manuscript_documents").select("id").eq("submission_id", submissionId).maybeSingle();
  let documentId = existing?.id || null;
  if (!documentId) {
    let sourceFileId = submission.source_manuscript_file_id;
    if (!sourceFileId) {
      const { data: source } = await admin.from("submission_files").select("id").eq("submission_id", submissionId).eq("file_kind", "manuscript").order("created_at", { ascending: false }).limit(1).maybeSingle();
      sourceFileId = source?.id || null;
      if (sourceFileId) await admin.from("submissions").update({ source_manuscript_file_id: sourceFileId }).eq("id", submissionId);
    }
    if (!sourceFileId) throw new ManuscriptServiceError("No original manuscript is attached to this submission.", 409, "SOURCE_FILE_MISSING");
    const fields = await sourceFields(admin, submissionId);
    const editorState = buildInitialEditorState(fields);
    const contentText = manuscriptParagraphs(fields.filter((field) => ["submission.title", "submission.abstract"].includes(field.key) || field.key.endsWith(".name") || field.key.endsWith(".affiliation")).map((field) => field.value).join("\n")).join("\n");
    const contentHash = hashDraft(editorState, defaultManuscriptPageSettings, contentText);
    const { data: created, error: createError } = await admin.from("manuscript_documents").insert({ submission_id: submissionId, source_file_id: sourceFileId, created_by: uuidValue(user.id), updated_by: uuidValue(user.id) }).select("id").single();
    if (createError || !created) {
      const { data: raced } = await admin.from("manuscript_documents").select("id").eq("submission_id", submissionId).maybeSingle();
      if (!raced) throw new ManuscriptServiceError("The manuscript workspace could not be created.", 500, "CREATE_FAILED");
      documentId = raced.id;
    } else {
      documentId = created.id;
      const { error: draftError } = await admin.from("manuscript_drafts").insert({
        document_id: documentId,
        editor_state: asJson(editorState),
        page_settings: asJson(defaultManuscriptPageSettings),
        field_bindings: asJson(bindingsFor(fields)),
        field_snapshot: asJson(snapshotFor(fields)),
        content_text: contentText,
        content_hash: contentHash,
        updated_by: uuidValue(user.id),
      });
      if (draftError) {
        await admin.from("manuscript_documents").delete().eq("id", documentId);
        throw new ManuscriptServiceError("The manuscript draft could not be initialized.", 500, "DRAFT_CREATE_FAILED");
      }
      await admin.from("audit_events").insert({ actor_id: uuidValue(user.id), action: "manuscript_editor.created", entity_type: "manuscript_document", entity_id: documentId, details: { submissionId, sourceFileId } });
    }
  }
  await acquireLease(admin, documentId, user);
  return getManuscriptDetail(documentId, user);
}

export async function getManuscriptDetail(documentId: string, user: AdminUser): Promise<ManuscriptDetail> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  const { document, submission } = await submissionForDocument(admin, documentId);
  const [{ data: draft }, { data: file }, { data: versions }, fields] = await Promise.all([
    admin.from("manuscript_drafts").select("*").eq("document_id", documentId).maybeSingle(),
    admin.from("submission_files").select("id,original_name,mime_type,sha256").eq("id", document.source_file_id).maybeSingle(),
    admin.from("manuscript_versions").select("id,version_number,version_kind,revision,parent_version_id,change_summary,docx_file_id,pdf_file_id,created_by,created_at").eq("document_id", documentId).order("version_number", { ascending: false }),
    sourceFields(admin, document.submission_id),
  ]);
  if (!draft || !file) throw new ManuscriptServiceError("The manuscript draft or source file is missing.", 500, "DOCUMENT_INCOMPLETE");
  const versionRows = (versions || []) as unknown as JsonRecord[];
  const names = await profileNames(admin, [document.lease_owner_id, draft.updated_by, ...versionRows.map((version) => stringValue(version.created_by))]);
  const stage = stringValue(submission.current_stage);
  const journal = firstRelation(submission.preferred_journal);
  const editable = stage !== "published" && (isLocalDevelopmentUser(user) || (document.lease_owner_id === user.id && !isExpired(document.lease_expires_at)));
  const draftModel: ManuscriptDraft = {
    editorState: asEditorState(draft.editor_state),
    pageSettings: asPageSettings(draft.page_settings),
    fieldBindings: asBindings(draft.field_bindings),
    fieldSnapshot: asFieldSnapshot(draft.field_snapshot),
    importReport: asImportReport(draft.import_report),
    sourceSnapshot: objectValue(draft.source_snapshot) as ManuscriptDraft["sourceSnapshot"],
    manualConfirmations: asConfirmations(draft.manual_confirmations),
    contentText: draft.content_text,
    contentHash: draft.content_hash,
    revision: draft.revision,
    updatedAt: draft.updated_at,
    updatedByName: names.get(stringValue(draft.updated_by)) || null,
  };
  const documentModel: ManuscriptDocument = {
    id: document.id,
    submissionId: document.submission_id,
    sourceFileId: document.source_file_id,
    sourceFileName: file.original_name,
    sourceMimeType: file.mime_type,
    sourceSha256: document.source_sha256 || file.sha256,
    status: document.status as "draft" | "finalized",
    schemaVersion: document.schema_version,
    currentRevision: document.current_revision,
    currentVersionId: document.current_version_id,
    importedAt: document.imported_at,
    finalizedAt: document.finalized_at,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
  };
  const versionModels: ManuscriptVersion[] = versionRows.map((version) => ({
    id: stringValue(version.id),
    versionNumber: Number(version.version_number),
    kind: stringValue(version.version_kind) as ManuscriptVersion["kind"],
    revision: Number(version.revision),
    parentVersionId: typeof version.parent_version_id === "string" ? version.parent_version_id : null,
    changeSummary: stringValue(version.change_summary),
    docxFileId: typeof version.docx_file_id === "string" ? version.docx_file_id : null,
    pdfFileId: typeof version.pdf_file_id === "string" ? version.pdf_file_id : null,
    createdBy: typeof version.created_by === "string" ? version.created_by : null,
    createdByName: names.get(stringValue(version.created_by)) || null,
    createdAt: stringValue(version.created_at),
  }));
  return {
    document: documentModel,
    submission: {
      id: stringValue(submission.id),
      reference: stringValue(submission.reference || submission.tracking_number || submission.id),
      title: stringValue(submission.title),
      author: stringValue(submission.author_name),
      journal: stringValue(journal.title || submission.journal_title_snapshot),
      stage,
      stageLabel: stageLabels[stage] || stage,
      sourceFileId: file.id,
      sourceFileName: file.original_name,
      sourceMimeType: file.mime_type,
      documentId,
      documentStatus: stage === "published" ? "read_only" : document.status === "finalized" ? "finalized" : "draft",
      importStatus: importStatus(draft.import_report, file as unknown as JsonRecord),
      lastEditor: names.get(stringValue(draft.updated_by)) || null,
      lastSavedAt: draft.updated_at,
      abstract: stringValue(submission.abstract),
      category: stringValue(submission.publication_type),
    },
    draft: draftModel,
    fields,
    versions: versionModels,
    lease: {
      editable,
      ownerId: document.lease_owner_id,
      ownerName: names.get(stringValue(document.lease_owner_id)) || null,
      expiresAt: document.lease_expires_at,
      canForceTakeover: user.role === "admin" && stage !== "published" && !editable,
    },
    permissions: { canEdit: stage !== "published" && user.role !== "viewer", canFinalize: stage !== "published" && user.role !== "viewer", published: stage === "published" },
  };
}

async function assertLease(admin: AdminClient, documentId: string, user: AdminUser) {
  const { document, submission } = await submissionForDocument(admin, documentId);
  if (submission.current_stage === "published") throw new ManuscriptServiceError("Published manuscripts are read-only.", 409, "PUBLISHED_READ_ONLY");
  if (!isLocalDevelopmentUser(user) && (document.lease_owner_id !== user.id || isExpired(document.lease_expires_at))) throw new ManuscriptServiceError("Your editing lease expired or belongs to another staff member. Reopen the manuscript before saving.", 409, "LEASE_REQUIRED");
  return { document, submission };
}

export async function saveManuscriptDraft(documentId: string, user: AdminUser, input: {
  baseRevision: number;
  editorState: ManuscriptEditorState;
  contentText: string;
  pageSettings?: ManuscriptPageSettings;
  fieldBindings?: LinkedFieldBinding[];
  fieldSnapshot?: Record<string, ManuscriptFieldValue>;
  importReport?: ManuscriptImportReport | null;
  sourceSnapshot?: ManuscriptDraft["sourceSnapshot"];
  manualConfirmations?: ManuscriptManualConfirmations;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  const { document } = await assertLease(admin, documentId, user);
  const { data: current } = await admin.from("manuscript_drafts").select("*").eq("document_id", documentId).maybeSingle();
  if (!current) throw new ManuscriptServiceError("The manuscript draft is missing.", 404, "DRAFT_NOT_FOUND");
  if (current.revision !== input.baseRevision || document.current_revision !== input.baseRevision) throw new ManuscriptServiceError("A newer draft is already saved. Reload before applying your changes.", 409, "EDIT_CONFLICT");
  const editorState = asEditorState(input.editorState);
  const pageSettings = input.pageSettings ? asPageSettings(input.pageSettings) : asPageSettings(current.page_settings);
  const contentText = stringValue(input.contentText);
  validateDraft(editorState, contentText);
  const nextRevision = input.baseRevision + 1;
  const updatedAt = nowIso();
  const contentHash = hashDraft(editorState, pageSettings, contentText);
  const payload = {
    editor_state: asJson(editorState),
    page_settings: asJson(pageSettings),
    field_bindings: asJson(input.fieldBindings || asBindings(current.field_bindings)),
    field_snapshot: asJson(input.fieldSnapshot || asFieldSnapshot(current.field_snapshot)),
    import_report: asJson(input.importReport === undefined ? objectValue(current.import_report) : input.importReport || {}),
    source_snapshot: asJson(input.sourceSnapshot || objectValue(current.source_snapshot)),
    manual_confirmations: asJson(input.manualConfirmations || asConfirmations(current.manual_confirmations)),
    content_text: contentText,
    content_hash: contentHash,
    revision: nextRevision,
    updated_by: uuidValue(user.id),
    updated_at: updatedAt,
  };
  const { data: saved, error } = await admin.from("manuscript_drafts").update(payload).eq("document_id", documentId).eq("revision", input.baseRevision).select("revision,updated_at,content_hash").maybeSingle();
  if (error) throw new ManuscriptServiceError("The manuscript draft could not be saved.", 500, "SAVE_FAILED");
  if (!saved) throw new ManuscriptServiceError("A newer draft is already saved. Reload before applying your changes.", 409, "EDIT_CONFLICT");
  await admin.from("manuscript_documents").update({ current_revision: nextRevision, status: "draft", finalized_at: null, updated_by: uuidValue(user.id), lease_expires_at: leaseExpiry() }).eq("id", documentId).eq("current_revision", input.baseRevision);
  return { revision: saved.revision, updatedAt: saved.updated_at, contentHash: saved.content_hash };
}

async function createVersion(admin: AdminClient, documentId: string, user: AdminUser, kind: ManuscriptVersion["kind"], changeSummary: string, fileIds?: { docx?: string; pdf?: string }) {
  const { data: document } = await admin.from("manuscript_documents").select("submission_id,current_version_id").eq("id", documentId).single();
  const { data: draft } = await admin.from("manuscript_drafts").select("*").eq("document_id", documentId).single();
  if (!document || !draft) throw new ManuscriptServiceError("The manuscript draft is incomplete and cannot be versioned.", 404, "DRAFT_NOT_FOUND");
  const { data: latest } = await admin.from("manuscript_versions").select("version_number").eq("document_id", documentId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const { data: version, error } = await admin.from("manuscript_versions").insert({
    document_id: documentId,
    submission_id: document.submission_id,
    version_number: (latest?.version_number || 0) + 1,
    version_kind: kind,
    parent_version_id: document.current_version_id,
    revision: draft.revision,
    editor_state: draft.editor_state,
    page_settings: draft.page_settings,
    field_bindings: draft.field_bindings,
    field_snapshot: draft.field_snapshot,
    import_report: draft.import_report,
    source_snapshot: draft.source_snapshot,
    manual_confirmations: draft.manual_confirmations,
    content_text: draft.content_text,
    content_hash: draft.content_hash,
    change_summary: changeSummary.slice(0, 500),
    docx_file_id: fileIds?.docx || null,
    pdf_file_id: fileIds?.pdf || null,
    created_by: uuidValue(user.id),
  }).select("id,version_number").single();
  if (error || !version) throw new ManuscriptServiceError("The manuscript version could not be recorded.", 500, "VERSION_FAILED");
  await admin.from("manuscript_documents").update({ current_version_id: version.id, updated_by: uuidValue(user.id) }).eq("id", documentId);
  return version;
}

async function downloadSource(admin: AdminClient, documentId: string) {
  const { data: document } = await admin.from("manuscript_documents").select("submission_id,source_file_id").eq("id", documentId).single();
  if (!document) throw new ManuscriptServiceError("Manuscript document not found.", 404, "DOCUMENT_NOT_FOUND");
  const { data: file } = await admin.from("submission_files").select("id,submission_id,storage_bucket,storage_path,original_name,mime_type,sha256").eq("id", document.source_file_id).eq("submission_id", document.submission_id).maybeSingle();
  if (!file) throw new ManuscriptServiceError("The immutable source manuscript is missing.", 404, "SOURCE_FILE_MISSING");
  const { data: blob, error } = await admin.storage.from(file.storage_bucket).download(file.storage_path);
  if (error || !blob) throw new ManuscriptServiceError("The source manuscript could not be read from private storage.", 500, "SOURCE_DOWNLOAD_FAILED");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { document, file, bytes };
}

export async function importManuscriptDraft(documentId: string, user: AdminUser, baseRevision: number, payload: ManuscriptImportPayload) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  await assertLease(admin, documentId, user);
  const source = await downloadSource(admin, documentId);
  const verified = await extractManuscriptSource(source.bytes, source.file.mime_type, source.file.original_name);
  const coverage = calculateTextCoverage(verified.text, payload.contentText);
  const report: ManuscriptImportReport = {
    ...payload.report,
    format: verified.format,
    sourceFileName: source.file.original_name,
    sourceBytes: source.bytes.byteLength,
    sourcePages: payload.report.sourcePages || verified.pages,
    sourceParagraphs: verified.paragraphs.length,
    sourceWords: verified.words,
    editorParagraphs: manuscriptParagraphs(payload.contentText).length,
    editorWords: manuscriptWordCount(payload.contentText),
    normalizedTextCoverage: coverage,
    warnings: [
      ...payload.report.warnings,
      ...(coverage < 0.98 ? [{ code: "TEXT_COVERAGE", message: `Automatic text coverage is ${Math.round(coverage * 1000) / 10}%. Review the highlighted differences against the original.`, severity: "warning" as const }] : []),
    ],
  };
  const sourceSnapshot = { text: verified.text, paragraphs: payload.sourceSnapshot.paragraphs };
  const saved = await saveManuscriptDraft(documentId, user, { baseRevision, editorState: payload.editorState, contentText: payload.contentText, importReport: report, sourceSnapshot });
  const sha256 = createHash("sha256").update(source.bytes).digest("hex");
  await Promise.all([
    admin.from("submission_files").update({ sha256, validation_status: "valid", validated_at: nowIso(), validation_metadata: { source: "manuscript_editor", format: verified.format, textCoverage: coverage } }).eq("id", source.file.id),
    admin.from("manuscript_documents").update({ source_sha256: sha256, imported_at: nowIso(), updated_by: uuidValue(user.id) }).eq("id", documentId),
  ]);
  const version = await createVersion(admin, documentId, user, "import", `Imported ${source.file.original_name}`);
  await admin.from("audit_events").insert({ actor_id: uuidValue(user.id), action: "manuscript_editor.imported", entity_type: "manuscript_document", entity_id: documentId, details: { sourceFileId: source.file.id, sourceSha256: sha256, coverage, versionId: version.id } });
  return { ...saved, report, versionId: version.id };
}

export async function checkpointManuscript(documentId: string, user: AdminUser, changeSummary: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  await assertLease(admin, documentId, user);
  const version = await createVersion(admin, documentId, user, "checkpoint", changeSummary || "Manual checkpoint");
  return { version, detail: await getManuscriptDetail(documentId, user) };
}

export async function restoreManuscriptVersion(documentId: string, versionId: string, user: AdminUser) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  const { document } = await assertLease(admin, documentId, user);
  const { data: version } = await admin.from("manuscript_versions").select("*").eq("id", versionId).eq("document_id", documentId).maybeSingle();
  if (!version) throw new ManuscriptServiceError("The selected manuscript version was not found.", 404, "VERSION_NOT_FOUND");
  const nextRevision = document.current_revision + 1;
  await admin.from("manuscript_drafts").update({
    editor_state: version.editor_state,
    page_settings: version.page_settings,
    field_bindings: version.field_bindings,
    field_snapshot: version.field_snapshot,
    import_report: version.import_report,
    source_snapshot: version.source_snapshot,
    manual_confirmations: version.manual_confirmations,
    content_text: version.content_text,
    content_hash: version.content_hash,
    revision: nextRevision,
    updated_by: uuidValue(user.id),
    updated_at: nowIso(),
  }).eq("document_id", documentId).eq("revision", document.current_revision);
  await admin.from("manuscript_documents").update({ current_revision: nextRevision, status: "draft", finalized_at: null, updated_by: uuidValue(user.id), lease_expires_at: leaseExpiry() }).eq("id", documentId).eq("current_revision", document.current_revision);
  const restored = await createVersion(admin, documentId, user, "restore", `Restored version ${version.version_number}`);
  return { version: restored, detail: await getManuscriptDetail(documentId, user) };
}

function changedFields(previous: Record<string, ManuscriptFieldValue>, current: ManuscriptFieldValue[]) {
  return current.filter((field) => {
    const old = previous[field.key];
    return !old || old.value !== field.value || (old.fileId || null) !== (field.fileId || null);
  }).map((field) => ({ key: field.key, label: field.label, kind: field.kind, previous: previous[field.key]?.value || "", current: field.value, previousFileId: previous[field.key]?.fileId || null, currentFileId: field.fileId || null }));
}

function applyFieldsToState(editorState: ManuscriptEditorState, fields: Map<string, ManuscriptFieldValue>, selected: Set<string>) {
  const clone = structuredClone(editorState) as unknown as JsonRecord;
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const node = value as JsonRecord;
    const key = stringValue(node.fieldKey);
    if ((node.type === "linked-field" || node.type === "linked-image") && selected.has(key)) {
      const field = fields.get(key);
      const sourceValue = stringValue(node.sourceValue);
      const overridden = node.overridden === true || (node.type === "linked-field" && sourceValue && stringValue(node.text) !== sourceValue);
      if (field && !overridden && node.frozen !== true) {
        node.sourceValue = field.value;
        node.sourcePath = field.sourcePath;
        if (node.type === "linked-field") node.text = field.value;
        else {
          node.src = field.value;
          node.fileId = field.fileId || null;
        }
      }
    }
    Object.values(node).forEach((child) => {
      if (Array.isArray(child)) child.forEach(visit);
    });
  };
  visit(clone);
  return asEditorState(clone);
}

function freezeLinkedFields(editorState: ManuscriptEditorState) {
  const clone = structuredClone(editorState) as unknown as JsonRecord;
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const node = value as JsonRecord;
    if (node.type === "linked-field" || node.type === "linked-image") node.frozen = true;
    Object.values(node).forEach((child) => {
      if (Array.isArray(child)) child.forEach(visit);
    });
  };
  visit(clone);
  return asEditorState(clone);
}

export async function syncManuscriptFields(documentId: string, user: AdminUser, input: { action: "preview" | "apply"; baseRevision?: number; selectedKeys?: string[] }) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  const { document } = await submissionForDocument(admin, documentId);
  const { data: draft } = await admin.from("manuscript_drafts").select("*").eq("document_id", documentId).single();
  const fields = await sourceFields(admin, document.submission_id);
  const changes = changedFields(asFieldSnapshot(draft.field_snapshot), fields);
  if (input.action === "preview") return { changes, fields };
  await assertLease(admin, documentId, user);
  if (input.baseRevision !== draft.revision) throw new ManuscriptServiceError("A newer draft is already saved. Reload before synchronizing linked fields.", 409, "EDIT_CONFLICT");
  const selected = new Set(input.selectedKeys?.length ? input.selectedKeys : changes.map((change) => change.key));
  const fieldMap = new Map(fields.map((field) => [field.key, field]));
  const editorState = applyFieldsToState(asEditorState(draft.editor_state), fieldMap, selected);
  const bindings = asBindings(draft.field_bindings).map((binding) => {
    const field = fieldMap.get(binding.key);
    if (!field || !selected.has(binding.key) || binding.overridden || binding.frozen) return binding;
    return { ...binding, ...field, lastAppliedValue: field.value };
  });
  const contentText = manuscriptPlainTextFromState(editorState);
  const saved = await saveManuscriptDraft(documentId, user, { baseRevision: draft.revision, editorState, contentText, pageSettings: asPageSettings(draft.page_settings), fieldBindings: bindings, fieldSnapshot: snapshotFor(fields) });
  return { changes, fields, editorState, bindings, ...saved };
}

type ImageAssetMap = NonNullable<ManuscriptExportInput["imageAssets"]>;

function collectImageReferences(editorState: ManuscriptEditorState) {
  const embedded = new Map<string, { data: Uint8Array; mimeType: string }>();
  const fileIds = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const node = value as JsonRecord;
    if (node.type === "image" || node.type === "linked-image") {
      const source = stringValue(node.src);
      const fileId = stringValue(node.fileId);
      const match = source.match(/^data:(image\/(?:png|jpeg|jpg|gif|bmp));base64,([a-z0-9+/=]+)$/i);
      if (match) embedded.set(source, { mimeType: match[1].replace("jpg", "jpeg"), data: new Uint8Array(Buffer.from(match[2], "base64")) });
      if (uuidValue(fileId)) fileIds.add(fileId);
    }
    Object.values(node).forEach((child) => {
      if (Array.isArray(child)) child.forEach(visit);
    });
  };
  visit(editorState);
  return { embedded, fileIds };
}

async function exportImageAssets(admin: AdminClient, submissionId: string, editorState: ManuscriptEditorState): Promise<ImageAssetMap> {
  const references = collectImageReferences(editorState);
  const assets: ImageAssetMap = {};
  for (const [key, asset] of references.embedded) {
    const metadata = await sharp(asset.data).metadata().catch(() => null);
    assets[key] = { ...asset, width: metadata?.width, height: metadata?.height };
  }
  if (references.fileIds.size) {
    const { data: files } = await admin.from("submission_files").select("id,submission_id,storage_bucket,storage_path,mime_type").in("id", Array.from(references.fileIds)).eq("submission_id", submissionId);
    for (const file of files || []) {
      const { data: blob } = await admin.storage.from(file.storage_bucket).download(file.storage_path);
      if (!blob || !file.mime_type.startsWith("image/")) continue;
      const data = new Uint8Array(await blob.arrayBuffer());
      const metadata = await sharp(data).metadata().catch(() => null);
      assets[file.id] = { data, mimeType: file.mime_type, width: metadata?.width, height: metadata?.height };
    }
  }
  return assets;
}

async function exportInput(admin: AdminClient, documentId: string) {
  const { data: document } = await admin.from("manuscript_documents").select("submission_id").eq("id", documentId).single();
  if (!document) throw new ManuscriptServiceError("Manuscript document not found.", 404, "DOCUMENT_NOT_FOUND");
  const [{ data: draft }, { data: submission }] = await Promise.all([
    admin.from("manuscript_drafts").select("*").eq("document_id", documentId).single(),
    admin.from("submissions").select("title,reference,tracking_number").eq("id", document.submission_id).single(),
  ]);
  if (!draft || !submission) throw new ManuscriptServiceError("The manuscript draft or linked submission is missing.", 404, "DRAFT_NOT_FOUND");
  const editorState = asEditorState(draft.editor_state);
  const imageAssets = await exportImageAssets(admin, document.submission_id, editorState);
  return {
    submissionId: document.submission_id,
    draft,
    input: {
      title: submission.title,
      reference: submission.reference || submission.tracking_number,
      editorState,
      pageSettings: asPageSettings(draft.page_settings),
      imageAssets,
    } satisfies ManuscriptExportInput,
  };
}

export async function previewManuscript(documentId: string, format: "docx" | "pdf") {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  const output = await exportInput(admin, documentId);
  return format === "docx" ? renderManuscriptDocx(output.input) : renderManuscriptPdf(output.input);
}

function safeBaseName(title: string) {
  return title.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).toLowerCase() || "manuscript";
}

async function storeGeneratedFile(admin: AdminClient, user: AdminUser, submissionId: string, fileKind: "production_manuscript" | "final_pdf", name: string, mimeType: string, bytes: Uint8Array) {
  const { data: previous } = await admin.from("submission_files").select("id,version_number").eq("submission_id", submissionId).eq("file_kind", fileKind).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const path = `${submissionId}/${fileKind}/${randomUUID()}-${name}`;
  const { error: storageError } = await admin.storage.from("submission-files").upload(path, bytes, { contentType: mimeType, upsert: false });
  if (storageError) throw new ManuscriptServiceError(`The generated ${fileKind === "final_pdf" ? "PDF" : "DOCX"} could not be stored.`, 500, "STORAGE_FAILED");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: file, error } = await admin.from("submission_files").insert({
    submission_id: submissionId,
    file_kind: fileKind,
    storage_bucket: "submission-files",
    storage_path: path,
    original_name: name,
    mime_type: mimeType,
    size_bytes: bytes.byteLength,
    sha256,
    version_number: (previous?.version_number || 0) + 1,
    supersedes_file_id: previous?.id || null,
    validation_status: "valid",
    validated_at: nowIso(),
    validation_metadata: { source: "manuscript_editor", generated: true },
    created_by: uuidValue(user.id),
  }).select("id,storage_bucket,storage_path").single();
  if (error || !file) {
    await admin.storage.from("submission-files").remove([path]);
    throw new ManuscriptServiceError("The generated file could not be attached to the submission.", 500, "ATTACH_FAILED");
  }
  return file;
}

export async function finalizeManuscript(documentId: string, user: AdminUser, confirmations: ManuscriptManualConfirmations, changeSummary: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  const { document } = await assertLease(admin, documentId, user);
  const missing = manuscriptVerificationKeys.filter((key) => confirmations[key] !== true);
  if (missing.length) throw new ManuscriptServiceError("Confirm every manual comparison item before finalizing.", 409, "MANUAL_REVIEW_REQUIRED");
  const { data: publicationRecord } = await admin.from("publication_records").select("id,submitted_preflight_run_id").eq("submission_id", document.submission_id).maybeSingle();
  if (!publicationRecord) throw new ManuscriptServiceError("Open and save the production record before attaching final manuscript files.", 409, "PUBLICATION_RECORD_REQUIRED");
  const output = await exportInput(admin, documentId);
  const [docxBuffer, pdfBuffer] = await Promise.all([renderManuscriptDocx(output.input), renderManuscriptPdf(output.input)]);
  const base = safeBaseName(output.input.title);
  const stamp = new Date().toISOString().slice(0, 10);
  const docxFile = await storeGeneratedFile(admin, user, document.submission_id, "production_manuscript", `${base}-${stamp}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Uint8Array(docxBuffer));
  let pdfFile: Awaited<ReturnType<typeof storeGeneratedFile>> | null = null;
  try {
    pdfFile = await storeGeneratedFile(admin, user, document.submission_id, "final_pdf", `${base}-${stamp}.pdf`, "application/pdf", new Uint8Array(pdfBuffer));
    const frozenState = freezeLinkedFields(asEditorState(output.draft.editor_state));
    const frozenBindings = asBindings(output.draft.field_bindings).map((binding) => ({ ...binding, frozen: true }));
    await saveManuscriptDraft(documentId, user, {
      baseRevision: output.draft.revision,
      editorState: frozenState,
      contentText: manuscriptPlainTextFromState(frozenState),
      pageSettings: asPageSettings(output.draft.page_settings),
      fieldBindings: frozenBindings,
      fieldSnapshot: asFieldSnapshot(output.draft.field_snapshot),
      importReport: asImportReport(output.draft.import_report),
      sourceSnapshot: objectValue(output.draft.source_snapshot) as ManuscriptDraft["sourceSnapshot"],
      manualConfirmations: confirmations,
    });
    const version = await createVersion(admin, documentId, user, "final", changeSummary || "Final DOCX and PDF attached", { docx: docxFile.id, pdf: pdfFile.id });
    const finalizedAt = nowIso();
    await admin.from("manuscript_documents").update({ status: "finalized", finalized_at: finalizedAt, lease_owner_id: null, lease_expires_at: null, current_version_id: version.id, updated_by: uuidValue(user.id) }).eq("id", documentId);
    await admin.from("publication_records").update({ final_pdf_file_id: pdfFile.id }).eq("id", publicationRecord.id);
    if (publicationRecord.submitted_preflight_run_id) {
      await admin.from("publication_preflight_runs").update({ status: "stale", invalidated_at: finalizedAt, updated_at: finalizedAt }).eq("id", publicationRecord.submitted_preflight_run_id);
      await admin.from("workflow_checklist_items").update({ completed_at: null, completed_by: null }).eq("submission_id", document.submission_id).in("stage", ["production_records", "production_ready_to_publish"]);
    }
    await admin.from("workflow_events").insert({ submission_id: document.submission_id, event_type: "manuscript_finalized", internal_title: "Manuscript finalized and attached", internal_description: "The Manuscript Editor generated and attached a versioned production DOCX and searchable PDF.", visibility: "internal", actor_type: user.role, actor_id: uuidValue(user.id), metadata: { document_id: documentId, version_id: version.id, docx_file_id: docxFile.id, pdf_file_id: pdfFile.id } });
    await admin.from("audit_events").insert({ actor_id: uuidValue(user.id), action: "manuscript_editor.finalized", entity_type: "manuscript_document", entity_id: documentId, details: { versionId: version.id, docxFileId: docxFile.id, pdfFileId: pdfFile.id } });
    return { versionId: version.id, docxFileId: docxFile.id, pdfFileId: pdfFile.id, docxUrl: `/api/admin/files/${docxFile.id}?stream=1&download=1`, pdfUrl: `/api/admin/files/${pdfFile.id}?stream=1&download=1` };
  } catch (error) {
    const cleanup = [docxFile, pdfFile].filter((file): file is NonNullable<typeof file> => Boolean(file));
    if (cleanup.length) {
      await admin.storage.from("submission-files").remove(cleanup.map((file) => file.storage_path));
      await admin.from("submission_files").delete().in("id", cleanup.map((file) => file.id));
    }
    throw error;
  }
}

export async function updateManuscriptLease(documentId: string, user: AdminUser, action: "acquire" | "heartbeat" | "release" | "takeover") {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ManuscriptServiceError("The manuscript database is unavailable.", 503, "DATABASE_UNAVAILABLE");
  if (isLocalDevelopmentUser(user)) return getManuscriptDetail(documentId, user);
  if (action === "takeover") {
    if (user.role !== "admin") throw new ManuscriptServiceError("Only an administrator can force an editing takeover.", 403, "ADMIN_REQUIRED");
    const { data: draft } = await admin.from("manuscript_drafts").select("revision").eq("document_id", documentId).maybeSingle();
    if (draft) await createVersion(admin, documentId, user, "checkpoint", "Safety checkpoint before administrator lease takeover");
    await acquireLease(admin, documentId, user, true);
  } else if (action === "acquire") {
    await acquireLease(admin, documentId, user);
  } else if (action === "heartbeat") {
    const { data } = await admin.from("manuscript_documents").update({ lease_expires_at: leaseExpiry(), updated_by: uuidValue(user.id) }).eq("id", documentId).eq("lease_owner_id", user.id).select("id").maybeSingle();
    if (!data) throw new ManuscriptServiceError("Your editing lease is no longer active.", 409, "LEASE_EXPIRED");
  } else {
    await admin.from("manuscript_documents").update({ lease_owner_id: null, lease_expires_at: null }).eq("id", documentId).eq("lease_owner_id", user.id);
  }
  return getManuscriptDetail(documentId, user);
}
