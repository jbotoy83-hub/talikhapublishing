import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/auth";
import { synchronizeJournalLifecycles } from "@/lib/journal-lifecycle";

const STORE_PATH = join(process.cwd(), "src", "data", "journal-store.json");
const IMAGE_BUCKET = "editorial-media";
const UI_STATUSES = ["Draft", "Open", "Editorial", "Production", "Scheduled", "Published", "Archived"] as const;
type UiIssueStatus = (typeof UI_STATUSES)[number];
type JsonRecord = Record<string, unknown>;

type StoreShape = { version?: number; journals: JsonRecord[]; issues: JsonRecord[]; syncedAt?: string };
type JournalInput = JsonRecord & { id: string; slug: string; title: string };
type IssueInput = JsonRecord & { id: string; journalId: string; volume: string; issue: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown) {
  return value === true;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isStoreShape(value: unknown): value is StoreShape {
  return Boolean(value && typeof value === "object" && Array.isArray((value as StoreShape).journals) && Array.isArray((value as StoreShape).issues));
}

function isUiStatus(value: unknown): value is UiIssueStatus {
  return typeof value === "string" && UI_STATUSES.includes(value as UiIssueStatus);
}

function toDbStatus(value: unknown, deleted = false): "draft" | "published" | "archived" {
  if (deleted || value === "Archived") return "archived";
  return value === "Published" ? "published" : "draft";
}

function toUiStatus(value: unknown, metadata: JsonRecord): UiIssueStatus {
  const stored = metadata.editorialStatus;
  if (isUiStatus(stored)) return stored;
  if (value === "published") return "Published";
  if (value === "archived") return "Archived";
  return "Draft";
}

function normalizeAssetUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) return raw;
  return `/assets/${raw.replace(/^assets\//, "")}`;
}

function readLocalStore(): StoreShape {
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as StoreShape;
    if (isStoreShape(parsed)) return parsed;
  } catch {
    // The local file is only a development fallback.
  }
  return { version: 1, journals: [], issues: [], syncedAt: new Date().toISOString() };
}

async function requireEditor() {
  const user = await getAdminUser();
  if (user && user.role !== "viewer") return user;
  return null;
}

function editorId(metadata: JsonRecord, fallback: string) {
  return text(metadata.editorId, fallback);
}

function fallbackJournalId(slug: string) {
  return `jrn-${slug}`;
}

function fallbackIssueId(slug: string, volume: string, issue: string) {
  return `iss-${slug}-${volume}-${issue}`;
}

function normalizeDataUrl(value: string): { bytes: Uint8Array; mime: string } | null {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  if (!bytes.length || !/^image\/(png|jpe?g|webp|gif)$/i.test(match[1])) return null;
  return { bytes, mime: match[1].toLowerCase() };
}

async function persistImage(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, value: unknown, pathKey: string): Promise<string> {
  const raw = text(value);
  if (!raw) return "";
  const data = normalizeDataUrl(raw);
  if (!data) return normalizeAssetUrl(raw);

  const extension = data.mime.split("/")[1].replace("jpeg", "jpg");
  const digest = createHash("sha1").update(data.bytes).digest("hex").slice(0, 16);
  const path = `journal-covers/${pathKey}-${digest}.${extension}`;
  const upload = await admin.storage.from(IMAGE_BUCKET).upload(path, data.bytes, { contentType: data.mime, cacheControl: "31536000", upsert: true });
  if (upload.error) throw new Error(`cover upload failed: ${upload.error.message}`);
  const publicUrl = admin.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  const media = await admin.from("media_assets").upsert({
    storage_bucket: IMAGE_BUCKET,
    storage_path: path,
    public_url: publicUrl,
    original_name: `${pathKey}.${extension}`,
    mime_type: data.mime,
    size_bytes: data.bytes.byteLength,
    alt_text: "Journal issue cover",
  }, { onConflict: "storage_path" }).select("id").single();
  if (media.error) throw new Error(`cover metadata failed: ${media.error.message}`);
  return publicUrl;
}

async function loadFromDatabase(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<StoreShape> {
  await synchronizeJournalLifecycles(admin);
  const [journalsResult, issuesResult] = await Promise.all([
    admin.from("journals").select("id,slug,title,description,scope,issn,issn_online,issn_print,hero_image_url,accent,status,hero_media_id,current_issue_id,submission_issue_id,editorial_metadata").order("slug"),
    admin.from("issues").select("id,journal_id,slug,title,description,volume,issue_number,publication_date,cover_image_url,status,sort_order,cover_media_id,editorial_metadata,created_at").order("volume").order("issue_number"),
  ]);
  if (journalsResult.error) throw new Error(`journal read failed: ${journalsResult.error.message}`);
  if (issuesResult.error) throw new Error(`issue read failed: ${issuesResult.error.message}`);

  const journals = (journalsResult.data || []).map((row) => {
    const metadata = (row.editorial_metadata && typeof row.editorial_metadata === "object" ? row.editorial_metadata : {}) as JsonRecord;
    const slug = text(row.slug);
    return {
      ...metadata,
      id: editorId(metadata, fallbackJournalId(slug)),
      slug,
      title: text(row.title),
      abbreviation: text(metadata.abbreviation),
      issnOnline: text(row.issn_online || metadata.issnOnline || row.issn),
      issnPrint: text(row.issn_print || metadata.issnPrint),
      publisher: text(metadata.publisher, "Talikha Publishing"),
      frequency: text(metadata.frequency, "Quarterly"),
      language: text(metadata.language, "English"),
      subject: text(row.scope || metadata.subject),
      copyright: text(metadata.copyright, "© Talikha Publishing"),
      license: text(metadata.license, "CC BY 4.0"),
      doiPrefix: text(metadata.doiPrefix),
      seoTitle: text(metadata.seoTitle),
      seoDescription: text(metadata.seoDescription || row.description),
      socialImage: text(metadata.socialImage),
      currentIssueId: text(row.current_issue_id),
      submissionIssueId: text(row.submission_issue_id),
      deleted: row.status === "archived" || bool(metadata.deleted),
    };
  });

  const journalByDbId = new Map((journalsResult.data || []).map((row) => [row.id, row]));
  const issues = (issuesResult.data || []).map((row) => {
    const metadata = (row.editorial_metadata && typeof row.editorial_metadata === "object" ? row.editorial_metadata : {}) as JsonRecord;
    const journal = journalByDbId.get(row.journal_id);
    const slug = text(journal?.slug, "journal");
    const volume = text(row.volume, "1");
    const issue = text(row.issue_number, "1");
    return {
      ...metadata,
      id: editorId(metadata, fallbackIssueId(slug, volume, issue)),
      databaseId: row.id,
      journalId: editorId(((journal?.editorial_metadata || {}) as JsonRecord), fallbackJournalId(slug)),
      volume: Number(volume) || 1,
      issue: Number(issue) || 1,
      title: text(row.title),
      description: text(row.description),
      status: toUiStatus(row.status, metadata),
      isCurrent: row.id === journal?.current_issue_id,
      isSubmissionTarget: row.id === journal?.submission_issue_id,
      isSpecial: bool(metadata.isSpecial),
      specialLabel: text(metadata.specialLabel),
      publicationDate: text(row.publication_date),
      submissionDeadline: text(metadata.submissionDeadline),
      editorialStart: text(metadata.editorialStart),
      editorialEnd: text(metadata.editorialEnd),
      openAt: text(metadata.openAt),
      closeAt: text(metadata.closeAt),
      publishAt: text(metadata.publishAt),
      cover: normalizeAssetUrl(row.cover_image_url || metadata.cover),
      articleOrder: Array.isArray(metadata.articleOrder) ? metadata.articleOrder.filter((item): item is string => typeof item === "string") : [],
      doi: text(metadata.doi),
      keywords: Array.isArray(metadata.keywords) ? metadata.keywords.filter((item): item is string => typeof item === "string") : [],
      seoTitle: text(metadata.seoTitle),
      seoDescription: text(metadata.seoDescription),
      socialImage: text(metadata.socialImage),
      changelog: Array.isArray(metadata.changelog) ? metadata.changelog.filter((item): item is string => typeof item === "string") : [],
      deleted: row.status === "archived" || bool(metadata.deleted),
      createdAt: text(row.created_at, new Date().toISOString()),
    };
  });

  return { version: 1, journals, issues, syncedAt: new Date().toISOString() };
}

export async function GET() {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ error: "Sign in as an editor or administrator." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json(readLocalStore());
  try {
    return NextResponse.json(await loadFromDatabase(admin));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") return NextResponse.json(readLocalStore());
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load journal catalog." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ error: "Sign in as an editor or administrator." }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!isStoreShape(body)) return NextResponse.json({ error: "Body must contain journals and issues arrays." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    return NextResponse.json({ ok: true, dbSynced: false, dbError: "Supabase is not configured." });
  }

  const journals = body.journals as JournalInput[];
  const issues = body.issues as IssueInput[];
  const journalDbIds = new Map<string, string>();
  const currentIssueByJournal = new Map<string, string>();
  const submissionIssueByJournal = new Map<string, string>();

  try {
    for (const journal of journals) {
      const slug = text(journal.slug).trim();
      const title = text(journal.title).trim();
      if (!slug || !title) return NextResponse.json({ error: "Every journal needs a title and slug." }, { status: 400 });
      const metadata = { ...(journal.metadata && typeof journal.metadata === "object" ? journal.metadata : {}), editorId: journal.id, deleted: bool(journal.deleted) } as JsonRecord;
      const result = await admin.from("journals").upsert({
        slug,
        title,
        description: text(journal.description || journal.seoDescription),
        scope: text(journal.scope || journal.subject),
        issn: text(journal.issn || journal.issnOnline) || null,
        issn_online: text(journal.issnOnline || journal.issn) || null,
        issn_print: text(journal.issnPrint) || null,
        hero_image_url: await persistImage(admin, journal.hero, `journal-${slug}`),
        accent: text(journal.accent, "emerald"),
        status: bool(journal.deleted) ? "archived" : "published",
        editorial_metadata: metadata,
        updated_at: new Date().toISOString(),
      }, { onConflict: "slug" }).select("id").single();
      if (result.error || !result.data) throw new Error(`journal save failed: ${result.error?.message || slug}`);
      journalDbIds.set(journal.id, result.data.id);
      if (text(journal.submissionIssueId)) submissionIssueByJournal.set(result.data.id, text(journal.submissionIssueId));
    }

    for (const issue of issues) {
      const journalId = journalDbIds.get(issue.journalId);
      if (!journalId) continue;
      const volume = text(issue.volume, "1").trim();
      const issueNumber = text(issue.issue, "1").trim();
      const status = toDbStatus(issue.status, bool(issue.deleted));
      const metadata = { ...(issue.metadata && typeof issue.metadata === "object" ? issue.metadata : {}), editorId: issue.id, editorialStatus: isUiStatus(issue.status) ? issue.status : "Draft", deleted: bool(issue.deleted) } as JsonRecord;
      const cover = await persistImage(admin, issue.cover, `issue-${journalId}-${volume}-${issueNumber}`);
      const existing = await admin.from("issues").select("id").eq("journal_id", journalId).eq("volume", volume).eq("issue_number", issueNumber).maybeSingle();
      const payload = {
        journal_id: journalId,
        slug: `v${volume}-i${issueNumber}`,
        title: text(issue.title) || null,
        description: text(issue.description),
        volume,
        issue_number: issueNumber,
        publication_date: text(issue.publicationDate) || null,
        cover_image_url: cover || null,
        status,
        sort_order: numberValue(issue.sortOrder),
        editorial_metadata: metadata,
        updated_at: new Date().toISOString(),
      };
      const saved = existing.data
        ? await admin.from("issues").update(payload).eq("id", existing.data.id).select("id").single()
        : await admin.from("issues").insert(payload).select("id").single();
      if (saved.error || !saved.data) throw new Error(`issue save failed: ${saved.error?.message || `${volume}.${issueNumber}`}`);
      if (bool(issue.isCurrent) && status === "published" && !bool(issue.deleted)) currentIssueByJournal.set(journalId, saved.data.id);
    }

    for (const [, journalDbId] of journalDbIds) {
      const currentIssueUpdate = await admin
        .from("journals")
        .update({ current_issue_id: currentIssueByJournal.get(journalDbId) || null, submission_issue_id: submissionIssueByJournal.get(journalDbId) || null, updated_at: new Date().toISOString() })
        .eq("id", journalDbId);
      if (currentIssueUpdate.error) throw new Error(`current issue update failed: ${currentIssueUpdate.error.message}`);
    }

    return NextResponse.json({ ok: true, dbSynced: true, journals: journals.length, issues: issues.length, syncedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, dbSynced: false, error: error instanceof Error ? error.message : "Could not save journal catalog." }, { status: 500 });
  }
}
