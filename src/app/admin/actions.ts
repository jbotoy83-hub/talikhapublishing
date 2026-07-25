"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function logout() { const supabase = await createServerSupabase(); await supabase?.auth.signOut(); redirect("/admin/login"); }

export async function togglePublicationStatus(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const id = String(formData.get("id") || ""); const status = String(formData.get("status") || "");
  if (!id || !["draft", "archived"].includes(status)) return;
  const { data: publication } = await admin.from("publications").select("status, source_submission_id").eq("id", id).maybeSingle();
  if (!publication || publication.status === "published" || publication.source_submission_id) return;
  await admin.from("publications").update({ status, published_at: null }).eq("id", id);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "publication.status_changed", entity_type: "publication", entity_id: id, details: { status } });
  revalidatePath("/admin/publications"); revalidatePath("/publications"); revalidatePath("/sitemap.xml");
}

function value(formData: FormData, key: string, max = 5000) {
  return String(formData.get(key) || "").trim().slice(0, max);
}

function slugify(input: string) {
  return input.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

async function audit(action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin();
  if (!admin) return null;
  await admin.from("audit_events").insert({ actor_id: user.id, action, entity_type: entityType, entity_id: entityId, details });
  return { user, admin };
}

export async function addEditorialNote(formData: FormData) {
  const entityType = value(formData, "entityType", 30); const entityId = value(formData, "entityId", 64); const body = value(formData, "body", 5000);
  if (!['submission', 'publication', 'author', 'journal', 'issue'].includes(entityType) || !entityId || !body) return;
  const context = await audit("editorial_note.created", entityType, entityId);
  if (!context) return;
  await context.admin.from("editorial_notes").insert({ entity_type: entityType, entity_id: entityId, body, created_by: context.user.id });
  revalidatePath(`/admin/${entityType === "publication" ? "publications" : `${entityType}s`}`); revalidatePath(`/admin/${entityType === "publication" ? "publications" : `${entityType}s`}/${entityId}`);
}

export async function createAuthor(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const name = value(formData, "name", 240); if (!name) return;
  const requestedSlug = slugify(value(formData, "slug", 120) || name);
  const slug = requestedSlug || `author-${randomUUID().slice(0, 8)}`;
  const { data, error } = await admin.from("authors").insert({
    name, slug, bio: value(formData, "bio", 5000), affiliation: value(formData, "affiliation", 240) || null,
    credentials: value(formData, "credentials", 160) || null, orcid: value(formData, "orcid", 120) || null,
    status: ["draft", "published", "archived"].includes(value(formData, "status", 20)) ? value(formData, "status", 20) : "draft"
  }).select("id").single();
  if (error || !data) return;
  await admin.from("audit_events").insert({ actor_id: user.id, action: "author.created", entity_type: "author", entity_id: data.id, details: { name } });
  revalidatePath("/admin/authors"); redirect(`/admin/authors/${data.id}`);
}

export async function updateAuthor(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const id = value(formData, "id", 64); const name = value(formData, "name", 240); if (!id || !name) return;
  const status = value(formData, "status", 20);
  await admin.from("authors").update({
    name, slug: slugify(value(formData, "slug", 120) || name), bio: value(formData, "bio", 5000),
    affiliation: value(formData, "affiliation", 240) || null, credentials: value(formData, "credentials", 160) || null,
    orcid: value(formData, "orcid", 120) || null, status: ["draft", "published", "archived"].includes(status) ? status : "draft"
  }).eq("id", id);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "author.updated", entity_type: "author", entity_id: id, details: { name } });
  revalidatePath("/admin/authors"); revalidatePath(`/admin/authors/${id}`); revalidatePath("/authors");
}

export async function createJournal(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const title = value(formData, "title", 240); if (!title) return;
  const slug = slugify(value(formData, "slug", 120) || title); if (!slug) return;
  const { data, error } = await admin.from("journals").insert({
    title, slug, description: value(formData, "description", 1000), scope: value(formData, "scope", 3000),
    issn: value(formData, "issn", 80) || null, accent: value(formData, "accent", 40) || "emerald", status: "draft"
  }).select("id").single();
  if (error || !data) return;
  await admin.from("audit_events").insert({ actor_id: user.id, action: "journal.created", entity_type: "journal", entity_id: data.id, details: { title } });
  revalidatePath("/admin/journals"); redirect(`/admin/journals/${data.id}`);
}

export async function createIssue(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const journalId = value(formData, "journalId", 64); const volume = value(formData, "volume", 60); const issueNumber = value(formData, "issueNumber", 60);
  if (!journalId || !volume || !issueNumber) return;
  const title = value(formData, "title", 240) || `Volume ${volume}, Issue ${issueNumber}`;
  const slug = slugify(value(formData, "slug", 120) || `vol-${volume}-issue-${issueNumber}`);
  const { data, error } = await admin.from("issues").insert({ journal_id: journalId, title, slug, volume, issue_number: issueNumber, description: value(formData, "description", 3000), publication_date: value(formData, "publicationDate", 20) || null, status: "draft" }).select("id").single();
  if (error || !data) return;
  await admin.from("audit_events").insert({ actor_id: user.id, action: "issue.created", entity_type: "issue", entity_id: data.id, details: { journalId, volume, issueNumber } });
  revalidatePath(`/admin/journals/${journalId}`); redirect(`/admin/journals/${journalId}`);
}

export async function updateJournal(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const id = value(formData, "id", 64); const title = value(formData, "title", 240); if (!id || !title) return;
  const accent = value(formData, "accent", 40);
  await admin.from("journals").update({
    title, slug: slugify(value(formData, "slug", 120) || title), description: value(formData, "description", 1000), scope: value(formData, "scope", 3000),
    issn: value(formData, "issn", 80) || null, accent: accent || "emerald", status: ["draft", "published", "archived"].includes(value(formData, "status", 20)) ? value(formData, "status", 20) : "draft"
  }).eq("id", id);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "journal.updated", entity_type: "journal", entity_id: id, details: { title } });
  revalidatePath("/admin/journals"); revalidatePath(`/admin/journals/${id}`); revalidatePath("/journals"); revalidatePath("/submit");
}

export async function updateIssue(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const id = value(formData, "id", 64); const journalId = value(formData, "journalId", 64); const volume = value(formData, "volume", 60); const issueNumber = value(formData, "issueNumber", 60);
  if (!id || !journalId || !volume || !issueNumber) return;
  const title = value(formData, "title", 240) || `Volume ${volume}, Issue ${issueNumber}`;
  await admin.from("issues").update({ title, slug: slugify(value(formData, "slug", 120) || `vol-${volume}-issue-${issueNumber}`), volume, issue_number: issueNumber, description: value(formData, "description", 3000), publication_date: value(formData, "publicationDate", 20) || null, status: ["draft", "published", "archived"].includes(value(formData, "status", 20)) ? value(formData, "status", 20) : "draft" }).eq("id", id).eq("journal_id", journalId);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "issue.updated", entity_type: "issue", entity_id: id, details: { journalId, volume, issueNumber } });
  revalidatePath(`/admin/journals/${journalId}`); revalidatePath("/admin/journals"); revalidatePath("/journals"); revalidatePath("/submit");
}

export async function setCurrentJournalIssue(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const journalId = value(formData, "journalId", 64); const issueId = value(formData, "issueId", 64);
  if (!journalId || !issueId) return;
  const { data: issue } = await admin.from("issues").select("id, journal_id, volume, issue_number").eq("id", issueId).maybeSingle();
  if (!issue || issue.journal_id !== journalId) return;
  await admin.from("journals").update({ current_issue_id: issue.id }).eq("id", journalId);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "journal.current_issue_set", entity_type: "journal", entity_id: journalId, details: { issueId: issue.id, volume: issue.volume, issueNumber: issue.issue_number } });
  revalidatePath(`/admin/journals/${journalId}`); revalidatePath("/admin/journals"); revalidatePath("/journals"); revalidatePath("/submit");
}

export async function createPublication(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const title = value(formData, "title", 500); const journalId = value(formData, "journalId", 64); if (!title || !journalId) return;
  // Submission-based studies are created by the production workflow to prevent duplicates.
  if (value(formData, "sourceSubmissionId", 64)) return;
  const authorIds = formData.getAll("authorId").map((item) => String(item)).filter(Boolean);
  const { data: authorRows } = authorIds.length ? await admin.from("authors").select("id, name").in("id", authorIds) : { data: [] as Array<{ id: string; name: string }> };
  const authorsById = new Map((authorRows || []).map((author) => [author.id, author]));
  const orderedAuthors = authorIds.flatMap((id) => authorsById.get(id) ? [authorsById.get(id)!] : []);
  const status = value(formData, "status", 20);
  // Public release is only performed through the scheduled workflow transition.
  const finalStatus = ["draft", "archived"].includes(status) ? status : "draft";
  const slug = slugify(value(formData, "slug", 120) || title); if (!slug) return;
  const issueId = value(formData, "issueId", 64) || null;
  const { data: issue } = issueId ? await admin.from("issues").select("journal_id, volume, issue_number").eq("id", issueId).maybeSingle() : { data: null };
  if (issueId && (!issue || issue.journal_id !== journalId)) return;
  const { data, error } = await admin.from("publications").insert({
    journal_id: journalId, issue_id: issueId, source_submission_id: value(formData, "sourceSubmissionId", 64) || null,
    title, slug, abstract: value(formData, "abstract", 12000), keywords: value(formData, "keywords", 1000).split(",").map((keyword) => keyword.trim()).filter(Boolean).slice(0, 20),
    author_display: orderedAuthors.map((author) => author.name).join("; "), publication_date: value(formData, "publicationDate", 20) || null,
    volume: issue?.volume || value(formData, "volume", 60) || null, issue_number: issue?.issue_number || value(formData, "issueNumber", 60) || null, pages: value(formData, "pages", 60) || null,
    doi: value(formData, "doi", 255) || null, pdf_url: value(formData, "pdfUrl", 2000) || null, recommended_citation: value(formData, "citation", 5000),
    license_name: value(formData, "licenseName", 240) || "All rights reserved", license_url: value(formData, "licenseUrl", 1000) || null,
    copyright_holder: value(formData, "copyrightHolder", 240) || "The authors", content_type: ["research", "creative", "commentary"].includes(value(formData, "contentType", 30)) ? value(formData, "contentType", 30) : "research",
    featured: formData.get("featured") === "on", status: finalStatus, published_at: null
  }).select("id").single();
  if (error || !data) return;
  if (orderedAuthors.length) await admin.from("publication_authors").insert(orderedAuthors.map((author, index) => ({ publication_id: data.id, author_id: author.id, position: index + 1, corresponding: index === 0 })));
  await admin.from("audit_events").insert({ actor_id: user.id, action: "publication.created", entity_type: "publication", entity_id: data.id, details: { title, journalId, authorIds } });
  revalidatePath("/admin/publications"); redirect(`/admin/publications/${data.id}`);
}

export async function updatePublication(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const id = value(formData, "id", 64); const title = value(formData, "title", 500); const journalId = value(formData, "journalId", 64); if (!id || !title || !journalId) return;
  const { data: existing } = await admin.from("publications").select("status, source_submission_id").eq("id", id).maybeSingle();
  if (!existing) return;
  const status = value(formData, "status", 20); const finalStatus = ["draft", "archived"].includes(status) ? status : "draft";
  const supplied = (key: string, max = 5000) => formData.has(key) ? value(formData, key, max) : undefined;
  const optionalStatus = formData.has("status") && existing.status !== "published" && !existing.source_submission_id ? finalStatus : undefined;
  const issueId = value(formData, "issueId", 64) || null;
  const { data: issue } = issueId ? await admin.from("issues").select("journal_id, volume, issue_number").eq("id", issueId).maybeSingle() : { data: null };
  if (issueId && (!issue || issue.journal_id !== journalId)) return;
  await admin.from("publications").update({
    journal_id: journalId, issue_id: issueId, title, slug: slugify(value(formData, "slug", 120) || title),
    abstract: supplied("abstract", 12000), keywords: formData.has("keywords") ? value(formData, "keywords", 1000).split(",").map((keyword) => keyword.trim()).filter(Boolean).slice(0, 20) : undefined,
    publication_date: formData.has("publicationDate") ? value(formData, "publicationDate", 20) || null : undefined, volume: issue?.volume || supplied("volume", 60) || undefined, issue_number: issue?.issue_number || supplied("issueNumber", 60) || undefined,
    pages: formData.has("pages") ? value(formData, "pages", 60) || null : undefined, doi: formData.has("doi") ? value(formData, "doi", 255) || null : undefined, pdf_url: formData.has("pdfUrl") ? value(formData, "pdfUrl", 2000) || null : undefined,
    recommended_citation: supplied("citation", 5000), license_name: formData.has("licenseName") ? value(formData, "licenseName", 240) || "All rights reserved" : undefined, license_url: formData.has("licenseUrl") ? value(formData, "licenseUrl", 1000) || null : undefined,
    copyright_holder: formData.has("copyrightHolder") ? value(formData, "copyrightHolder", 240) || "The authors" : undefined, content_type: formData.has("contentType") ? (["research", "creative", "commentary"].includes(value(formData, "contentType", 30)) ? value(formData, "contentType", 30) : "research") : undefined,
    featured: formData.has("featured") ? formData.get("featured") === "on" : undefined, status: optionalStatus, published_at: optionalStatus ? null : undefined
  }).eq("id", id);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "publication.updated", entity_type: "publication", entity_id: id, details: { title, journalId, status: finalStatus } });
  revalidatePath("/admin/publications"); revalidatePath(`/admin/publications/${id}`); revalidatePath("/publications"); revalidatePath("/sitemap.xml");
}

export async function uploadEditorialImage(formData: FormData) {
  const user = await requireAdmin(); const admin = getSupabaseAdmin(); if (!admin) return;
  const entityType = value(formData, "entityType", 20); const entityId = value(formData, "entityId", 64); const placementKey = value(formData, "placementKey", 30);
  const altText = value(formData, "altText", 500); const credit = value(formData, "credit", 500) || null;
  const upload = formData.get("image");
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  const placements: Record<string, { placement: string; table: "authors" | "journals" | "issues"; url: string; mediaId: string }> = {
    author: { placement: "author_portrait", table: "authors", url: "image_url", mediaId: "portrait_media_id" },
    journal: { placement: "journal_hero", table: "journals", url: "hero_image_url", mediaId: "hero_media_id" },
    issue: { placement: "issue_cover", table: "issues", url: "cover_image_url", mediaId: "cover_media_id" }
  };
  const target = placements[entityType];
  if (!target || target.placement !== placementKey || !entityId || !(upload instanceof File) || !allowed.has(upload.type) || upload.size < 1 || upload.size > 12 * 1024 * 1024) return;
  const originalName = upload.name.toLowerCase();
  if (!/\.(jpe?g|png|webp)$/.test(originalName)) return;
  const extension = originalName.endsWith(".png") ? "png" : originalName.endsWith(".webp") ? "webp" : "jpg";
  const path = `entities/${entityType}/${entityId}/${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await upload.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("editorial-media").upload(path, bytes, { contentType: upload.type, upsert: false });
  if (uploadError) return;
  const { data: urlData } = admin.storage.from("editorial-media").getPublicUrl(path);
  const { data: asset, error: assetError } = await admin.from("media_assets").insert({ storage_bucket: "editorial-media", storage_path: path, public_url: urlData.publicUrl, original_name: upload.name.slice(0, 255), mime_type: upload.type, size_bytes: upload.size, alt_text: altText, credit, created_by: user.id }).select("id").single();
  if (assetError || !asset) { await admin.storage.from("editorial-media").remove([path]); return; }
  const crop = { zoom: Math.min(3, Math.max(1, Number(value(formData, "zoom", 10)) || 1)), x: Math.min(100, Math.max(0, Number(value(formData, "cropX", 10)) || 50)), y: Math.min(100, Math.max(0, Number(value(formData, "cropY", 10)) || 50)) };
  await admin.from("media_placements").upsert({ entity_type: entityType, entity_id: entityId, placement_key: placementKey, asset_id: asset.id, crop }, { onConflict: "entity_type,entity_id,placement_key" });
  await admin.from(target.table).update({ [target.url]: urlData.publicUrl, [target.mediaId]: asset.id }).eq("id", entityId);
  await admin.from("audit_events").insert({ actor_id: user.id, action: "media.image_uploaded", entity_type: entityType, entity_id: entityId, details: { assetId: asset.id, placementKey, crop } });
  revalidatePath("/"); revalidatePath("/authors"); revalidatePath("/journals"); revalidatePath("/publications"); revalidatePath(`/admin/${entityType === "journal" ? "journals" : entityType === "author" ? "authors" : "journals"}`);
}
