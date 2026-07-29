import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { getJournalArchiveEntries, getJournalIssues, getJournals, type JournalIssueSummary } from "@/lib/content";
import { getJournalPresentation, groupJournalArchive, type JournalVolumeGroup } from "@/lib/journal-presentation";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Journals, Volumes and Issues",
  description: `Browse ${SITE_NAME} journals, volumes, issues, ISSN records, and direct links to published work.`,
  alternates: { canonical: "/journals" },
  openGraph: {
    title: "Journals, Volumes and Issues",
    description: `Explore the complete ${SITE_NAME} journal catalogue and publication archive.`,
    url: "/journals",
    images: ["/assets/journal-academic-frontiers-hero.jpg"]
  }
};

export const revalidate = 300;

function mergeIssueRecords(volumes: JournalVolumeGroup[], issues: JournalIssueSummary[]): JournalVolumeGroup[] {
  const merged = new Map(volumes.map((volume) => [volume.volume, { ...volume, issues: [...volume.issues] }]));
  for (const issue of issues.filter((item) => item.status === "published")) {
    const volume = String(issue.volume);
    const issueNumber = String(issue.issue);
    const existingVolume = merged.get(volume) || { volume, issues: [], publicationCount: 0 };
    const existingIssue = existingVolume.issues.find((item) => item.issue === issueNumber);
    if (!existingIssue) {
      existingVolume.issues.push({ issue: issueNumber, publications: [], cover: issue.cover });
      existingVolume.issues.sort((a, b) => Number(b.issue) - Number(a.issue));
    } else if (!existingIssue.cover && issue.cover) existingIssue.cover = issue.cover;
    merged.set(volume, existingVolume);
  }
  return [...merged.values()].sort((a, b) => Number(b.volume) - Number(a.volume));
}

export default async function JournalsPage() {
  const [journals, archiveEntries] = await Promise.all([getJournals(), getJournalArchiveEntries()]);
  const issueRecords = await Promise.all(journals.map(async (journal) => [journal.id, await getJournalIssues(journal.id, journal.slug)] as const));
  const issueRecordsByJournal = new Map(issueRecords);
  const journalArchives = journals.map((journal) => {
    const journalPublications = archiveEntries.filter((publication) => publication.journalId === journal.id);
    return { journal, publications: journalPublications, volumes: mergeIssueRecords(groupJournalArchive(journalPublications), issueRecordsByJournal.get(journal.id) || []) };
  });
  const volumeCount = journalArchives.reduce((total, archive) => total + archive.volumes.length, 0);
  const issueCount = journalArchives.reduce((total, archive) => total + archive.volumes.reduce((sum, volume) => sum + volume.issues.length, 0), 0);

  const itemList = journals.map((journal, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Periodical",
      "@id": absoluteUrl(`/journals/${journal.slug}#journal`),
      name: journal.title,
      description: journal.description,
      url: absoluteUrl(`/journals/${journal.slug}`),
      issn: journal.issn || undefined
    }
  }));

  return (
    <main id="main-content" className="publication-catalogue-page">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "CollectionPage", "@id": absoluteUrl("/journals#catalogue"), name: `${SITE_NAME} journal catalogue`, description: metadata.description, url: absoluteUrl("/journals"), mainEntity: { "@id": absoluteUrl("/journals#journal-list") } },
          { "@type": "ItemList", "@id": absoluteUrl("/journals#journal-list"), numberOfItems: journals.length, itemListElement: itemList },
          { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Journals", item: absoluteUrl("/journals") }] }
        ]
      }} />

      <section className="catalogue-hero">
        <span className="catalogue-hero-orbit" aria-hidden="true" />
        <div className="section-shell catalogue-hero-grid">
          <div>
            <div className="page-eyebrow"><span><Icon name="book" className="h-4 w-4" /></span> Publication catalogue</div>
            <h1>Find the <em>right home</em><br />for your work.</h1>
            <p>Research, literature, and public ideas each belong to a distinct publishing programme. Explore our journals to review their editorial scope, publication schedule, available volumes, and published issues.</p>
            <div className="catalogue-hero-actions">
              <a href="#journal-directory">Browse journals <Icon name="arrow" className="h-4 w-4" /></a>
              <Link href="/search">Search publications <Icon name="search" className="h-4 w-4" /></Link>
            </div>
          </div>
          <aside aria-label="Catalogue summary">
            <span>Catalogue at a glance</span>
            <div><strong>{journals.length}</strong><p>Journals</p></div>
            <div><strong>{volumeCount}</strong><p>Published volumes</p></div>
            <div><strong>{issueCount}</strong><p>Published issues</p></div>
          </aside>
        </div>
      </section>

      <nav className="catalogue-directory-nav" aria-label="Journal directory">
        <div className="section-shell">
          {journalArchives.map(({ journal }, index) => <a href={`#${journal.slug}`} key={journal.id}>
            <span>0{index + 1}</span>
            <strong>{journal.title}</strong>
            <Icon name="arrow" className="h-4 w-4" />
          </a>)}
        </div>
      </nav>

      <section className="catalogue-overview" id="journal-directory">
        <div className="section-shell">
          <div className="catalogue-section-heading">
            <div><p className="eyebrow">Journal directory</p><h2>Choose a Journal. <strong>Discover Its Scope.</strong></h2></div>
          </div>
          <div className="catalogue-journal-grid">
            {journalArchives.map(({ journal, volumes }, index) => {
              const presentation = getJournalPresentation(journal);
              const issues = volumes.reduce((total, volume) => total + volume.issues.length, 0);
              return <article className={`catalogue-journal-card catalogue-reference-card ${index === 1 ? "catalogue-theme-2" : index === 2 ? "catalogue-theme-3" : ""}`} key={journal.id}>
                <a href={`#${journal.slug}`} className="catalogue-directory-image" aria-label={`Browse ${journal.title} issues`}><Image src={journal.heroImage} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" /><span>{presentation.type}</span></a>
                <div className="catalogue-directory-copy">
                  <small>Journal 0{index + 1}</small>
                  <h3>{journal.title}</h3>
                  <p>{journal.description}</p>
                  <ul className="catalogue-directory-themes" aria-label={`${journal.title} themes`}>{presentation.themes.map((theme) => <li key={theme}>{theme}</li>)}</ul>
                  <dl className="catalogue-directory-facts"><div><dt>Frequency</dt><dd>{presentation.cadence}</dd></div><div><dt>Archive</dt><dd>{volumes.length} volume{volumes.length === 1 ? "" : "s"} · {issues} issue{issues === 1 ? "" : "s"}</dd></div></dl>
                  <div className="catalogue-directory-actions"><a href={`#${journal.slug}`}>Browse issues <Icon name="arrow" className="h-4 w-4" /></a><Link href={`/journals/${journal.slug}`}>Journal home</Link></div>
                </div>
              </article>;
            })}
          </div>
        </div>
      </section>

      {journalArchives.map(({ journal, publications: records, volumes }, index) => {
        const presentation = getJournalPresentation(journal);
        const sectionClass = index === 1 ? "catalogue-theme-2" : index === 2 ? "catalogue-theme-3" : "";
        const style = { "--journal-image": `url(${journal.heroImage})` } as CSSProperties;
        return <section className={`catalogue-journal-section ${sectionClass}`} id={journal.slug} key={journal.id}>
          <div className="section-shell">
            <div className="catalogue-journal-heading" style={style}>
              <figure className="catalogue-journal-visual"><Image src={journal.heroImage} alt="" fill sizes="260px" /><figcaption>Journal 0{index + 1}</figcaption></figure>
              <div className="catalogue-journal-copy">
                <p className="eyebrow"><span>0{index + 1}</span> {presentation.type}</p>
                <h2>{journal.title}</h2>
                <p>{journal.description}</p>
                <p className="catalogue-journal-type">{presentation.cadence} publication schedule</p>
                <div className="catalogue-journal-facts"><span><strong>{records.length.toLocaleString("en-US")}</strong> published works</span><span><strong>{volumes.length}</strong> volume{volumes.length === 1 ? "" : "s"}</span>{journal.issn && <span><strong>ISSN</strong> {journal.issn}</span>}</div>
              </div>
              <Link href={`/journals/${journal.slug}`}>Visit journal <Icon name="arrow" className="h-4 w-4" /></Link>
            </div>
            <div className="catalogue-volume-list catalogue-journal-archive">
              {volumes.map((volume, volumeIndex) => <details className="catalogue-volume" open={volumeIndex === 0} key={volume.volume}>
                <summary><span><b>{volume.volume === "Unassigned" ? "—" : volume.volume}</b><span><small>Volume</small><strong>{volume.volume === "Unassigned" ? "Metadata pending" : `Volume ${volume.volume}`}</strong></span></span><span>{volume.publicationCount.toLocaleString("en-US")} publication{volume.publicationCount === 1 ? "" : "s"} <Icon name="chevron" className="h-4 w-4" /></span></summary>
                <div className="catalogue-issue-grid">
                  {volume.issues.map((issue) => <Link className={`catalogue-cover-slot catalogue-cover-${journal.slug}`} href={`/journals/${journal.slug}/issues/${encodeURIComponent(volume.volume)}/${encodeURIComponent(issue.issue)}`} key={issue.issue}>
                    <div className="catalogue-cover-art">{issue.cover ? <Image src={issue.cover} alt={`${journal.title} Volume ${volume.volume} Issue ${issue.issue} cover`} fill sizes="(max-width: 760px) 45vw, 220px" /> : <><span className="catalogue-cover-mark">{presentation.initials}</span><span className="catalogue-cover-rule" /><div><small>{journal.title}</small><strong>Issue {issue.issue === "Unassigned" ? "—" : issue.issue}</strong></div><p>Volume {volume.volume === "Unassigned" ? "—" : volume.volume}</p></>}</div>
                    <div className="catalogue-cover-meta"><span>Issue {issue.issue === "Unassigned" ? "metadata pending" : issue.issue}</span><small>{issue.publications.length.toLocaleString("en-US")} publication{issue.publications.length === 1 ? "" : "s"}</small></div>
                  </Link>)}
                </div>
              </details>)}
              {!volumes.length && <p className="journal-empty-state">Draft archive: verified volume and issue records have not yet been supplied.</p>}
            </div>
          </div>
        </section>;
      })}

      <section className="catalogue-search">
        <div className="section-shell"><div><span><Icon name="search" /></span><div><p className="eyebrow">Publication search</p><h2>Looking for a specific study, author, volume, or issue?</h2></div></div><Link href="/search">Search the archive <Icon name="arrow" className="h-4 w-4" /></Link></div>
      </section>
    </main>
  );
}
