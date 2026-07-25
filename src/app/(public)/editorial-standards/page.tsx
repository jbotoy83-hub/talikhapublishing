import type { Metadata } from "next";
import Image from "next/image";
import { EditorialPrinciples, EditorialScrollLink, EditorialStandardsNavigation, EditorialStandardsWorkspace } from "@/components/editorial-standards-workspace";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, SITE_NAME, SITE_SHORT_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Editorial standards", description: `Read ${SITE_NAME} policies for authorship, peer review, research ethics, conflicts, corrections, retractions, and AI use.`, alternates: { canonical: "/editorial-standards" } };

export default function EditorialStandardsPage() {
  return <main id="main-content" className="editorial-standards-page">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: `${SITE_NAME} Editorial Standards`, url: absoluteUrl("/editorial-standards"), description: "Policies for authorship, peer review, research ethics, conflicts, corrections, retractions, and AI use.", publisher: { "@id": absoluteUrl("/#organization") }, dateModified: LEGAL_EFFECTIVE_DATE === "Owner approval pending" ? undefined : LEGAL_EFFECTIVE_DATE }} />
    <section className="editorial-standards-hero">
      <Image src="/assets/services-fountain-pen-editorial.png" alt="A fountain pen resting on manuscript pages" fill priority sizes="100vw" />
      <div className="editorial-standards-hero-wash" />
      <div className="section-shell editorial-standards-hero-inner"><div>
        <p className="editorial-overline">Trust and integrity</p>
        <h1>Standards for work readers can <em>trust.</em></h1>
        <p>These principles govern selection, review, editing, publication, correction, and preservation. Process claims must be supported by a real editorial record.</p>
        <EditorialScrollLink targetId="editorialPrinciples">Explore our principles <Icon name="arrow" className="h-4 w-4" /></EditorialScrollLink>
      </div></div>
    </section>
    <EditorialStandardsNavigation />
    <section id="editorialPrinciples" className="editorial-principles"><div className="section-shell">
      <header className="editorial-section-heading"><div><p className="editorial-overline">Core principles</p><h2>The commitments behind every decision.</h2></div><p>Open each principle to understand what authors, reviewers, editors, and readers can expect from {SITE_SHORT_NAME}.</p></header>
      <EditorialPrinciples />
    </div></section>
    <EditorialStandardsWorkspace />
    <section id="editorialAppeals" className="editorial-appeals"><div className="section-shell"><div className="editorial-appeals-card"><span><Icon name="mail" className="h-6 w-6" /></span><div><p className="editorial-overline">Questions and appeals</p><h2>Questions about an editorial decision?</h2><p>Authors may request clarification, report concerns, or appeal when relevant information may have been overlooked. Include the submission reference or publication URL and the evidence that supports the request.</p></div><a href={`mailto:${CONTACT_EMAIL}`}>Contact the editorial team <Icon name="arrow" className="h-4 w-4" /></a></div></div></section>
  </main>;
}
