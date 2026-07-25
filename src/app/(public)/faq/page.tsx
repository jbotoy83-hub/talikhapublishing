import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/faq-accordion";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, SITE_NAME, SITE_SHORT_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: `Answers about ${SITE_NAME} submissions, peer review, fees, copyright, publication records, DOI links, and author pages.`,
  alternates: { canonical: "/faq" },
};

const faqs = [
  ["Does submitting transfer my copyright?", "No. Submission does not transfer copyright or guarantee acceptance. Any publication rights are confirmed in a written agreement, and the final page displays the work's actual license and rights holder."],
  ["Is there a fee just to submit a manuscript?", "No payment is required merely to create a submission record. If editorial or production services have fees, the scope, amount, timing, and deliverables must be confirmed in writing before work begins."],
  ["Where are my manuscript and payment proof stored?", "Files are uploaded directly to a private Supabase Storage bucket. The public website cannot list or download them. Authorized editors receive short-lived signed access when a file is needed."],
  ["Does every research paper receive peer review?", "Scholarly manuscripts selected for peer review are assigned to qualified reviewers and the decision history is recorded. Creative work and service-only projects may follow a different editorial assessment."],
  ["Will my publication appear in Google and Google Scholar?", "The site provides clean URLs, visible abstracts, citation metadata, schema, sitemaps, and accessible publication links. Indexing services make their own inclusion decisions, so no publisher can guarantee placement or ranking."],
  ["Are copied journal records changed?", "No. Journal titles, authorship, study details, citations, DOI metadata, volumes, and issues are preserved so readers can rely on the scholarly record."],
  ["Can I request a correction?", "Yes. Contact the editorial team with the DOI or publication URL, the correction requested, and supporting evidence. Material changes are documented in the editorial record."],
  [`How can an institution work with ${SITE_SHORT_NAME}?`, "Schools, research teams, and organizations can request a scoped publishing programme. Submit an outline through the secure form and identify the institution in the affiliation and notes fields."],
] as const;

export default function FaqPage() {
  return <main id="main-content">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })), url: absoluteUrl("/faq") }} />
    <section className="listing-hero border-b border-forest-900/10 bg-white">
      <div className="section-shell py-16">
        <p className="eyebrow">Help center</p>
        <h1 className="display-title mt-3 max-w-4xl text-5xl font-bold text-forest-900">Frequently asked questions</h1>
        <p className="mt-5 max-w-2xl leading-8 text-gray-600">Clear answers about submitting, reviewing, publishing, rights, privacy, and discovery.</p>
      </div>
    </section>
    <section className="section-shell max-w-4xl py-16">
      <FaqAccordion faqs={faqs} />
      <aside className="mt-12 grid gap-5 rounded-3xl border border-forest-900/10 bg-[#eef3ef] p-7 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-800 text-white"><Icon name="mail" className="h-6 w-6" /></span>
        <div><p className="eyebrow !text-clay-700">Need another answer?</p><h2 className="mt-2 font-serif text-2xl font-bold text-forest-900">Give the editorial team enough context to help.</h2><p className="mt-2 text-sm leading-7 text-gray-600">Use a submission reference, DOI, or publication URL whenever you have one.</p></div>
        <Link href="/submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest-800 px-5 py-3 text-sm font-bold text-white">Submit securely <Icon name="arrow" className="h-4 w-4" /></Link>
      </aside>
    </section>
  </main>;
}
