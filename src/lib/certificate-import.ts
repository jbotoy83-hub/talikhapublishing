import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { CERTIFICATE_ASSET_BUCKET } from "@/lib/certificate-editor";

type JsonRecord = Record<string, unknown>;

export type ImportCandidate = {
  publicationId: string;
  submissionId: string;
  title: string;
  journal: string;
  volume: string;
  issue: string;
  authorCount: number;
  ready: boolean;
  missing: string[];
};

function object(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function string(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function rows(value: unknown): JsonRecord[] { return Array.isArray(value) ? value.map(object) : []; }

function manilaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function fullName(author: JsonRecord, fallback: string) {
  const first = string(author.first_name || author.firstName);
  const middleRaw = string(author.middle_initial || author.middleInitial).replace(/\.+$/, "");
  const middle = middleRaw ? `${middleRaw}.` : "";
  const surname = string(author.surname);
  return [first, middle, surname].filter(Boolean).join(" ") || fallback;
}

function firstRow(value: unknown): JsonRecord { return Array.isArray(value) ? object(value[0]) : object(value); }

export async function listCertificateImportCandidates(admin: SupabaseClient): Promise<ImportCandidate[]> {
  const readySubmissions = await admin.from("submissions").select("id").eq("current_stage", "production_ready_to_publish");
  if (readySubmissions.error) throw new Error(readySubmissions.error.message);
  const submissionIds = (readySubmissions.data || []).map((row) => row.id);
  if (!submissionIds.length) return [];

  const result = await admin.from("publication_records")
    .select("submission_id,publication_id,publications(id,title,doi,publication_date,journal:journals(title),issue:issues(volume,issue_number),publication_authors(position,author:authors(id,name)))")
    .in("submission_id", submissionIds)
    .not("publication_id", "is", null);
  if (result.error) throw new Error(result.error.message);

  return (result.data || []).map((row) => {
    const record = object(row);
    const publication = firstRow(record.publications);
    const journal = firstRow(publication.journal);
    const issue = firstRow(publication.issue);
    const authors = rows(publication.publication_authors);
    const missing = [
      !string(publication.title) && "manuscript title",
      !string(journal.title) && "journal",
      !string(issue.volume) && "volume",
      !string(issue.issue_number) && "issue",
      !authors.length && "linked authors",
    ].filter(Boolean) as string[];
    return {
      publicationId: string(record.publication_id), submissionId: string(record.submission_id), title: string(publication.title), journal: string(journal.title),
      volume: string(issue.volume), issue: string(issue.issue_number), authorCount: authors.length, ready: missing.length === 0, missing,
    };
  }).sort((a, b) => a.title.localeCompare(b.title));
}

async function sourceForPublication(admin: SupabaseClient, publicationId: string) {
  const publicationResult = await admin.from("publications")
    .select("id,title,doi,publication_date,source_submission_id,journal:journals(title,issn,issn_online,issn_print),issue:issues(volume,issue_number,publication_date),publication_authors(position,author:authors(id,name,affiliation,credentials))")
    .eq("id", publicationId).single();
  if (publicationResult.error || !publicationResult.data) throw new Error(publicationResult.error?.message || "Publication not found.");
  const publication = object(publicationResult.data);
  const submissionId = string(publication.source_submission_id);
  if (!submissionId) throw new Error("This publication is not connected to a manuscript.");
  const stageResult = await admin.from("submissions").select("id,current_stage,author_name,affiliation,author_details").eq("id", submissionId).single();
  if (stageResult.error || !stageResult.data) throw new Error(stageResult.error?.message || "Manuscript not found.");
  if (!String(stageResult.data.current_stage || "").startsWith("production_")) throw new Error("A certificate can be prepared only from a publication record in production.");
  const authorsResult = await admin.from("submission_authors")
    .select("position,first_name,middle_initial,surname,position_title,academic_title,institution,location")
    .eq("submission_id", submissionId).order("position");
  if (authorsResult.error) throw new Error(authorsResult.error.message);
  const filesResult = await admin.from("submission_files")
    .select("id,original_name,storage_bucket,storage_path,mime_type")
    .eq("submission_id", submissionId).eq("file_kind", "authorPhoto");
  if (filesResult.error) throw new Error(filesResult.error.message);
  return { publication, submission: object(stageResult.data), submissionAuthors: rows(authorsResult.data), authorPhotos: rows(filesResult.data) };
}

function valueSet(publication: JsonRecord, submission: JsonRecord, sourceAuthor: JsonRecord, profile: JsonRecord, number: string) {
  const journal = firstRow(publication.journal);
  const issue = firstRow(publication.issue);
  const fallbackName = string(profile.name) || string(submission.author_name);
  const authorName = fullName(sourceAuthor, fallbackName);
  const issueDate = string(issue.publication_date) || string(publication.publication_date);
  const warnings: string[] = [];
  if (!authorName) warnings.push("This author has no name in the manuscript source.");
  if (!Object.keys(sourceAuthor).length) warnings.push("This author could not be matched to the manuscript author details.");
  return {
    author_name: authorName,
    author_academic_title: string(sourceAuthor.academic_title) || string(profile.credentials),
    author_role: string(sourceAuthor.position_title),
    author_affiliation: string(sourceAuthor.institution) || string(profile.affiliation) || string(submission.affiliation),
    author_location: string(sourceAuthor.location),
    author_photo: "",
    work_title: string(publication.title),
    doi: string(publication.doi),
    publication_name: string(journal.title),
    volume_number: string(issue.volume),
    issue_number: string(issue.issue_number),
    issue_date: issueDate,
    issn_online: string(journal.issn_online) || string(journal.issn),
    issn_print: string(journal.issn_print),
    certificate_number: number,
    reference_number: number,
    date_issued: manilaDate(),
    publisher_name: "Talikha Publishing",
    issuing_city: "Butuan City",
    _import_warnings: warnings,
  };
}

async function copyAuthorPhoto(admin: SupabaseClient, authorPhotos: JsonRecord[], authorIndex: number, templateId: string): Promise<string> {
  const expectedName = `author-${String(authorIndex + 1).padStart(3, "0")}`;
  const file = authorPhotos.find((f) => string(f.original_name).startsWith(expectedName)) || authorPhotos[authorIndex] || authorPhotos[0];
  if (!file) return "";
  const bucket = string(file.storage_bucket);
  const path = string(file.storage_path);
  if (!bucket || !path) return "";
  const download = await admin.storage.from(bucket).download(path);
  if (download.error || !download.data) return "";
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const mime = string(file.mime_type);
  const ext = mime === "image/png" ? "png" : "jpg";
  const destPath = `templates/${templateId}/images/${randomUUID()}.${ext}`;
  const upload = await admin.storage.from(CERTIFICATE_ASSET_BUCKET).upload(destPath, bytes, { contentType: mime || "image/jpeg", upsert: false });
  if (upload.error) return "";
  return destPath;
}

export async function importPublicationCertificates(admin: SupabaseClient, templateId: string, publicationId: string) {
  const { publication, submission, submissionAuthors, authorPhotos } = await sourceForPublication(admin, publicationId);
  const publicationAuthors = rows(publication.publication_authors).sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  if (!publicationAuthors.length) throw new Error("This publication has no linked authors.");
  const imported: JsonRecord[] = [];
  for (const linked of publicationAuthors) {
    const profile = firstRow(linked.author);
    const authorId = string(profile.id);
    if (!authorId) throw new Error("A linked author profile is missing.");
    const existing = await admin.from("certificate_records").select("id,author_id,status,field_values,certificate_number,created_at,updated_at,template_id,publication_id,submission_id").eq("template_id", templateId).eq("publication_id", publicationId).eq("author_id", authorId).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) { imported.push({ ...existing.data, reused: true }); continue; }
    const sourceAuthor = submissionAuthors.find((author) => Number(author.position || 0) === Number(linked.position || 0)) || {};
    const year = Number(manilaDate().slice(0, 4));
    const allocation = await admin.rpc("allocate_certificate_number", { p_year: year });
    if (allocation.error || !allocation.data) throw new Error(allocation.error?.message || "Could not allocate a certificate number.");
    const number = string(allocation.data);
    const values = valueSet(publication, submission, sourceAuthor, profile, number);
    const authorIndex = submissionAuthors.findIndex((a) => Number(a.position || 0) === Number(linked.position || 0));
    const photoPath = await copyAuthorPhoto(admin, authorPhotos, authorIndex >= 0 ? authorIndex : 0, templateId);
    if (photoPath) values.author_photo = photoPath;
    const inserted = await admin.from("certificate_records").insert({
      template_id: templateId, publication_id: publicationId, author_id: authorId, submission_id: string(submission.id),
      certificate_number: number, reference_number: number, field_values: values, status: "draft",
    }).select("id,author_id,status,field_values,certificate_number,created_at,updated_at,template_id,publication_id,submission_id").single();
    if (inserted.error || !inserted.data) {
      // A simultaneous import may have won the unique record race. Reuse it;
      // number gaps are acceptable and preserve the audit trail.
      const raced = await admin.from("certificate_records").select("id,author_id,status,field_values,certificate_number,created_at,updated_at,template_id,publication_id,submission_id").eq("template_id", templateId).eq("publication_id", publicationId).eq("author_id", authorId).maybeSingle();
      if (raced.error || !raced.data) throw new Error(inserted.error?.message || raced.error?.message || "Could not create certificate record.");
      imported.push({ ...raced.data, reused: true });
    } else imported.push({ ...inserted.data, reused: false });
  }
  return imported;
}

export async function refreshCertificateRecord(admin: SupabaseClient, recordId: string) {
  const existing = await admin.from("certificate_records").select("id,template_id,publication_id,author_id,status,certificate_number").eq("id", recordId).single();
  if (existing.error || !existing.data) throw new Error(existing.error?.message || "Certificate record not found.");
  if (existing.data.status === "issued") throw new Error("Issued certificates are immutable.");
  const { publication, submission, submissionAuthors, authorPhotos } = await sourceForPublication(admin, existing.data.publication_id);
  const linked = rows(publication.publication_authors).find((item) => string(firstRow(item.author).id) === existing.data.author_id);
  if (!linked) throw new Error("The certificate author is no longer linked to this publication.");
  const profile = firstRow(linked.author);
  const sourceAuthor = submissionAuthors.find((author) => Number(author.position || 0) === Number(linked.position || 0)) || {};
  const values = valueSet(publication, submission, sourceAuthor, profile, existing.data.certificate_number);
  const authorIndex = submissionAuthors.findIndex((a) => Number(a.position || 0) === Number(linked.position || 0));
  const photoPath = await copyAuthorPhoto(admin, authorPhotos, authorIndex >= 0 ? authorIndex : 0, existing.data.template_id);
  if (photoPath) values.author_photo = photoPath;
  const update = await admin.from("certificate_records").update({ field_values: values }).eq("id", recordId).select("id,author_id,status,field_values,certificate_number,created_at,updated_at,template_id,publication_id,submission_id").single();
  if (update.error || !update.data) throw new Error(update.error?.message || "Could not refresh certificate record.");
  return update.data;
}
