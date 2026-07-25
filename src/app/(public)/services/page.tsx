import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Publishing services", description: `Editorial review, language editing, publication design, metadata preparation, and digital publication support from ${SITE_NAME}.`, alternates: { canonical: "/services" } };

const services = [
  ["edit", "Editorial development", "Structural editing, copyediting, proofreading, and author guidance for research and creative manuscripts."],
  ["book", "Book and journal design", "Reader-centred interiors, covers, journal layouts, and accessible files designed for digital publication and archiving."],
  ["shield", "Copyright guidance", "Clear support for author agreements, permissions, rights notes, and the license displayed on each publication record."],
  ["globe", "Digital publication", "Stable public pages, citations, metadata, DOI links where available, and practical discovery support for readers and indexes."],
  ["users", "Institutional programmes", "Scoped support for school journals, proceedings, research teams, community collections, and book series."],
  ["file", "Publication records", "Author profiles, journal context, correction history, and accessible records that keep the published work connected to its source."],
] as const;

export default function ServicesPage() {
  return <main id="main-content" className="publishing-services-page">
    <section className="publishing-services-hero">
      <Image src="/assets/services-fountain-pen-editorial.png" alt="A forest-green fountain pen resting on manuscript pages" fill priority sizes="100vw" className="publishing-services-hero-image" />
      <div className="publishing-services-hero-wash" /><div className="publishing-services-hero-dots" aria-hidden="true" />
      <div className="section-shell publishing-services-hero-inner"><p className="eyebrow">Publishing services</p><h1>Editorial care from <em>first draft</em> to <span>lasting discovery.</span></h1><i aria-hidden="true" /><p><strong>Flexible, transparent support</strong> for individual authors, research teams, schools, and community organisations. Scope, cost, timeline, and deliverables are always confirmed in writing before work begins.</p></div>
    </section>
    <section className="publishing-services-catalog"><div className="section-shell">
      <div className="publishing-services-grid">{services.map(([icon, title, copy]) => <article key={title} className="publishing-service-card"><span className="publishing-service-icon"><Icon name={icon} className="h-7 w-7" /></span><div><b>Publishing support</b><h2>{title}</h2><p>{copy}</p></div></article>)}</div>
      <aside className="publishing-services-institution"><span><Icon name="users" className="h-8 w-8" /></span><div><p className="eyebrow">Built for institutions</p><h2>Launching a journal, proceedings, or book series?</h2><p>We can design the editorial workflow, contributor experience, publication system, metadata, and long-term archive around your team.</p></div></aside>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-forest-900/10 pt-8"><div><p className="eyebrow">Start with context</p><h2 className="mt-2 font-serif text-3xl font-bold text-forest-900">Tell us about the work you want to publish.</h2></div><Link href="/submit" className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-3 text-sm font-bold text-white">Create a secure submission <Icon name="arrow" className="h-4 w-4" /></Link></div>
    </div></section>
  </main>;
}
