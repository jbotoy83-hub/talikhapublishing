import { JsonLd } from "@/components/json-ld";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { PrivacyBanner } from "@/components/privacy-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getJournals } from "@/lib/content";
import { getJournalPresentation } from "@/lib/journal-presentation";
import {
  absoluteUrl,
  getSiteUrl,
  SITE_AREA_SERVED,
  SITE_DESCRIPTION,
  SITE_FOUNDING_YEAR,
  SITE_LANGUAGE,
  SITE_LOCATION,
  SITE_NAME
} from "@/lib/site";

export const revalidate = 300;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const journals = (await getJournals()).slice(0, 6).map((journal) => ({
    slug: journal.slug,
    title: journal.title,
    type: getJournalPresentation(journal).type
  }));
  const organizationId = absoluteUrl("/#organization");

  return <>
    <JsonLd data={{
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", "@id": organizationId, name: SITE_NAME, url: getSiteUrl(), logo: absoluteUrl("/icon.svg"), description: SITE_DESCRIPTION, foundingDate: SITE_FOUNDING_YEAR || undefined, foundingLocation: SITE_LOCATION ? { "@type": "Place", name: SITE_LOCATION } : undefined, areaServed: SITE_AREA_SERVED || undefined, publishingPrinciples: absoluteUrl("/editorial-standards") },
        { "@type": "WebSite", "@id": absoluteUrl("/#website"), url: getSiteUrl(), name: SITE_NAME, publisher: { "@id": organizationId }, inLanguage: SITE_LANGUAGE, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/search?q={search_term_string}") }, "query-input": "required name=search_term_string" } }
      ]
    }} />
    <SiteHeader journals={journals} />
    <AnnouncementBanner />
    {children}
    <ScrollReveal />
    <SiteFooter />
    <PrivacyBanner />
  </>;
}
