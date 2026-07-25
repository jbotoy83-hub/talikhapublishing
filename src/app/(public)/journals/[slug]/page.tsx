import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { getCurrentIssueForJournal, getJournal, getJournalIssues, getJournals, getPublications } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";
import { archiveIssueLabel, comparePublicationsNewestFirst, formatPublicationDate, getJournalPresentation, groupJournalArchive } from "@/lib/journal-presentation";
import type { Publication } from "@/lib/types";

export const revalidate = 300;
const PAGE_SIZE = 24;

const JournalArchive = dynamic(() => import("@/components/journal-archive").then((mod) => ({ default: mod.JournalArchive })));

export async function generateStaticParams() {
  return (await getJournals()).map((journal) => ({ slug: journal.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const journal = await getJournal(slug);
  if (!journal) return {};
  const title = `${journal.title} Journal`;
  const description = `${journal.description} Browse its verified scope, volumes, issues, and published work.`;
  return {
    title,
    description,
    alternates: { canonical: `/journals/${journal.slug}` },
    openGraph: { type: "website", title, description, url: `/journals/${journal.slug}`, images: [{ url: journal.heroImage, alt: `${journal.title} journal` }] }
  };
}

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function initials(name: string) {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function publicationHref(publication: Publication) {
  return `/publications/${publication.slug}`;
}

export default async function JournalPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const query = await searchParams;
  const [journal, publications] = await Promise.all([getJournal(slug), getPublications()]);
  if (!journal) notFound();

  const journalPublications = publications.filter((publication) => publication.journal.id === journal.id).sort(comparePublicationsNewestFirst);
  const presentation = getJournalPresentation(journal);
  const volumes = groupJournalArchive(journalPublications);
  const latest = journalPublications[0];
  const curIssue = getCurrentIssueForJournal(journal.id);
  const cycleIssues = getJournalIssues(journal.id).filter((i) => i.status === "published" || i.status === "open" || i.status === "scheduled");
  const featured = journalPublications.slice(0, 3);
  const search = queryValue(query.q).trim();
  const volume = queryValue(query.volume);
  const issue = queryValue(query.issue);
  const normalizedSearch = search.toLocaleLowerCase();
  const filtered = journalPublications.filter((publication) => {
    if (volume && (publication.volume || "Unassigned") !== volume) return false;
    if (issue && (publication.issue || "Unassigned") !== issue) return false;
    if (!normalizedSearch) return true;
    return [publication.title, publication.authorDisplay, publication.abstract, publication.keywords.join(" ")].join(" ").toLocaleLowerCase().includes(normalizedSearch);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(queryValue(query.page), 10) || 1;
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const visiblePublications = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const themeClass = journal.slug === "echoes-of-expression" ? "journal-theme-echoes-of-expression" : journal.slug === "visionary-voices" ? "journal-theme-visionary-voices" : "";

  return (
    <main id="main-content" className={`journal-publisher-page ${themeClass}`}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Periodical",
            "@id": absoluteUrl(`/journals/${journal.slug}#journal`),
            name: journal.title,
            description: journal.description,
            issn: journal.issn || undefined,
            url: absoluteUrl(`/journals/${journal.slug}`),
            image: absoluteUrl(journal.heroImage),
            publisher: { "@id": absoluteUrl("/#organization") },
            hasPart: visiblePublications.map((publication) => ({ "@type": "ScholarlyArticle", "@id": absoluteUrl(`/publications/${publication.slug}#article`), name: publication.title, url: absoluteUrl(`/publications/${publication.slug}`) }))
          },
          { "@type": "ItemList", "@id": absoluteUrl(`/journals/${journal.slug}#publication-list`), numberOfItems: filtered.length, itemListElement: visiblePublications.map((publication, index) => ({ "@type": "ListItem", position: (page - 1) * PAGE_SIZE + index + 1, url: absoluteUrl(`/publications/${publication.slug}`), name: publication.title })) },
          { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Journals", item: absoluteUrl("/journals") }, { "@type": "ListItem", position: 3, name: journal.title, item: absoluteUrl(`/journals/${journal.slug}`) }] }
        ]
      }} />

      <section className="journal-publisher-hero">
        <Image src={journal.heroImage} alt={`${journal.title} journal`} fill priority sizes="100vw" className="journal-publisher-hero-image" />
        <div className="journal-publisher-hero-wash" />
        <div className="section-shell journal-publisher-hero-inner">
          <nav className="journal-breadcrumb" aria-label="Breadcrumb"><Link href="/journals">Journals</Link><span aria-hidden="true">›</span><span>{journal.title}</span></nav>
          <div className="journal-publisher-hero-grid">
            <div className="journal-publisher-masthead">
              <p>{presentation.type}</p>
              <h1>{journal.title}</h1>
              <strong>{journal.description}</strong>
              <div className="journal-publisher-themes">{presentation.themes.map((theme) => <span key={theme}>{theme}</span>)}</div>
              <div className="journal-publisher-actions"><Link href={`/submit?journal=${journal.slug}`}>Submit to this journal <Icon name="arrow" className="h-4 w-4" /></Link><a href="#archive">Browse publications</a></div>
            </div>
            <aside className="journal-current-issue">
              <p>Current archive record</p><h2>{curIssue ? "Vol. " + curIssue.volume + ", No. " + curIssue.issue + (curIssue.title ? " · " + curIssue.title : "") : archiveIssueLabel(latest)}</h2>
              <dl><div><dt>Publication schedule</dt><dd>{presentation.cadence}</dd></div><div><dt>Published works</dt><dd>{journalPublications.length.toLocaleString("en-US")}</dd></div><div><dt>Available volumes</dt><dd>{volumes.length}</dd></div></dl>
              <a href="#archive">View current publications <Icon name="arrow" className="h-4 w-4" /></a>
              <p>{cycleIssues.length ? "Issues in cycle: " + cycleIssues.map((i) => "Vol. " + i.volume + " No. " + i.issue + (i.isCurrent ? " (current)" : "")).join(", ") : "No issues in cycle yet."}</p>
            </aside>
          </div>
        </div>
      </section>

      <nav className="journal-local-nav" aria-label={`${journal.title} sections`}><div className="section-shell"><a href="#about">About</a><a href="#featured">Featured publications</a><a href="#archive">Publication archive</a><a href="#discovery">Discovery and indexing</a></div></nav>

      <section className="journal-publisher-content">
        <div className="section-shell">
          <section className="journal-recognition-section" id="featured">
            <div className="journal-section-heading"><div><p className="journal-publisher-overline">From this journal</p><h2>Featured publications</h2></div><p>A current selection from the verified publication archive. No readership ranking is implied.</p></div>
            {featured.length ? <div className="journal-recognition-layout"><div className="journal-recognition-primary-grid">
              {featured.map((publication, index) => <article className={`journal-recognition-card ${index === 0 ? "is-featured" : ""}`} key={publication.id}>
                <Link href={publicationHref(publication)} className="journal-recognition-image" aria-label={`Read ${publication.title}`}><Image src={journal.heroImage} alt="" fill sizes="(max-width: 720px) 100vw, 33vw" /><span className="journal-recognition-ribbon">Featured · {String(index + 1).padStart(2, "0")}</span></Link>
                <div className="journal-recognition-copy"><div className="journal-recognition-meta"><span>{publication.contentType}</span>{publication.volume && <span>Vol. {publication.volume}{publication.issue ? `, No. ${publication.issue}` : ""}</span>}{publication.doi && <span>DOI supplied</span>}</div><h3><Link href={publicationHref(publication)}>{publication.title}</Link></h3>{publication.abstract && <p>{publication.abstract}</p>}<div className="journal-recognition-authors"><small>Authors</small><div>{publication.authors.length ? publication.authors.map((author) => <Link href={`/authors/${author.slug}`} key={author.id}><span>{initials(author.name)}</span><strong>{author.name}</strong></Link>) : <strong>{publication.authorDisplay}</strong>}</div></div><div className="journal-recognition-record"><span>{journal.title}{publication.volume ? `, Vol. ${publication.volume}` : ""}{publication.issue ? `, No. ${publication.issue}` : ""}</span><time dateTime={publication.publicationDate}>{formatPublicationDate(publication)}</time></div><Link href={publicationHref(publication)} className="journal-recognition-action">Read publication <Icon name="arrow" className="h-4 w-4" /></Link></div>
              </article>)}
            </div></div> : <p className="journal-empty-state">Draft archive: featured records will appear after verified publications are supplied.</p>}
          </section>

          <div className="journal-publisher-layout journal-archive-about-layout" id="about">
            <aside className="journal-identity-rail"><div><p className="journal-publisher-overline">About this journal</p><h2>Aims and scope</h2><p>{journal.scope}</p></div><dl><div><dt>Journal</dt><dd>{journal.title}</dd></div><div><dt>Editorial focus</dt><dd>{presentation.type}</dd></div><div><dt>Frequency</dt><dd>{presentation.cadence}</dd></div>{journal.issn && <div><dt>ISSN</dt><dd>{journal.issn}</dd></div>}</dl><div className="journal-rail-actions"><Link href={`/submit?journal=${journal.slug}`}>Submit your work <Icon name="arrow" className="h-4 w-4" /></Link><Link href="/editorial-standards">Editorial standards</Link><Link href="/journals">All journals</Link></div></aside>
            <section className="journal-archive-panel" id="archive">
              <div className="journal-section-heading"><div><p className="journal-publisher-overline">Publication archive</p><h2>Latest from {journal.title}</h2></div><p>Search this journal or narrow its verified records by volume and issue.</p></div>
              <JournalArchive journal={journal} publications={journalPublications} initialSearch={search} initialVolume={volume} initialIssue={issue} initialPage={page} />
            </section>
          </div>
        </div>
      </section>

      <section className="journal-discovery-index" id="discovery"><div className="section-shell"><div className="journal-discovery-heading"><div><p className="journal-publisher-overline">Discovery and indexing</p><h2>Structured for scholarly discovery.</h2></div><p>These describe the journal’s current metadata and discovery support. They are not claims of automatic inclusion in an external index.</p></div><div className="journal-discovery-grid"><article><span><Icon name="search" className="h-4 w-4" /></span><div><h3>Google Scholar</h3><p>Crawler-readable article pages and scholarly metadata support discovery.</p></div></article><article><span><Icon name="external" className="h-4 w-4" /></span><div><h3>DOI metadata</h3><p>Persistent identifiers are displayed when supplied in a verified publication record.</p></div></article><article><span><Icon name="users" className="h-4 w-4" /></span><div><h3>ORCID</h3><p>Contributor identifiers are linked when authors provide a verified ORCID iD.</p></div></article><article><span><Icon name="book" className="h-4 w-4" /></span><div><h3>Journal archive</h3><p>Records can be browsed by journal, author, volume, issue, and topic.</p></div></article></div><p className="journal-indexing-note">Index coverage is determined independently by each discovery service and may change as its crawlers and eligibility requirements are updated.</p></div></section>
    </main>
  );
}
