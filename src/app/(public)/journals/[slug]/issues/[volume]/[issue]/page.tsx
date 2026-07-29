import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { getJournal, getJournalIssues, getJournals, getPublications } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 300;

const SAMPLE_TOPICS = [
  "Community knowledge and the shape of public learning",
  "Reading practices in multilingual classrooms",
  "Designing evidence for local decision-making",
  "Care, access, and the everyday university",
  "Digital archives as living teaching spaces",
  "Language policy beyond the official document",
  "Small-scale inquiry and institutional change",
  "What students carry between home and school",
  "The civic life of open educational resources",
  "Remembering place through community records",
];

const SAMPLE_ARTICLES = Array.from({ length: 50 }, (_, index) => ({
  id: `layout-sample-${index + 1}`,
  title: `Sample article ${String(index + 1).padStart(2, "0")}: ${SAMPLE_TOPICS[index % SAMPLE_TOPICS.length]}`,
  authorDisplay: `Layout sample author ${String(index + 1).padStart(2, "0")}`,
  pages: `${index * 8 + 1}-${index * 8 + 7}`,
  slug: "",
}));

export async function generateStaticParams() {
  const journals = await getJournals();
  const params = [];
  for (const journal of journals) {
    const issues = await getJournalIssues(journal.id, journal.slug);
    for (const issue of issues.filter((item) => item.status === "published")) params.push({ slug: journal.slug, volume: issue.volume, issue: issue.issue });
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; volume: string; issue: string }> }): Promise<Metadata> {
  const { slug, volume, issue } = await params;
  const journal = await getJournal(slug);
  if (!journal) return {};
  return { title: `${journal.title} · Volume ${volume}, Issue ${issue}`, description: `Table of contents for ${journal.title}, Volume ${volume}, Issue ${issue}.` };
}

export default async function JournalIssuePage({ params, searchParams }: { params: Promise<{ slug: string; volume: string; issue: string }>; searchParams: Promise<{ sample?: string }> }) {
  const { slug, volume, issue: issueNumber } = await params;
  const { sample } = await searchParams;
  const journal = await getJournal(slug);
  if (!journal) notFound();
  const [issues, publications] = await Promise.all([getJournalIssues(journal.id, journal.slug), getPublications()]);
  const issue = issues.find((item) => item.volume === volume && item.issue === issueNumber && item.status === "published");
  if (!issue) notFound();
  const articles = publications
    .filter((publication) => publication.journal.slug === journal.slug && ((publication.issueId && publication.issueId === issue.id) || (!publication.issueId && publication.volume === volume && publication.issue === issueNumber)))
    .sort((a, b) => (Number(a.pages?.split("-")[0]) || Number.MAX_SAFE_INTEGER) - (Number(b.pages?.split("-")[0]) || Number.MAX_SAFE_INTEGER));
  const sampleSize = Math.min(50, Math.max(0, Number(sample) || 0));
  const isSample = articles.length === 0 && sampleSize > 0;
  const displayArticles = isSample ? SAMPLE_ARTICLES.slice(0, sampleSize) : articles;
  const issueUrl = `/journals/${journal.slug}/issues/${volume}/${issueNumber}`;
  const issueIndex = issues.findIndex((item) => item.volume === volume && item.issue === issueNumber);
  const previousIssue = issueIndex > 0 ? issues[issueIndex - 1] : null;
  const nextIssue = issueIndex >= 0 && issueIndex < issues.length - 1 ? issues[issueIndex + 1] : null;
  const firstPage = displayArticles[0]?.pages?.split("-")[0] || "—";
  const lastPage = displayArticles.at(-1)?.pages?.split("-").at(-1) || "—";
  const pageSpan = displayArticles.length && (firstPage !== "—" || lastPage !== "—") ? `${firstPage}–${lastPage}` : "—";

  return (
    <main id="main-content" className="journal-issue-page">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "PublicationIssue", "@id": absoluteUrl(`${issueUrl}#issue`), name: `${journal.title} Volume ${volume}, Issue ${issueNumber}`, isPartOf: { "@type": "Periodical", name: journal.title, url: absoluteUrl(`/journals/${journal.slug}`) }, datePublished: issue.publicationDate || undefined, issueNumber, volumeNumber: volume, hasPart: articles.map((article) => ({ "@type": "ScholarlyArticle", name: article.title, url: absoluteUrl(`/publications/${article.slug}`) })) }} />
      <div className="section-shell journal-issue-shell">
        <nav className="journal-breadcrumb" aria-label="Breadcrumb"><Link href="/journals">Journals</Link><span aria-hidden="true">›</span><Link href={`/journals/${journal.slug}`}>{journal.title}</Link><span aria-hidden="true">›</span><span>Volume {volume}, Issue {issueNumber}</span></nav>

        <header className="journal-issue-hero">
          <div className="journal-issue-cover-wrap"><div className="journal-issue-cover">{issue.cover ? <Image src={issue.cover} alt={`${journal.title} Volume ${volume} Issue ${issueNumber} cover`} fill priority sizes="(max-width: 760px) 72vw, 300px" /> : <div className="journal-issue-cover-fallback"><span>{journal.title.slice(0, 2).toUpperCase()}</span><strong>{journal.title}</strong><small>Volume {volume} · Issue {issueNumber}</small></div>}</div><span className="journal-issue-cover-caption">{journal.title} · Vol. {volume}, No. {issueNumber}</span></div>
          <div className="journal-issue-intro">
            <p className="journal-issue-kicker">{journal.title} / Issue archive</p>
            <h1>Volume {volume},<br /><em>Issue {issueNumber}</em></h1>
            <p className="journal-issue-lede">A published issue of {journal.title}, gathered for browsing, citation, and sustained reading.</p>
            <div className="journal-issue-meta"><span>Published {issue.publicationDate || "—"}</span><span>{displayArticles.length} {isSample ? "sample entries" : `article${displayArticles.length === 1 ? "" : "s"}`}</span></div>
            <div className="journal-issue-actions"><Link href={`/journals/${journal.slug}`} className="journal-issue-back"><Icon name="arrow" className="h-4 w-4" /> Back to journal</Link>{previousIssue ? <Link href={`/journals/${journal.slug}/issues/${previousIssue.volume}/${previousIssue.issue}`} className="journal-issue-nav">Previous issue</Link> : null}{nextIssue ? <Link href={`/journals/${journal.slug}/issues/${nextIssue.volume}/${nextIssue.issue}`} className="journal-issue-nav">Next issue</Link> : null}</div>
          </div>
          <aside className="journal-issue-facts" aria-label="Issue facts"><span>Issue record</span><strong>Vol. {volume} · No. {issueNumber}</strong><dl><div><dt>Published</dt><dd>{issue.publicationDate || "—"}</dd></div><div><dt>Contents</dt><dd>{displayArticles.length || 0}</dd></div><div><dt>Page span</dt><dd>{pageSpan}</dd></div></dl><Link href={`/journals/${journal.slug}`}><span>Explore {journal.title}</span><Icon name="arrow" className="h-4 w-4" /></Link></aside>
        </header>

        <section className="journal-issue-toc" aria-labelledby="issue-toc-heading">
          <div className="journal-issue-toc-heading"><div><p className="journal-issue-kicker">Table of contents</p><h2 id="issue-toc-heading">The issue at a glance</h2></div><p>{isSample ? "Layout sample · 50 entries" : `${displayArticles.length} published article${displayArticles.length === 1 ? "" : "s"}`}</p></div>
          {isSample ? <div className="journal-issue-sample-note" role="note"><strong>Layout sample</strong><span>This 50-entry view demonstrates how a full issue reads. It is not published content and does not change the issue record.</span><Link href={issueUrl}>Show live issue</Link></div> : null}
          {displayArticles.length ? <ol className="journal-issue-toc-list">{displayArticles.map((article, index) => <li className="journal-issue-toc-item" key={article.id}><span className="journal-issue-index">{String(index + 1).padStart(2, "0")}</span><span className="journal-issue-page-number">{article.pages || "—"}</span><div><h3>{article.slug ? <Link href={`/publications/${article.slug}`}>{article.title}</Link> : <span>{article.title}</span>}</h3><p className="journal-issue-author">{article.authorDisplay}</p></div><Icon name="arrow" className="journal-issue-item-arrow h-4 w-4" /></li>)}</ol> : <div className="journal-issue-empty"><p>No published articles have been linked to this issue yet.</p><Link href={`${issueUrl}?sample=50`}>View 50-entry layout sample <Icon name="arrow" className="h-4 w-4" /></Link></div>}
        </section>
      </div>
    </main>
  );
}
