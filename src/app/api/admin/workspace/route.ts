import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * The single read model for the unified /admin workspace.  Browser views must
 * consume this endpoint rather than inventing a second local editorial store.
 */
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ connected: false, error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ connected: false, data: null });

  const [submissions, publicationRecords, journals, issues, authors, templates, certificateRecords, media] = await Promise.all([
    admin.from("submissions").select("id, reference, tracking_number, title, author_name, author_email, affiliation, abstract, author_details, current_stage, submitted_at, created_at, preferred_journal:journals(title), payments(id, payment_reference, provider, amount, currency, status, metadata, confirmed_at), submission_files(id, file_kind, storage_path, original_name, mime_type, size_bytes)").order("created_at", { ascending: false }),
    admin.from("publication_records").select("id, submission_id, doi, scheduled_for, published_at, journals(title), issues(volume, issue_number), publications(views, downloads)").order("created_at", { ascending: false }),
    admin.from("journals").select("id, title, slug, description, scope, issn, issn_online, issn_print, status, accent, hero_image_url, current_issue_id").order("title"),
    admin.from("issues").select("id, journal_id, title, volume, issue_number, description, publication_date, status, cover_image_url").order("publication_date", { ascending: false }),
    admin.from("authors").select("id, name, slug, credentials, affiliation, orcid, bio, status, image_url").order("name"),
    admin.from("certificate_templates").select("id, name, status, is_default, updated_at").order("updated_at", { ascending: false }),
    admin.from("certificate_records").select("id, publication_id, template_id, status, created_at, updated_at").order("created_at", { ascending: false }),
    admin.from("media_assets").select("id, original_name, public_url, alt_text, credit, created_at, media_placements(entity_type, entity_id, placement_key)").order("created_at", { ascending: false }),
  ]);

  const failed = [submissions, publicationRecords, journals, issues, authors, templates, certificateRecords, media].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ connected: false, error: failed.error.message }, { status: 503 });

  return NextResponse.json({
    connected: true,
    data: {
      user,
      submissions: submissions.data || [],
      publicationRecords: publicationRecords.data || [],
      journals: journals.data || [],
      issues: issues.data || [],
      authors: authors.data || [],
      certificateTemplates: templates.data || [],
      certificateRecords: certificateRecords.data || [],
      media: media.data || [],
    },
  });
}
