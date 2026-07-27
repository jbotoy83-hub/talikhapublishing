import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { getJournal, getJournalIssues, getJournals, getPublications } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 300;

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

export default async function JournalIssuePage({ params }: { params: Promise<{ slug: string; volume: string; issue: string }> }) {
  const { slug, volume, issue: issueNumber } = await params;
  const journal = await getJournal(slug);
  if (!journal) notFound();
  const [issues, publications] = await Promise.all([getJournalIssues(journal.id, journal.slug), getPublications()]);
  const issue = issues.find((item) => item.volume === volume && item.issue === issueNumber && item.status === "published");
  if (!issue) notFound();
  const articles = publications
    .filter((publication) => publication.journal.slug === journal.slug && publication.volume === volume && publication.issue === issueNumber)
    .sort((a, b) => (Number(a.pages?.split("-")[0]) || Number.MAX_SAFE_INTEGER) - (Number(b.pages?.split("-")[0]) || Number.MAX_SAFE_INTEGER));
  const issueUrl = `/journals/${journal.slug}/issues/${volume}/${issueNumber}`;

  return (
    <main id="main-content" className="journal-issue-page">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "PublicationIssue", "@id": absoluteUrl(`${issueUrl}#issue`), name: `${journal.title} Volume ${volume}, Issue ${issueNumber}`, isPartOf: { "@type": "Periodical", name: journal.title, url: absoluteUrl(`/journals/${journal.slug}`) }, datePublished: issue.publicationDate || undefined, issueNumber, volumeNumber: volume, hasPart: articles.map((article) => ({ "@type": "ScholarlyArticle", name: article.title, url: absoluteUrl(`/publications/${article.slug}`) })) }} />
      <div className="section-shell journal-issue-shell">
        <nav className="journal-breadcrumb" aria-label="Breadcrumb"><Link href="/journals">Journals</Link><span aria-hidden="true">›</span><Link href={`/journals/${journal.slug}`}>{journal.title}</Link><span aria-hidden="true">›</span><span>Volume {volume}, Issue {issueNumber}</span></nav>
        <header className="journal-issue-head">
          <div className="journal-issue-cover">{issue.cover ? <Image src={issue.cover} alt={`${journal.title} Volume ${volume} Issue ${issueNumber} cover`} fill priority sizes="(max-width: 760px) 80vw, 280px" /> : <span>{journal.title.slice(0, 2).toUpperCase()}</span>}</div>
          <div>
            <p className="journal-publisher-overline">{journal.title}</p>
            <h1>Volume {volume}, Issue {issueNumber}</h1>
            <p className="journal-issue-date">Published {issue.publicationDate || "—"}</p>
            <p>This issue’s table of contents contains published articles linked to this journal issue.</p>
            <Link href={`/journals/${journal.slug}`} className="journal-issue-back"><Icon name="arrow" className="h-4 w-4" /> Back to journal</Link>
          </div>
        </header>
        <section className="journal-issue-toc" aria-labelledby="issue-toc-heading">
          <div className="journal-section-heading"><div><p className="journal-publisher-overline">Table of contents</p><h2 id="issue-toc-heading">Published articles</h2></div><span>{articles.length} article{articles.length === 1 ? "" : "s"}</span></div>
          {articles.length ? <ol>{articles.map((article) => <li key={article.id}><span>{article.pages || "—"}</span><div><h3><Link href={`/publications/${article.slug}`}>{article.title}</Link></h3><p>{article.authorDisplay}</p></div><Icon name="arrow" className="h-4 w-4" /></li>)}</ol> : <p className="journal-issue-empty">No published articles have been linked to this issue yet.</p>}
        </section>
      </div>
    </main>
  );
}
