import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ connected: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ connected: false, data: null });
  }

  try {
    const [
      submissionCounts,
      recentSubmissions,
      journals,
      authors,
      publicationRecords,
    ] = await Promise.all([
      admin
        .from("submissions")
        .select("current_stage")
        .in("current_stage", [
          "review_new",
          "review_in_progress",
          "review_final",
          "review_accepted",
          "production_ready",
          "production_preparation",
          "production_proof",
          "production_records",
          "production_ready_to_publish",
          "production_scheduled",
          "published",
          "closed",
        ]),
      admin
        .from("submissions")
        .select(
          "id, reference, tracking_number, title, author_name, author_email, current_stage, created_at, submitted_at, preferred_journal:journals(title)",
        )
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("journals")
        .select("id, title, slug, description, status")
        .eq("status", "published")
        .order("title"),
      admin.from("authors").select("id, name, status").eq("status", "published").order("name").limit(50),
      admin
        .from("publication_records")
        .select(
          "id, submission_id, journal_id, issue_id, scheduled_for, published_at, status:submission_id(submissions:title)",
        )
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const stageCounts: Record<string, number> = {};
    for (const row of submissionCounts.data || []) {
      stageCounts[row.current_stage] = (stageCounts[row.current_stage] || 0) + 1;
    }

    return NextResponse.json({
      connected: true,
      data: {
        stageCounts,
        recentSubmissions: recentSubmissions.data || [],
        journals: journals.data || [],
        authors: authors.data || [],
        publicationRecords: publicationRecords.data || [],
        totalSubmissions: (submissionCounts.data || []).length,
        totalJournals: (journals.data || []).length,
        totalAuthors: (authors.data || []).length,
      },
    });
  } catch {
    return NextResponse.json({ connected: false, data: null });
  }
}
