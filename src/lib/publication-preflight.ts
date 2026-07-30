import "server-only";

import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isValidDoi,
  isValidOrcid,
  normalizeDoi,
  pageRangeIssue,
  rangesOverlap,
  stableJson,
  validatePeerReviewScores,
  type PeerReviewScoreRow,
  type PreflightBlocker,
  type PreflightCheckMode,
  type PreflightCheckStatus,
  type PreflightStatus,
} from "@/lib/publication-preflight-rules";

const RULESET_VERSION = "2026.07.1";

type Actor = { id: string; role: "admin" | "editor" | "viewer" };
type JsonRecord = Record<string, unknown>;

type Artifact = {
  id: string;
  fileKind: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  versionNumber: number;
  sha256: string | null;
  selected: boolean;
  pageHint?: number;
};

type CheckSeed = {
  key: string;
  group: string;
  title: string;
  mode: PreflightCheckMode;
  blocking?: boolean;
  status: PreflightCheckStatus;
  expected?: string;
  observed?: string;
  evidence?: JsonRecord;
  blocker?: PreflightBlocker;
};

const manualChecks: Array<Omit<CheckSeed, "status"> & { artifactKind: string; page?: number }> = [
  { key: "manuscript.same_work", group: "Manuscript", title: "Original and final represent the same accepted work", mode: "manual", artifactKind: "final_pdf" },
  { key: "manuscript.title", group: "Manuscript", title: "Final title matches the approved title", mode: "manual", artifactKind: "final_pdf", page: 1 },
  { key: "manuscript.authors", group: "Manuscript", title: "Author names and order are correct", mode: "manual", artifactKind: "final_pdf", page: 1 },
  { key: "manuscript.affiliations", group: "Manuscript", title: "Affiliations and institutions are correct", mode: "manual", artifactKind: "final_pdf", page: 1 },
  { key: "manuscript.doi", group: "Manuscript", title: "DOI printed in the manuscript matches the publication DOI", mode: "manual", artifactKind: "final_pdf", page: 1 },
  { key: "manuscript.complete", group: "Manuscript", title: "Content is complete with no missing or duplicated pages", mode: "manual", artifactKind: "final_pdf" },
  { key: "peer.title", group: "Peer review", title: "Review title matches the manuscript title", mode: "manual", artifactKind: "peer_review", page: 1 },
  { key: "peer.scores", group: "Peer review", title: "Review date and score arithmetic are valid", mode: "calculated", artifactKind: "peer_review", page: 1 },
  { key: "peer.legibility", group: "Peer review", title: "Reviewer comments and recommendation are legible", mode: "manual", artifactKind: "peer_review" },
  { key: "certificate.layout", group: "Certificate", title: "Paragraphs, spacing, line breaks, and alignment are clean", mode: "manual", artifactKind: "publication_certificate", page: 1 },
  { key: "certificate.safe_margin", group: "Certificate", title: "Nothing overlaps, clips, or leaves the safe margin", mode: "manual", artifactKind: "publication_certificate", page: 1 },
  { key: "social.visual", group: "Social media", title: "Photo crop, legibility, and visual balance are acceptable", mode: "manual", artifactKind: "social_media_artwork", page: 1 },
  { key: "preview.inspected", group: "Public preview", title: "Editor visually inspected the final article page", mode: "manual", artifactKind: "public_preview" },
];

function blocker(seed: Omit<PreflightBlocker, "group"> & { group: string }) {
  return seed;
}

function automatic(key: string, group: string, title: string, passed: boolean, message: string, fixAction: PreflightBlocker["fixAction"], evidence: JsonRecord = {}): CheckSeed {
  return {
    key,
    group,
    title,
    mode: "automatic",
    blocking: false,
    status: passed ? "pass" : "fail",
    evidence,
    blocker: passed ? undefined : blocker({ code: key, group, message, fixAction }),
  };
}

function currentFile(files: JsonRecord[], kind: string, selectedId?: string | null) {
  if (selectedId) return files.find((file) => file.id === selectedId && file.file_kind === kind) || null;
  return files
    .filter((file) => file.file_kind === kind)
    .sort((left, right) => Number(right.version_number || 1) - Number(left.version_number || 1))[0] || null;
}

async function validateStoredFile(db: ReturnType<typeof getSupabaseAdmin>, file: JsonRecord, kind: string) {
  if (!db) return { valid: false, message: "The file service is unavailable.", metadata: {} as JsonRecord };
  const cached = file.validation_status === "valid" && file.sha256 && file.validation_metadata;
  if (cached) return { valid: true, message: "", metadata: file.validation_metadata as JsonRecord };
  const bucket = String(file.storage_bucket || "submission-files");
  const path = String(file.storage_path || "");
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) return { valid: false, message: "The stored file could not be opened.", metadata: {} as JsonRecord };
  const bytes = Buffer.from(await data.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const metadata: JsonRecord = { byteLength: bytes.length };
  let valid = bytes.length > 0;
  let message = valid ? "" : "The file is empty.";
  try {
    if (kind === "final_pdf" || kind === "publication_certificate") {
      const signature = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
      if (!signature) throw new Error("The file does not have a valid PDF signature.");
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
      metadata.pageCount = pdf.getPageCount();
      metadata.signature = true;
      valid = pdf.getPageCount() > 0 && (kind !== "publication_certificate" || pdf.getPageCount() >= 5);
      if (!valid) message = kind === "publication_certificate" ? "The certificate PDF must contain pages 1–5." : "The final PDF has no renderable pages.";
    } else if (kind === "social_media_artwork") {
      const image = await sharp(bytes).metadata();
      metadata.width = image.width || 0;
      metadata.height = image.height || 0;
      metadata.format = image.format || "";
      valid = Boolean(image.width && image.height && ["jpeg", "png"].includes(image.format || ""));
      if (!valid) message = "The social artwork is not a valid JPG or PNG.";
    }
  } catch (error) {
    valid = false;
    message = error instanceof Error ? error.message : "The file is corrupt or encrypted.";
  }
  await db.from("submission_files").update({
    sha256,
    validation_status: valid ? "valid" : "invalid",
    validated_at: new Date().toISOString(),
    validation_metadata: { ...metadata, message: message || null },
  }).eq("id", String(file.id));
  file.sha256 = sha256;
  file.validation_status = valid ? "valid" : "invalid";
  file.validation_metadata = metadata;
  return { valid, message, metadata };
}

async function extractStoredText(db: ReturnType<typeof getSupabaseAdmin>, file: JsonRecord) {
  if (!db) return "";
  const bucket = String(file.storage_bucket || "submission-files");
  const path = String(file.storage_path || "");
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) return "";
  const bytes = Buffer.from(await data.arrayBuffer());
  const mimeType = String(file.mime_type || "").toLocaleLowerCase();
  try {
    if (mimeType.includes("wordprocessingml") || mimeType === "application/msword" || String(file.original_name || "").toLocaleLowerCase().endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: bytes });
      return result.value || "";
    }
    if (mimeType === "application/pdf" || String(file.original_name || "").toLocaleLowerCase().endsWith(".pdf")) {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as { getDocument: (options: { data: Uint8Array; disableWorker: boolean }) => { promise: Promise<{ numPages: number; getPage: (page: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }> }> } };
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const text = await page.getTextContent();
        pages.push(text.items.map((item) => item.str || "").join(" "));
      }
      return pages.join("\n");
    }
    if (mimeType.startsWith("text/")) return bytes.toString("utf8");
  } catch {
    return "";
  }
  return "";
}

function normalizedText(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function textOverlap(source: string, finalText: string) {
  const sourceTokens = [...new Set(normalizedText(source).split(/\s+/).filter((token) => token.length >= 4))];
  const finalTokens = new Set(normalizedText(finalText).split(/\s+/));
  if (!sourceTokens.length || !finalTokens.size) return 0;
  return sourceTokens.filter((token) => finalTokens.has(token)).length / sourceTokens.length;
}

function textContains(finalText: string, value: string) {
  const expected = normalizedText(value);
  return Boolean(expected && normalizedText(finalText).includes(expected));
}

async function loadContext(submissionId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("The editorial database is not configured.");
  const [
    submissionResult,
    recordResult,
    filesResult,
    authorsResult,
  ] = await Promise.all([
    admin.from("submissions").select("id,reference,title,abstract,author_name,author_email,affiliation,author_details,submitted_at,current_stage,preferred_journal_id,assigned_issue_id").eq("id", submissionId).maybeSingle(),
    admin.from("publication_records").select("id,submission_id,publication_id,journal_id,issue_id,doi,citation_data,final_pdf_file_id,certificate_file_id,metadata,public_article_url").eq("submission_id", submissionId).maybeSingle(),
    admin.from("submission_files").select("*").eq("submission_id", submissionId).order("created_at", { ascending: true }),
    admin.from("submission_authors").select("id,position,first_name,middle_initial,surname,email,institution,affiliation,orcid,academic_title,photo_url").eq("submission_id", submissionId).order("position"),
  ]);
  if (submissionResult.error || !submissionResult.data) throw new Error("Submission not found.");
  if (recordResult.error || !recordResult.data) throw new Error("Save the publication record before running quality control.");
  if (filesResult.error) throw new Error("Publication files could not be loaded.");
  const record = recordResult.data as unknown as JsonRecord;
  const publicationResult = record.publication_id
    ? await admin.from("publications").select("id,title,abstract,author_display,doi,volume,issue_number,pages,keywords,license_name,copyright_holder,recommended_citation,status,updated_at").eq("id", String(record.publication_id)).maybeSingle()
    : { data: null, error: null };
  const issueResult = record.issue_id
    ? await admin.from("issues").select("id,journal_id,volume,issue_number,title").eq("id", String(record.issue_id)).maybeSingle()
    : { data: null, error: null };
  const linksResult = record.publication_id
    ? await admin.from("publication_authors").select("position,corresponding,given_name,middle_name,family_name,academic_title,position_title,affiliation,orcid,authors(id,name,affiliation,credentials,orcid,status,image_url)").eq("publication_id", String(record.publication_id)).order("position")
    : { data: [], error: null };
  const allRecords = record.issue_id
    ? await admin.from("publication_records").select("id,submission_id,metadata").eq("issue_id", String(record.issue_id)).neq("id", String(record.id))
    : { data: [], error: null };
  return {
    admin,
    submission: submissionResult.data as unknown as JsonRecord,
    record,
    files: (filesResult.data || []) as unknown as JsonRecord[],
    submissionAuthors: (authorsResult.data || []) as unknown as JsonRecord[],
    publication: (publicationResult.data || null) as unknown as JsonRecord | null,
    issue: (issueResult.data || null) as unknown as JsonRecord | null,
    publicationAuthors: (linksResult.data || []) as unknown as JsonRecord[],
    issueRecords: (allRecords.data || []) as unknown as JsonRecord[],
  };
}

function fileArtifact(file: JsonRecord, selected: boolean): Artifact {
  return {
    id: String(file.id),
    fileKind: String(file.file_kind),
    name: String(file.original_name || "Publication artifact"),
    mimeType: String(file.mime_type || "application/octet-stream"),
    sizeBytes: Number(file.size_bytes || 0),
    versionNumber: Number(file.version_number || 1),
    sha256: typeof file.sha256 === "string" ? file.sha256 : null,
    selected,
  };
}

function resolvedPublicationAuthor(link: JsonRecord): JsonRecord {
  const profile = (link.authors || {}) as JsonRecord;
  const snapshotName = [link.given_name, link.middle_name, link.family_name].filter(Boolean).join(" ").trim();
  return {
    ...profile,
    id: profile.id,
    name: snapshotName || profile.name || "",
    affiliation: link.affiliation || profile.affiliation || "",
    credentials: link.academic_title || profile.credentials || "",
    orcid: link.orcid || profile.orcid || "",
  };
}

function sourceAndFinalSnapshots(context: Awaited<ReturnType<typeof loadContext>>) {
  const { submission, publication, issue, record, submissionAuthors, publicationAuthors } = context;
  const metadata = (record.metadata || {}) as JsonRecord;
  return {
    source: {
      title: submission.title,
      abstract: submission.abstract,
      authorName: submission.author_name,
      affiliation: submission.affiliation,
      authors: submissionAuthors,
      submittedAt: submission.submitted_at,
      reference: submission.reference,
    },
    final: {
      title: publication?.title || "",
      abstract: publication?.abstract || "",
      authors: publicationAuthors,
      doi: record.doi || "",
      journalId: record.journal_id,
      issueId: record.issue_id,
      volume: publication?.volume || issue?.volume || metadata.volume || "",
      issue: publication?.issue_number || issue?.issue_number || metadata.issueNumber || "",
      pages: publication?.pages || metadata.pages || "",
      keywords: publication?.keywords || [],
      citation: publication?.recommended_citation || "",
      license: publication?.license_name || "",
      publicArticleUrl: record.public_article_url || "",
      doiRegistrationStatus: metadata.doiRegistrationStatus || "assigned",
    },
  };
}

async function evaluate(context: Awaited<ReturnType<typeof loadContext>>, existingChecks: JsonRecord[] = []) {
  const { submission, record, files, publication, issue, publicationAuthors, issueRecords } = context;
  const metadata = (record.metadata || {}) as JsonRecord;
  const finalPdf = currentFile(files, "final_pdf", String(record.final_pdf_file_id || ""));
  const certificate = currentFile(files, "publication_certificate", String(record.certificate_file_id || ""));
  const social = currentFile(files, "social_media_artwork", String(metadata.socialMediaFileId || ""));
  const original = currentFile(files, "manuscript");
  const peer = currentFile(files, "peer_review");
  const checks: CheckSeed[] = [];

  checks.push(automatic("files.original", "Required files", "Author’s original manuscript exists", Boolean(original), "The author’s original manuscript is missing.", "attach_file"));
  checks.push(automatic("files.final", "Required files", "Current final PDF selected", Boolean(finalPdf && finalPdf.id === record.final_pdf_file_id), "Select the current final PDF for this publication.", "select_version"));
  checks.push(automatic("files.peer", "Required files", "Peer-review result attached", Boolean(peer), "Attach the peer-review result.", "attach_file"));
  checks.push(automatic("files.certificate", "Required files", "Issued certificate PDF attached", Boolean(certificate && certificate.id === record.certificate_file_id), "Attach or issue the official certificate PDF.", "regenerate_certificate"));
  checks.push(automatic("files.social", "Required files", "Page 6 social JPG attached", Boolean(social), "Generate and store page 6 as social-media artwork.", "regenerate_certificate"));
  const needsPhoto = Boolean(metadata.socialRequiresPhoto ?? true);
  const submittedPhotos = files.filter((file) => file.file_kind === "authorPhoto").length;
  const hasPhoto = context.submissionAuthors.every((author, index) => !needsPhoto || Boolean(author.photo_url) || index < submittedPhotos);
  checks.push(automatic("files.photos", "Required files", "Required author/profile photo exists", hasPhoto, "An author profile photo required by the social template is missing.", "edit_author"));

  if (finalPdf) {
    const health = await validateStoredFile(context.admin, finalPdf, "final_pdf");
    checks.push(automatic("health.final", "File health", "Final PDF opens and has a renderable page", health.valid, health.message || "The final PDF cannot be opened.", "select_version", { fileId: finalPdf.id, ...health.metadata }));
  } else checks.push(automatic("health.final", "File health", "Final PDF opens and has a renderable page", false, "Select a final PDF before file validation.", "select_version"));
  if (certificate) {
    const health = await validateStoredFile(context.admin, certificate, "publication_certificate");
    checks.push(automatic("health.certificate", "File health", "Certificate PDF opens and contains pages 1–5", health.valid, health.message || "The certificate PDF is invalid.", "regenerate_certificate", { fileId: certificate.id, ...health.metadata }));
  } else checks.push(automatic("health.certificate", "File health", "Certificate PDF opens and contains pages 1–5", false, "Attach the certificate PDF.", "regenerate_certificate"));
  if (social) {
    const health = await validateStoredFile(context.admin, social, "social_media_artwork");
    checks.push(automatic("health.social", "File health", "Social artwork is a valid JPG or PNG", health.valid, health.message || "The social artwork is invalid.", "regenerate_certificate", { fileId: social.id, ...health.metadata }));
  } else checks.push(automatic("health.social", "File health", "Social artwork is a valid JPG or PNG", false, "Store page 6 as social-media artwork.", "regenerate_certificate"));

  const [originalText, finalText] = original && finalPdf
    ? await Promise.all([extractStoredText(context.admin, original), extractStoredText(context.admin, finalPdf)])
    : ["", ""];
  const submittedTitle = String(submission.title || "");
  const finalTitle = String(publication?.title || "");
  const titleMatches = Boolean(submittedTitle && finalText && (textContains(finalText, submittedTitle) || normalizedText(submittedTitle) === normalizedText(finalTitle)));
  checks.push(automatic(
    "comparison.title",
    "Automatic comparison",
    "Final manuscript contains the author-submitted title",
    titleMatches,
    "The author-submitted title was not found in the current final manuscript. Review the title manually.",
    "open_artifact",
    { sourceTitle: submittedTitle, finalTitle, sourceFileId: original?.id || null, finalFileId: finalPdf?.id || null },
  ));
  const overlap = originalText && finalText ? textOverlap(originalText, finalText) : 0;
  checks.push(automatic(
    "comparison.content",
    "Automatic comparison",
    "Final manuscript content substantially matches the author manuscript",
    overlap >= 0.45,
    "The automatic text comparison found limited overlap. Review the original and final files side by side.",
    "open_artifact",
    { sourceFileId: original?.id || null, finalFileId: finalPdf?.id || null, sourceCharacters: originalText.length, finalCharacters: finalText.length, tokenOverlap: Number(overlap.toFixed(3)) },
  ));
  const sourceAuthorFields = context.submissionAuthors.flatMap((author) => [
    [author.first_name, author.middle_initial, author.surname].filter(Boolean).join(" "),
    author.institution,
    author.affiliation,
  ]).filter((value): value is string => Boolean(value && String(value).trim()));
  const authorFieldsMatch = sourceAuthorFields.length === 0 || Boolean(finalText && sourceAuthorFields.every((value) => textContains(finalText, String(value))));
  checks.push(automatic(
    "comparison.author_information",
    "Automatic comparison",
    "Author-submitted names and affiliations appear in the final manuscript",
    authorFieldsMatch,
    "One or more author-supplied names or affiliations were not found in the current final manuscript. Review the author information manually.",
    "open_artifact",
    { expectedFields: sourceAuthorFields, finalFileId: finalPdf?.id || null },
  ));

  checks.push(automatic("metadata.core", "Metadata", "Public title and abstract are complete", Boolean(publication?.title && publication?.abstract), "Public title and abstract are required.", "edit_metadata"));
  checks.push(automatic("metadata.keywords", "Metadata", "Keywords are present", Array.isArray(publication?.keywords) && publication.keywords.length > 0, "Add at least one public keyword.", "edit_metadata"));
  const linkedAuthors = publicationAuthors.map(resolvedPublicationAuthor).filter((author) => Boolean(author.id || author.name));
  checks.push(automatic("metadata.authors", "Metadata", "Every author has a display name and affiliation", linkedAuthors.length > 0 && linkedAuthors.every((author) => author.name && author.affiliation), "Every linked author needs a name and affiliation.", "edit_author"));
  checks.push(automatic("metadata.orcid", "Metadata", "Supplied ORCID values have valid checksums", linkedAuthors.every((author) => !author.orcid || isValidOrcid(String(author.orcid))), "One or more supplied ORCID values have an invalid checksum.", "edit_author"));
  checks.push(automatic("metadata.author_order", "Metadata", "Author order and corresponding author are defined", publicationAuthors.length > 0 && publicationAuthors.filter((link) => link.corresponding).length === 1, "Define author order and exactly one corresponding author.", "edit_author"));
  checks.push(automatic("metadata.profiles", "Metadata", "Author profile mappings are resolved", linkedAuthors.length === publicationAuthors.length && linkedAuthors.every((author) => author.id), "Resolve every final author to a draft or existing profile.", "edit_author"));

  const doi = String(record.doi || "");
  checks.push(automatic("doi.format", "DOI", "DOI uses a valid normalized format", isValidDoi(doi), "Enter a valid DOI such as 10.1234/example.", "edit_metadata"));
  const duplicateResult = doi ? await context.admin.from("publication_records").select("id").ilike("doi", normalizeDoi(doi)).neq("id", String(record.id)).limit(1) : { data: [] };
  checks.push(automatic("doi.unique", "DOI", "DOI is unique case-insensitively", !duplicateResult.data?.length, `DOI ${normalizeDoi(doi)} is already assigned to another publication.`, "edit_metadata"));
  const structuredDoi = String(metadata.certificateDoi || metadata.socialDoi || doi);
  checks.push(automatic("doi.artifacts", "DOI", "DOI matches certificate and structured social fields", Boolean(doi && normalizeDoi(structuredDoi) === normalizeDoi(doi)), "The certificate or social artwork still contains a different DOI.", "regenerate_certificate"));
  checks.push(automatic("doi.status", "DOI", "DOI registration status is recorded", ["assigned", "reserved", "registered"].includes(String(metadata.doiRegistrationStatus || "assigned")), "Record the DOI registration status.", "edit_metadata"));

  const certificateFieldsMatch =
    (!metadata.certificateTitle || String(metadata.certificateTitle).trim() === String(publication?.title || "").trim())
    && (!metadata.certificateDoi || normalizeDoi(String(metadata.certificateDoi)) === normalizeDoi(doi));
  checks.push(automatic("certificate.fields", "Certificate", "Stored certificate fields match publication metadata", certificateFieldsMatch, "Certificate title, DOI, author, journal, issue, volume, or pages do not match.", "regenerate_certificate"));
  checks.push(automatic("certificate.issue_data", "Certificate", "Certificate number and issue data exist", Boolean(metadata.certificateNumber && metadata.certificateIssueDate), "Certificate number or issue date is missing.", "regenerate_certificate"));
  const authorCertificateCount = files.filter((file) => file.file_kind === "author_certificate" || file.file_kind === "publication_certificate").length;
  checks.push(automatic("certificate.per_author", "Certificate", "One required author certificate exists per linked author", authorCertificateCount >= Math.max(1, linkedAuthors.length), "One or more linked authors do not have an author certificate.", "regenerate_certificate"));
  const socialFieldsMatch = Boolean(social)
    && metadata.socialFieldsComplete !== false
    && (!metadata.socialTitle || String(metadata.socialTitle).trim() === String(publication?.title || "").trim())
    && (!metadata.socialDoi || normalizeDoi(String(metadata.socialDoi)) === normalizeDoi(doi));
  checks.push(automatic("social.fields", "Social media", "Author, title, DOI, and profile fields are bound", socialFieldsMatch, "The social artwork is missing required fields or contains previous publication data.", "regenerate_certificate"));

  const pages = String(publication?.pages || metadata.pages || "");
  const [startText, endText] = pages.split(/[-–—]/).map((value) => value.trim());
  const rangeIssue = pageRangeIssue(startText, endText);
  checks.push(automatic("assignment.relation", "Assignment", "Journal and issue IDs are valid and related", Boolean(record.journal_id && issue && issue.journal_id === record.journal_id), "Choose an issue that belongs to the selected journal.", "edit_assignment"));
  checks.push(automatic("assignment.volume_issue", "Assignment", "Volume and issue match the selected issue", Boolean(issue && String(publication?.volume || metadata.volume || "") === String(issue.volume) && String(publication?.issue_number || metadata.issueNumber || "") === String(issue.issue_number)), "Volume or issue number does not match the selected issue.", "edit_assignment"));
  checks.push(automatic("assignment.range", "Assignment", "Page start and end are positive and ordered", !rangeIssue, rangeIssue || "", "edit_assignment"));
  const overlaps = !rangeIssue && issueRecords.some((other) => {
    const otherPages = String(((other.metadata || {}) as JsonRecord).pages || "").split(/[-–—]/).map(Number);
    return otherPages.length === 2 && rangesOverlap(Number(startText), Number(endText), otherPages[0], otherPages[1]);
  });
  checks.push(automatic("assignment.overlap", "Assignment", "Page range does not overlap another paper", !overlaps, `Pages ${startText}–${endText} overlap another record in this issue.`, "edit_assignment"));

  checks.push(automatic("preview.draft", "Public preview", "Draft publication exists", Boolean(publication?.id && publication.status === "draft"), "Save a draft publication record.", "open_preview"));
  const previewComplete = Boolean(publication?.title && publication?.abstract && linkedAuthors.length && publication?.recommended_citation && doi && issue && pages && publication?.license_name && finalPdf);
  checks.push(automatic("preview.complete", "Public preview", "Preview contains all publication data", previewComplete, "The protected preview is missing title, abstract, authors, citation, DOI, issue, pages, license, or final PDF.", "open_preview"));
  checks.push(automatic("preview.renders", "Public preview", "Protected preview is ready", Boolean(record.public_article_url && publication?.id), "The protected public preview cannot be rendered.", "open_preview"));

  const existingByKey = new Map(existingChecks.map((check) => [String(check.check_key), check]));
  for (const definition of manualChecks) {
    const existing = existingByKey.get(definition.key);
    const artifact = definition.artifactKind === "public_preview" ? null : currentFile(files, definition.artifactKind, definition.artifactKind === "final_pdf" ? String(record.final_pdf_file_id || "") : undefined);
    let status = (existing?.status as PreflightCheckStatus | undefined) || "not_reviewed";
    let observed = existing?.observed_summary ? String(existing.observed_summary) : undefined;
    const evidence = (existing?.evidence || {}) as JsonRecord;
    let calculatedBlocker: PreflightBlocker | undefined;
    if (definition.key === "peer.scores" && evidence.rows) {
      const score = validatePeerReviewScores({
        rows: evidence.rows as PeerReviewScoreRow[],
        displayedTotal: Number(evidence.displayedTotal),
        reviewDate: String(evidence.reviewDate || ""),
        submittedAt: String(submission.submitted_at),
      });
      status = score.valid ? "confirmed" : "fail";
      observed = score.valid ? `${score.awardedTotal}/100 verified` : score.issues.join(" ");
      if (!score.valid) calculatedBlocker = blocker({ code: definition.key, group: definition.group, message: score.issues[0], fixAction: "open_artifact", artifactId: artifact ? String(artifact.id) : undefined });
    }
    checks.push({
      ...definition,
      status,
      observed,
      evidence: { ...evidence, artifactId: artifact?.id || null, artifactKind: definition.artifactKind, page: definition.page || null },
      blocker: status === "fail"
        ? calculatedBlocker || blocker({ code: definition.key, group: definition.group, message: existing?.issue_note ? String(existing.issue_note) : `${definition.title} has an unresolved issue.`, fixAction: definition.artifactKind === "public_preview" ? "open_preview" : "open_artifact", artifactId: artifact ? String(artifact.id) : undefined, page: definition.page })
        : undefined,
    });
  }
  return checks;
}

function fingerprintData(context: Awaited<ReturnType<typeof loadContext>>, snapshots: ReturnType<typeof sourceAndFinalSnapshots>) {
  return {
    ruleset: RULESET_VERSION,
    files: context.files
      .filter((file) => ["manuscript", "final_pdf", "peer_review", "publication_certificate", "social_media_artwork"].includes(String(file.file_kind)))
      .map((file) => ({ id: file.id, kind: file.file_kind, hash: file.sha256, version: file.version_number })),
    record: context.record,
    publication: context.publication,
    issue: context.issue,
    authors: context.publicationAuthors,
    snapshots,
  };
}

function runStatus(checks: CheckSeed[]): PreflightStatus {
  if (checks.some((check) => check.blocking !== false && check.status === "fail")) return "blocked";
  if (checks.some((check) => check.blocking !== false && check.status === "not_reviewed")) return "in_review";
  return "ready";
}

export async function runPublicationPreflight(submissionId: string, actor: Actor) {
  const context = await loadContext(submissionId);
  // New preflight tables are introduced by this migration and intentionally remain outside the generated
  // production schema type until the migration is applied and database types are regenerated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = context.admin as any;
  const { data: currentRun } = await db.from("publication_preflight_runs").select("*").eq("submission_id", submissionId).in("status", ["in_review", "blocked", "ready"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: existingChecks } = currentRun ? await db.from("publication_preflight_checks").select("*").eq("run_id", currentRun.id) : { data: [] };
  const checks = await evaluate(context, existingChecks || []);
  const snapshots = sourceAndFinalSnapshots(context);
  const sourceFingerprint = createHash("sha256").update(stableJson(fingerprintData(context, snapshots))).digest("hex");
  const status = runStatus(checks);
  const blockerCount = checks.filter((check) => check.blocking !== false && check.status === "fail").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const runPayload = {
    submission_id: submissionId,
    publication_record_id: context.record.id,
    ruleset_version: RULESET_VERSION,
    source_fingerprint: sourceFingerprint,
    status,
    automatic_blocker_count: blockerCount,
    warning_count: warningCount,
    source_snapshot: snapshots.source,
    final_snapshot: snapshots.final,
    created_by: actor.id,
    updated_at: new Date().toISOString(),
    completed_at: status === "ready" ? new Date().toISOString() : null,
  };
  const { data: run, error: runError } = currentRun
    ? await db.from("publication_preflight_runs").update(runPayload).eq("id", currentRun.id).select("*").single()
    : await db.from("publication_preflight_runs").insert(runPayload).select("*").single();
  if (runError || !run) throw new Error("The quality-control run could not be saved.");
  for (const check of checks) {
    const existing = (existingChecks || []).find((item: JsonRecord) => item.check_key === check.key);
    const payload = {
      run_id: run.id,
      check_key: check.key,
      check_group: check.group,
      title: check.title,
      mode: check.mode,
      blocking: check.blocking !== false,
      status: check.status,
      expected_summary: check.expected || null,
      observed_summary: check.observed || null,
      evidence: check.evidence || {},
      blocker: check.blocker || null,
      updated_at: new Date().toISOString(),
    };
    if (existing) await db.from("publication_preflight_checks").update(payload).eq("id", existing.id);
    else await db.from("publication_preflight_checks").insert(payload);
  }
  await db.from("publication_records").update({ latest_preflight_run_id: run.id }).eq("id", context.record.id);
  return getPublicationPreflight(submissionId, actor);
}

export async function getPublicationPreflight(submissionId: string, actor: Actor) {
  const context = await loadContext(submissionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = context.admin as any;
  const { data: run } = await db.from("publication_preflight_runs").select("*").eq("submission_id", submissionId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: checks } = run ? await db.from("publication_preflight_checks").select("*").eq("run_id", run.id).order("created_at") : { data: [] };
  const snapshots = sourceAndFinalSnapshots(context);
  const selectedIds = new Set([context.record.final_pdf_file_id, context.record.certificate_file_id, ((context.record.metadata || {}) as JsonRecord).socialMediaFileId].filter(Boolean));
  const artifacts = context.files
    .filter((file) => ["manuscript", "production_manuscript", "final_pdf", "peer_review", "publication_certificate", "social_media_artwork"].includes(String(file.file_kind)))
    .map((file) => fileArtifact(file, selectedIds.has(file.id) || file.file_kind === "manuscript" || file.file_kind === "peer_review"));
  const blockers = (checks || []).map((check: JsonRecord) => check.blocker).filter(Boolean);
  return {
    run,
    checks: checks || [],
    blockers,
    artifacts,
    source: snapshots.source,
    final: snapshots.final,
    previewUrl: `/admin/publication-preview/${submissionId}`,
    permissions: { canEdit: actor.role === "admin" || actor.role === "editor", canSubmit: actor.role === "admin" || actor.role === "editor", canApprove: actor.role === "admin" },
  };
}

export async function updatePublicationPreflightCheck(input: {
  submissionId: string;
  checkId: string;
  actor: Actor;
  status: "not_reviewed" | "confirmed" | "fail";
  issueNote?: string;
  evidence?: JsonRecord;
}) {
  const context = await loadContext(input.submissionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = context.admin as any;
  const { data: check } = await db.from("publication_preflight_checks").select("*, publication_preflight_runs!inner(status,submission_id)").eq("id", input.checkId).maybeSingle();
  if (!check || check.publication_preflight_runs.submission_id !== input.submissionId) throw new Error("Quality-control check not found.");
  if (check.publication_preflight_runs.status === "submitted") throw new Error("Submitted quality-control evidence is immutable.");
  if (check.mode === "automatic") throw new Error("Automatic checks cannot be changed manually.");
  if (input.status === "fail" && !input.issueNote?.trim()) throw new Error("Add a short internal note for the issue.");
  const evidence = { ...(check.evidence || {}), ...(input.evidence || {}) };
  let status = input.status;
  let observed: string | null = null;
  if (check.check_key === "peer.scores") {
    const result = validatePeerReviewScores({
      rows: (evidence.rows || []) as PeerReviewScoreRow[],
      displayedTotal: Number(evidence.displayedTotal),
      reviewDate: String(evidence.reviewDate || ""),
      submittedAt: String(context.submission.submitted_at),
    });
    status = result.valid ? "confirmed" : "fail";
    observed = result.valid ? `${result.awardedTotal}/100 verified` : result.issues.join(" ");
  }
  await db.from("publication_preflight_checks").update({
    status,
    issue_note: status === "fail" ? input.issueNote || observed : null,
    evidence,
    observed_summary: observed,
    confirmed_by: status === "confirmed" ? input.actor.id : null,
    confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", input.checkId);
  return runPublicationPreflight(input.submissionId, input.actor);
}

export async function submitPublicationPreflight(submissionId: string, actor: Actor) {
  const detail = await runPublicationPreflight(submissionId, actor);
  if (!detail.run || detail.run.status !== "ready") {
    const messages = detail.blockers.map((item: PreflightBlocker) => item.message);
    throw new Error(messages[0] || "Complete every required quality-control check before submitting.");
  }
  const context = await loadContext(submissionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = context.admin as any;
  const submittedAt = new Date().toISOString();
  await db.from("publication_preflight_runs").update({ status: "submitted", submitted_by: actor.id, submitted_at: submittedAt, updated_at: submittedAt }).eq("id", detail.run.id);
  await db.from("publication_records").update({ submitted_preflight_run_id: detail.run.id, latest_preflight_run_id: detail.run.id }).eq("id", context.record.id);
  await context.admin.from("workflow_checklist_items").update({ completed_at: submittedAt, completed_by: actor.id, metadata: { source: "publication_preflight", runId: detail.run.id } }).eq("submission_id", submissionId).in("stage", ["production_records", "production_ready_to_publish"]);
  const { error } = await context.admin.rpc("transition_submission", {
    p_submission_id: submissionId,
    p_to_stage: "production_ready_to_publish",
    p_actor_id: actor.id,
    p_internal_title: "Publication quality control submitted",
    p_internal_description: "The editor submitted a locked publication preflight snapshot for administrator approval.",
    p_public_title: null,
    p_public_description: null,
    p_visibility: "internal",
    p_metadata: { preflight_run_id: detail.run.id, source_fingerprint: detail.run.source_fingerprint },
  });
  if (error) throw new Error(error.message);
  return getPublicationPreflight(submissionId, actor);
}
