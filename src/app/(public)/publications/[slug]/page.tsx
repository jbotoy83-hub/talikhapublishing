import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { RelatedPublicationsCarousel } from "@/components/related-publications-carousel";
import { PublicationViewTracker } from "@/components/publication-view-tracker";
import { PublicationPdfReader } from "@/components/publication-pdf-reader";
import { DemoPublicationPdfReader } from "@/components/demo-publication-pdf-reader";
import { OpenAccessBadge } from "@/components/license-badge";
import { CitationPanel } from "@/components/citation-panel";
import { ShareButtons } from "@/components/share-buttons";
import { getPublication, getPublications } from "@/lib/content";
import { absoluteUrl, SITE_LANGUAGE, SITE_NAME } from "@/lib/site";
import { isOpenAccess } from "@/lib/citation-format";

export const revalidate = 300;

export async function generateStaticParams() {
  const publications = await getPublications();
  return publications.map((publication) => ({ slug: publication.slug }));
}

function authorNamesFor(publication: NonNullable<Awaited<ReturnType<typeof getPublication>>>) {
  return publication.authors.length
    ? publication.authors.map((author) => author.name)
    : publication.authorDisplay.split(";").map((author) => author.trim()).filter(Boolean);
}

function isPdfUrl(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value, absoluteUrl("/")).pathname.toLocaleLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

function isEmbeddablePdf(value: string | undefined) {
  if (!value) return false;
  try {
    const pathname = new URL(value, absoluteUrl("/")).pathname;
    if (pathname.toLocaleLowerCase().endsWith(".pdf")) return true;
    return /^\/api\/publications\/[^/]+\/pdf\/?$/.test(pathname);
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const publication = await getPublication(slug);
  if (!publication) return {};
  const authorNames = authorNamesFor(publication);
  const summary = publication.abstract || `${publication.title} by ${publication.authorDisplay}, published in ${publication.journal.title}.`;
  const pages = publication.pages?.split(/[-–—]/).map((page) => page.trim()) || [];
  const citationMeta: Record<string, string | string[]> = {
    citation_title: publication.title,
    citation_author: authorNames,
    citation_publication_date: publication.publicationDate,
    citation_journal_title: publication.journal.title,
    citation_volume: publication.volume || "",
    citation_issue: publication.issue || "",
    citation_firstpage: pages[0] || "",
    citation_lastpage: pages[1] || "",
    citation_doi: publication.doi || "",
    citation_language: SITE_LANGUAGE,
    citation_fulltext_html_url: absoluteUrl(`/publications/${publication.slug}`)
  };
  if (publication.abstract) citationMeta.citation_abstract = publication.abstract;
  if (publication.journal.issn) citationMeta.citation_issn = publication.journal.issn;
  if (isPdfUrl(publication.pdfUrl)) citationMeta.citation_pdf_url = publication.pdfUrl!;
  return {
    title: publication.title,
    description: summary,
    authors: authorNames.map((name) => ({ name })),
    alternates: { canonical: `/publications/${publication.slug}` },
    openGraph: {
      type: "article",
      url: `/publications/${publication.slug}`,
      title: publication.title,
      description: summary,
      publishedTime: publication.publicationDate,
      modifiedTime: publication.modifiedDate,
      authors: authorNames,
      section: publication.journal.title,
      tags: publication.keywords,
      images: [publication.journal.heroImage]
    },
    other: citationMeta
  };
}

export default async function PublicationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [publication, allPublications] = await Promise.all([getPublication(slug), getPublications()]);
  if (!publication) notFound();

  const displayDate = /^\d{4}-\d{2}-\d{2}$/.test(publication.publicationDate)
    ? new Date(`${publication.publicationDate}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
    : publication.publicationDate;
  const related = allPublications.filter((item) => item.id !== publication.id && item.journal.id === publication.journal.id).slice(0, 9);
  const doiUrl = publication.doi ? `https://doi.org/${publication.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : undefined;
  const summary = publication.abstract || `${publication.title} by ${publication.authorDisplay}, published in ${publication.journal.title}.`;
  const pages = publication.pages?.split(/[-–—]/).map((page) => page.trim()) || [];
  const openAccess = isOpenAccess(publication.licenseName);
  const articleType = publication.contentType === "research" ? "ScholarlyArticle" : "Article";
  const typeLabel = publication.contentType === "research" ? "Research article" : publication.contentType === "creative" ? "Creative work" : "Commentary";
  const hasPdf = isPdfUrl(publication.pdfUrl);
  const articleSchema: Record<string, unknown> = { "@type": articleType, "@id": absoluteUrl(`/publications/${publication.slug}#article`), headline: publication.title, description: summary, abstract: publication.abstract || undefined, datePublished: publication.publicationDate, dateModified: publication.modifiedDate, inLanguage: SITE_LANGUAGE, url: absoluteUrl(`/publications/${publication.slug}`), mainEntityOfPage: absoluteUrl(`/publications/${publication.slug}`), sameAs: doiUrl, identifier: publication.doi ? { "@type": "PropertyValue", propertyID: "DOI", value: publication.doi } : undefined, author: publication.authors.map((author) => ({ "@type": "Person", name: author.name, url: absoluteUrl(`/authors/${author.slug}`), sameAs: author.orcid ? `https://orcid.org/${author.orcid.replace(/^https?:\/\/orcid\.org\//, "")}` : undefined })), publisher: { "@type": "Organization", "@id": absoluteUrl("/#organization"), name: SITE_NAME }, isPartOf: { "@type": "PublicationVolume", volumeNumber: publication.volume, isPartOf: { "@type": "Periodical", name: publication.journal.title, issn: publication.journal.issn || undefined, url: absoluteUrl(`/journals/${publication.journal.slug}`) } }, issueNumber: publication.issue, pagination: publication.pages, pageStart: pages[0] || undefined, pageEnd: pages[1] || undefined, keywords: publication.keywords.join(", "), about: publication.keywords.map((kw) => ({ "@type": "Thing", name: kw })), license: publication.licenseUrl || undefined, isAccessibleForFree: openAccess, copyrightHolder: { "@type": "Organization", name: publication.copyrightHolder }, associatedMedia: hasPdf ? { "@type": "MediaObject", contentUrl: publication.pdfUrl, encodingFormat: "application/pdf" } : undefined };
  const embeddablePdf = isEmbeddablePdf(publication.pdfUrl);
  const readerSrc = publication.pdfUrl ? `${publication.pdfUrl}${publication.pdfUrl.includes("?") ? "&" : "?"}embed=1` : "";
  const demoReader = process.env.DEMO_CONTENT_ENABLED === "true";
  return (
    <main id="main-content" className="publication-detail-page">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        articleSchema,
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Publications", item: absoluteUrl("/publications") }, { "@type": "ListItem", position: 3, name: publication.title, item: absoluteUrl(`/publications/${publication.slug}`) }] }
      ] }} />

      <PublicationViewTracker slug={publication.slug} />
      <article>
        <header className={`publication-detail-hero publication-detail-hero-${publication.journal.slug}`}>
          <div className="section-shell publication-detail-hero-grid">
            <div className="publication-detail-hero-copy">
              <nav className="publication-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/publications">Publications</Link><span aria-hidden="true">/</span><Link href={`/journals/${publication.journal.slug}`}>{publication.journal.title}</Link></nav>
              <p className="publication-detail-type">{typeLabel}</p>
              {openAccess && <div className="pub-badges-row"><OpenAccessBadge licenseName={publication.licenseName} /></div>}
              <h1>{publication.title}</h1>
              <div className="publication-detail-record-line"><span>{typeLabel}</span><i aria-hidden="true"/><time dateTime={publication.publicationDate}>Published {displayDate}</time></div>
              {(publication.volume || publication.issue || publication.pages) && <p className="publication-detail-pages">{publication.volume ? `Vol. ${publication.volume}` : ""}{publication.issue ? `${publication.volume ? ", " : ""}No. ${publication.issue}` : ""}{publication.pages ? `${publication.volume || publication.issue ? " · " : ""}pp. ${publication.pages}` : ""}</p>}
              <p className="publication-detail-byline">{publication.authors.length ? publication.authors.map((author, index) => <span key={author.id}>{index > 0 && ", "}<Link href={`/authors/${author.slug}`}>{author.name}</Link></span>) : publication.authorDisplay}</p>
            </div>
            <aside className="publication-detail-folio" aria-label="Journal summary"><Link href={`/journals/${publication.journal.slug}`} className="publication-detail-folio-image"><Image src={publication.journal.heroImage} alt="" fill priority sizes="220px" /></Link><p>Published in</p><Link href={`/journals/${publication.journal.slug}`}>{publication.journal.title}</Link>{(publication.volume || publication.issue) && <span>{publication.volume ? `Volume ${publication.volume}` : ""}{publication.issue ? `${publication.volume ? " · " : ""}Issue ${publication.issue}` : ""}</span>}</aside>
          </div>
        </header>

        <div className="section-shell publication-detail-layout">
          <div className="publication-detail-main">
            <section className="publication-abstract-panel article-prose">
              <p className="eyebrow">{publication.abstract ? "Abstract" : "Publication note"}</p>
              {publication.abstract ? <p className="article-abstract">{publication.abstract}</p> : <p className="article-abstract">This historical record does not include an abstract. Use the DOI and recommended citation to access and identify the complete work.</p>}
            </section>
            {embeddablePdf ? <PublicationPdfReader src={readerSrc} title={publication.title} /> : demoReader ? <DemoPublicationPdfReader title={publication.title} /> : null}
          </div>
          <aside className="publication-detail-sidebar">
            <section className="publication-access-panel publication-activity-panel"><div className="publication-activity-heading"><span className="publication-activity-icon"><Icon name="eye" className="h-4 w-4" /></span><span className="publication-activity-label">Publication reach</span></div><div className="publication-activity-metrics" aria-label="Publication analytics"><div><span>Views</span><strong>{publication.views.toLocaleString("en-PH")}</strong><small>all time</small></div><div><span>Downloads</span><strong>{publication.downloads.toLocaleString("en-PH")}</strong><small>all time</small></div></div><div className="publication-activity-action">{publication.pdfUrl ? <a href={publication.pdfUrl} target="_blank" rel="noopener noreferrer"><Icon name="file" className="h-4 w-4" /> Download publication</a> : <p>The full-text PDF for this record is not available yet.</p>}</div></section>
            <section className="article-rights-panel"><div className="publication-panel-heading">Rights and reuse</div><div className="rights-row"><span>License</span>{publication.licenseUrl ? <a href={publication.licenseUrl} target="_blank" rel="noopener noreferrer"><strong>{publication.licenseName}</strong></a> : <strong>{publication.licenseName}</strong>}{openAccess && <div className="pub-badges-row" style={{marginTop:"6px"}}><OpenAccessBadge licenseName={publication.licenseName} /></div>}</div><div className="rights-row"><span>Publisher</span><strong>{SITE_NAME}</strong></div></section>
          </aside>
        </div>
        <section className="publication-about-section"><div className="section-shell"><header><p className="eyebrow">About this publication</p><h2>Publication record and citation</h2></header><div className="publication-about-grid"><div className="publication-about-mark" aria-hidden="true"><Icon name="book" className="h-8 w-8" /></div><div className="publication-about-content"><div className="publication-about-citation"><p className="eyebrow">Cite this publication</p><CitationPanel publication={publication} /><ShareButtons title={publication.title} abstract={publication.abstract} /></div><dl className="publication-about-facts"><div><dt>DOI</dt><dd>{doiUrl ? <a href={doiUrl} target="_blank" rel="noopener noreferrer">{publication.doi}</a> : "Not listed"}</dd></div><div><dt>Published</dt><dd><time dateTime={publication.publicationDate}>{displayDate}</time></dd></div><div><dt>Journal</dt><dd><Link href={`/journals/${publication.journal.slug}`}>{publication.journal.title}</Link></dd></div><div><dt>Rights</dt><dd>{publication.licenseUrl ? <a href={publication.licenseUrl} target="_blank" rel="noopener noreferrer">{publication.licenseName}</a> : publication.licenseName}</dd></div></dl>{publication.keywords.length > 0 && <div className="publication-about-keywords"><h3>Keywords</h3><div>{publication.keywords.map((keyword) => <Link href={`/search?q=${encodeURIComponent(keyword)}`} key={keyword}>{keyword}</Link>)}</div></div>}</div></div></div></section>
      </article>

      {related.length > 0 && <section className="publication-related"><div className="section-shell"><div className="publication-related-heading"><div><p className="eyebrow">Continue reading</p><h2>More from {publication.journal.title}</h2></div></div><RelatedPublicationsCarousel publications={related} /></div></section>}
    </main>
  );
}
