import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion, type FaqGroup } from "@/components/faq-accordion";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, SITE_NAME, SITE_SHORT_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: `Answers about ${SITE_NAME} submissions, peer review, fees, copyright, publication records, DOI links, and author pages.`,
  alternates: { canonical: "/faq" },
};

const faqGroups = [
  { id: "before-submit", label: "Before you submit", description: "Start with the work, people, and information needed for a clear submission." },
  { id: "editorial-review", label: "Editorial review", description: "Understand screening, peer review, integrity, and questions about a decision." },
  { id: "rights-privacy", label: "Rights and privacy", description: "See how rights, files, and sensitive submission information are handled." },
  { id: "submissions-records", label: "Submissions and records", description: "Follow a submission and understand how published records are preserved." },
] as const satisfies readonly FaqGroup[];

const faqs = [
  { id: "work-types", groupId: "before-submit", category: "Before you submit", question: "What kinds of work do you publish?", answer: "We publish peer-reviewed research, informed articles and essays, poetry, fiction, creative nonfiction, books, and selected institutional publications. Each journal has its own scope and submission requirements." },
  { id: "submission-fee", groupId: "before-submit", category: "Before you submit", question: "Is there a fee just to submit a manuscript?", answer: "No payment is required merely to create a submission record. If editorial or production services have fees, the scope, amount, timing, and deliverables must be confirmed in writing before work begins." },
  { id: "submission-preparation", groupId: "before-submit", category: "Before you submit", question: "What should I prepare before submitting?", answer: "Make sure the manuscript, figures, references, and contributor details are complete and readable. All authors and contributors should be accurately identified and approve the submission, with required ethics approval, consent, permissions, disclosures, and conflict information ready to share." },
  { id: "institutional-publishing", groupId: "before-submit", category: "Before you submit", question: `How can an institution work with ${SITE_SHORT_NAME}?`, answer: "Schools, research teams, and organizations can request a scoped publishing programme. Submit an outline through the secure form and identify the institution in the affiliation and notes fields." },
  { id: "peer-review", groupId: "editorial-review", category: "Editorial review", question: "Does every research paper receive peer review?", answer: "Scholarly manuscripts selected for peer review are assigned to qualified reviewers and the decision history is recorded. Creative work and service-only projects may follow a different editorial assessment." },
  { id: "review-timeline", groupId: "editorial-review", category: "Editorial review", question: "How long does review take?", answer: "Initial editorial screening normally takes 10 to 15 working days. Peer-reviewed research may require 8 to 12 weeks depending on reviewer availability and revision rounds." },
  { id: "ai-use", groupId: "editorial-review", category: "Editorial review", question: "Can I use AI in my work?", answer: "Meaningful AI assistance should be disclosed, and authors remain responsible for the work, its sources, and its integrity. Submissions must still meet the journal’s authorship, originality, and research-integrity expectations." },
  { id: "editorial-appeal", groupId: "editorial-review", category: "Editorial review", question: "Can I ask for clarification or appeal an editorial decision?", answer: "Authors may request clarification, report concerns, or appeal when relevant information may have been overlooked. Include the submission reference or publication URL and the evidence that supports the request." },
  { id: "copyright", groupId: "rights-privacy", category: "Rights and privacy", question: "Does submitting transfer my copyright?", answer: "No. Submission does not transfer copyright or guarantee acceptance. Any publication rights are confirmed in a written agreement, and the final page displays the work's actual license and rights holder." },
  { id: "private-files", groupId: "rights-privacy", category: "Rights and privacy", question: "Where are my manuscript and payment proof stored?", answer: "Files are uploaded directly to a private Supabase Storage bucket. The public website cannot list or download them. Authorized editors receive short-lived signed access when a file is needed." },
  { id: "discoverability", groupId: "submissions-records", category: "Submissions and records", question: "Will my publication appear in Google and Google Scholar?", answer: "The site provides clean URLs, visible abstracts, citation metadata, schema, sitemaps, and accessible publication links. Indexing services make their own inclusion decisions, so no publisher can guarantee placement or ranking." },
  { id: "record-integrity", groupId: "submissions-records", category: "Submissions and records", question: "Are copied journal records changed?", answer: "No. Journal titles, authorship, study details, citations, DOI metadata, volumes, and issues are preserved so readers can rely on the scholarly record." },
  { id: "correction-request", groupId: "submissions-records", category: "Submissions and records", question: "Can I request a correction?", answer: "Yes. Contact the editorial team with the DOI or publication URL, the correction requested, and supporting evidence. Material changes are documented in the editorial record." },
  { id: "corrections-retractions", groupId: "submissions-records", category: "Submissions and records", question: "How are corrections and retractions handled?", answer: "Errors are corrected transparently. Serious reliability, ethics, authorship, rights, safety, or legal concerns may require an explanatory record, restriction, removal, or retraction." },
  { id: "submission-tracking", groupId: "submissions-records", category: "Submissions and records", question: "How do I track my submission?", answer: "Each completed submission receives a tracking number. Use the number from your receipt on the tracking page or when contacting the editorial team so the correct record can be located." },
] as const;

export default function FaqPage() {
  return <main id="main-content" className="faq-page">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })), url: absoluteUrl("/faq") }} />

    <section className="faq-page-hero">
      <div className="section-shell faq-page-hero-grid">
        <div className="faq-page-hero-copy">
          <p className="eyebrow">Editorial help desk</p>
          <h1 className="display-title">Frequently asked questions</h1>
          <p>Clear answers about submitting, reviewing, publishing, rights, privacy, and discovery.</p>
        </div>
        <aside className="faq-page-register" aria-label="FAQ overview">
          <div className="faq-page-register-head"><span>Knowledge desk</span><strong>{String(faqs.length).padStart(2, "0")}</strong></div>
          <p>One place to understand the work before it becomes part of the record.</p>
          <div className="faq-page-register-topics">{faqGroups.map((group, index) => <div key={group.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{group.label}</strong></div>)}</div>
        </aside>
      </div>
    </section>

    <section className="section-shell faq-page-body">
      <aside className="faq-page-rail">
        <p className="faq-page-rail-label">On this page</p>
        <nav className="faq-page-rail-nav" aria-label="FAQ topics">{faqGroups.map((group, index) => <a href={`#${group.id}`} key={group.id}><span>{String(index + 1).padStart(2, "0")}</span>{group.label}</a>)}</nav>
        <div className="faq-page-rail-note"><strong>{faqs.length} answers</strong><span>Written for authors, readers, and editorial partners.</span></div>
      </aside>

      <div className="faq-page-content">
        <div className="faq-page-content-heading"><p>Questions and answers</p><span>{faqGroups.length} editorial paths</span></div>
        <FaqAccordion faqs={faqs} groups={faqGroups} />

        <aside className="faq-page-contact">
          <span className="faq-page-contact-mark"><Icon name="mail" className="h-6 w-6" /></span>
          <div><p className="eyebrow !text-clay-700">Need another answer?</p><h2>Give the editorial team enough context to help.</h2><p>Use a submission reference, DOI, or publication URL whenever you have one.</p></div>
          <Link href="/submit">Submit securely <Icon name="arrow" className="h-4 w-4" /></Link>
        </aside>
      </div>
    </section>
  </main>;
}
