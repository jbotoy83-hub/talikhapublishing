import type { Metadata } from "next";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { Icon } from "@/components/icon";
import { isSubmissionsEnabled } from "@/lib/launch";
import { SITE_NAME } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasAdminSupabaseConfig } from "@/lib/supabase/config";
import { synchronizeJournalLifecycles } from "@/lib/journal-lifecycle";

export const metadata: Metadata = { title: "Submit your work", description: `Submit research, essays, poetry, fiction, or book manuscripts securely to ${SITE_NAME}.`, alternates: { canonical: "/submit" } };
export const dynamic = "force-dynamic";

const LocalSubmissionForm = nextDynamic(() => import("@/components/local-submission-form").then((mod) => ({ default: mod.LocalSubmissionForm })));

type ServerJournal = { slug: string; id: string; issueId: string; title: string; description: string; scope: string; volume: string; issue: string; status: "Accepting submissions" | "Accepting advance submissions" };

async function getSubmissionJournals(): Promise<ServerJournal[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  await synchronizeJournalLifecycles(admin);
  const { data, error } = await admin
    .from("journals")
    .select("id, slug, title, description, scope, current_issue_id, submission_issue_id")
    .eq("status", "published")
    .not("submission_issue_id", "is", null)
    .order("title");
  if (error || !data?.length) return [];
  const issueIds = data.map((journal) => journal.submission_issue_id).filter((id): id is string => Boolean(id));
  const { data: issues } = await admin.from("issues").select("id,volume,issue_number").in("id", issueIds);
  const issueById = new Map((issues || []).map((issue) => [issue.id, issue]));
  return data.flatMap((j) => {
    if (!j.submission_issue_id) return [];
    const issue = issueById.get(j.submission_issue_id);
    if (!issue) return [];
    return [{ slug: j.slug, id: j.id, issueId: j.submission_issue_id, title: j.title, description: j.description || "", scope: j.scope || "", volume: String(issue.volume), issue: String(issue.issue_number), status: j.submission_issue_id === j.current_issue_id ? "Accepting submissions" as const : "Accepting advance submissions" as const }];
  });
}

export default async function SubmitPage() {
  const formAvailable = isSubmissionsEnabled();
  const adminConfigured = hasAdminSupabaseConfig();
  const serverJournals = adminConfigured ? await getSubmissionJournals() : [];
  const canSubmit = formAvailable && (!adminConfigured || serverJournals.length > 0);

  return (
    <main id="main-content" className="submit-workspace">
      <div className="submit-inner">
        <div className="submit-heading">
          <div>
            <span>Submissions</span>
            <h1>Share your work for review</h1>
            <p>Send your manuscript, author information, and payment proof through our protected editorial desk.</p>
          </div>
          <div className="submit-heading-links">
            <Link href="/track" className="submit-heading-link">Track submission <Icon name="arrow" className="h-4 w-4" /></Link>
            <Link href="/journals" className="submit-heading-link">All journals <Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
        </div>

        <div className="submit-info-row">
          <div className="submit-info-card">
            <span><Icon name="file" className="h-5 w-5" /></span>
            <div><strong>Four clear stages</strong><p>Manuscript, authors, review, and a receipt.</p></div>
          </div>
          <div className="submit-info-card">
            <span><Icon name="shield" className="h-5 w-5" /></span>
            <div><strong>Protected uploads</strong><p>Files are delivered to private editorial storage.</p></div>
          </div>
          <div className="submit-info-card">
            <span><Icon name="mail" className="h-5 w-5" /></span>
            <div><strong>Clear reference</strong><p>Each completed submission receives a tracking number.</p></div>
          </div>
        </div>

        {canSubmit ? (
          <div className="submit-form-card">
            <LocalSubmissionForm serverJournals={serverJournals} />
          </div>
        ) : (
          <section className="submission-closed" role="status">
            <span><Icon name="lock" className="h-7 w-7" /></span>
            <p className="eyebrow">Submissions closed</p>
            <h2>The submission desk is not open yet.</h2>
            <p>{formAvailable ? "No journal issue is currently open for submissions. Please check back soon or contact the editorial team." : "The editorial team is still preparing this submission window."}</p>
          </section>
        )}
      </div>
    </main>
  );
}
