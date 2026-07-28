import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { SearchInterface } from "@/components/search-interface";
import { getAuthors, getJournals } from "@/lib/content";
import { SITE_NAME, SITE_SHORT_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Search", description: `Search the ${SITE_NAME} publication archive by title, author, journal, DOI, or keyword.`, robots: { index: false, follow: true } };

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

export default async function SearchPage() {
  const [journals, authors] = await Promise.all([getJournals(), getAuthors()]);
  return <main id="main-content">
    <section className="listing-hero border-b border-forest-900/10 bg-white"><div className="section-shell py-16"><p className="eyebrow">Discovery</p><h1 className="display-title mt-3 max-w-4xl text-5xl font-bold text-forest-900">Search the {SITE_SHORT_NAME} archive.</h1><p className="mt-4 max-w-2xl leading-8 text-gray-600">Find publications by title, author, journal, keyword, or DOI. Filter by journal, year, type, or keyword.</p></div></section>
    <section className="section-shell py-10"><SearchInterface /></section>
    <section className="search-directory-band"><div className="section-shell py-14"><div className="search-section-heading"><div><p>Journal directory</p><h2>Choose a publishing programme</h2></div><span>{journals.length}</span></div><div className="search-journals-grid">{journals.map((journal) => <article key={journal.id} className="search-journal-card"><div><span>{journal.scope || "Publishing programme"}</span><h3><Link href={`/journals/${journal.slug}`}>{journal.title}</Link></h3><p>{journal.description}</p></div><dl><div><dt>ISSN</dt><dd>{journal.issn || "Not listed"}</dd></div><div><dt>Focus</dt><dd>{journal.scope || "Editorial programme"}</dd></div></dl><Link className="search-panel-link" href={`/journals/${journal.slug}`}>Explore journal <Icon name="arrow" className="h-3.5 w-3.5" /></Link></article>)}</div></div></section>
    <section className="section-shell py-14"><div className="search-section-heading"><div><p>Contributor directory</p><h2>Meet the authors</h2></div><span>{authors.length}</span></div><div className="search-authors-grid">{authors.slice(0, 6).map((author) => <article key={author.id} className="search-author-card"><span className="search-author-initials">{initials(author.name)}</span><div><h3><Link href={`/authors/${author.slug}`}>{author.name}</Link></h3><p>{author.affiliation || author.credentials || "Contributor profile"}</p></div><span className="search-author-count"><strong>Profile</strong><span>View record</span></span><Link className="search-author-link" href={`/authors/${author.slug}`} aria-label={`View ${author.name}'s profile`}><Icon name="arrow" className="h-3.5 w-3.5" /></Link></article>)}</div><Link className="search-panel-link mt-6" href="/authors">Browse all contributors <Icon name="arrow" className="h-3.5 w-3.5" /></Link></section>
  </main>;
}
