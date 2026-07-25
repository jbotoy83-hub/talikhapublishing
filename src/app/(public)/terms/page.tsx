import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of use", description: `Terms governing use of the ${SITE_NAME} website, submissions, publications, licenses, corrections, and acceptable conduct.`, alternates: { canonical: "/terms" } };

const terms = [
  ["Publications and licenses", "Each publication's displayed license governs reuse. When no reuse license is shown, permission may be required beyond quotation, citation, and uses allowed by law. Links and short attributed quotations are welcome."],
  ["Submission responsibilities", "Authors are responsible for originality, permissions, accurate authorship, research ethics, disclosures, and the truthfulness of information provided. Submission does not guarantee review, acceptance, indexing, ranking, or publication."],
  ["Editorial decisions", `${SITE_NAME} may decline, return, correct, annotate, retract, restrict, or remove material when necessary for quality, rights, safety, integrity, or legal compliance. Material changes to the scholarly record should be documented.`],
  ["Fees and services", "No payment is required merely to submit a manuscript. Any paid editorial or production work must be described in an accepted scope with its fee, timeline, deliverables, and refund or cancellation terms."],
  ["Acceptable use", "Users must not upload unlawful, malicious, plagiarized, defamatory, privacy-invasive, or rights-infringing material; impersonate another person; bypass access controls; probe private systems; or interfere with availability."],
  ["Availability", "The service may be changed or interrupted for maintenance, security, legal, or operational reasons. External DOI, repository, and indexing services are governed by their own availability and policies."],
] as const;

export default function TermsPage() {
  return <main id="main-content"><section className="listing-hero border-b border-forest-900/10 bg-white"><div className="section-shell py-16"><p className="eyebrow">Legal</p><h1 className="display-title mt-3 text-5xl font-bold text-forest-900">Terms of use</h1><p className="mt-5 max-w-2xl leading-8 text-gray-600">Effective {LEGAL_EFFECTIVE_DATE}. These terms apply to the public website and secure submission service.</p></div></section><section className="section-shell max-w-4xl py-16"><div className="grid gap-5">{terms.map(([title, copy], index) => <article key={title} className="grid gap-4 rounded-2xl border border-forest-900/10 bg-white p-7 sm:grid-cols-[3rem_1fr]"><span className="font-serif text-2xl font-bold text-clay-700">{String(index + 1).padStart(2, "0")}</span><div><h2 className="font-serif text-2xl font-bold text-forest-900">{title}</h2><p className="mt-3 leading-8 text-gray-600">{copy}</p></div></article>)}</div><aside className="mt-10 flex flex-col gap-4 rounded-3xl bg-[#eef3ef] p-7 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow !text-clay-700">Questions or permissions</p><p className="mt-2 max-w-xl text-sm leading-7 text-gray-600">For permissions questions, send the relevant publication URL and the intended use to the editorial team.</p></div><a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-forest-800 px-5 py-3 text-sm font-bold text-white">Contact us <Icon name="mail" className="h-4 w-4" /></a></aside><p className="mt-6 text-sm text-gray-600">See also the <Link href="/privacy" className="font-bold text-clay-700">privacy notice</Link> and <Link href="/editorial-standards" className="font-bold text-clay-700">editorial standards</Link>.</p></section></main>;
}
