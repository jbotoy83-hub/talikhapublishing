import type { Metadata } from "next";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { Icon } from "@/components/icon";
import { isSubmissionsEnabled } from "@/lib/launch";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Submit your work", description: `Submit research, essays, poetry, fiction, or book manuscripts securely to ${SITE_NAME}.`, alternates: { canonical: "/submit" } };
export const dynamic = "force-dynamic";

const LocalSubmissionForm = nextDynamic(() => import("@/components/local-submission-form").then((mod) => ({ default: mod.LocalSubmissionForm })));

export default function SubmitPage() {
  const formAvailable = isSubmissionsEnabled();

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

        {formAvailable ? (
          <div className="submit-form-card">
            <LocalSubmissionForm />
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
