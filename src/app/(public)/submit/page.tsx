import type { Metadata } from "next";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { Icon } from "@/components/icon";
import { isSubmissionsEnabled } from "@/lib/launch";
import { SITE_NAME } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Submit your work", description: `Submit research, essays, poetry, fiction, or book manuscripts securely to ${SITE_NAME}.`, alternates: { canonical: "/submit" } };
export const dynamic = "force-dynamic";

const SubmissionForm = nextDynamic(() => import("@/components/submission-form").then((mod) => ({ default: mod.SubmissionForm })));

type JournalOption = { id: string; slug: string; title: string; description: string; scope: string; accent: string; issue: { id: string; volume: string; number: string } };

async function getSubmissionJournals(): Promise<JournalOption[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data: journals, error } = await admin
    .from("journals")
    .select("id, slug, title, description, scope, accent, current_issue_id")
    .eq("status", "published")
    .not("current_issue_id", "is", null)
    .order("title");
  if (error || !journals?.length) return [];
  const issueIds = journals.map((journal) => journal.current_issue_id).filter((id): id is string => Boolean(id));
  if (!issueIds.length) return [];
  const { data: issues } = await admin.from("issues").select("id, volume, issue_number").in("id", issueIds);
  const issueById = new Map((issues || []).map((issue) => [issue.id, issue]));
  return journals.flatMap((journal) => {
    const issue = issueById.get(journal.current_issue_id as string);
    if (!issue) return [];
    return [{ id: journal.id, slug: journal.slug, title: journal.title, description: journal.description || "", scope: journal.scope || "", accent: journal.accent || "emerald", issue: { id: issue.id, volume: issue.volume, number: issue.issue_number } }];
  });
}

export default async function SubmitPage() {
  const formAvailable = isSubmissionsEnabled();
  const journals = formAvailable ? await getSubmissionJournals() : [];
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
  const canSubmit = journals.length > 0;

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
            <SubmissionForm journals={journals} turnstileSiteKey={turnstileSiteKey} />
          </div>
        ) : (
          <section className="submission-closed" role="status">
            <span><Icon name="lock" className="h-7 w-7" /></span>
            <p className="eyebrow">Submissions closed</p>
            <h2>The submission desk is not open yet.</h2>
            <p>The editorial team is still preparing this submission window.</p>
          </section>
        )}
      </div>
    </main>
  );
}
