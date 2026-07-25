import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authorInitials } from "@/lib/author-display";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { PublicationCard } from "@/components/publication-card";
import { getAuthor, getAuthorPublications } from "@/lib/content";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) return {};
  const description = author.bio || `${author.name} is a contributor to the ${SITE_NAME} archive.`;
  return {
    title: author.name,
    description,
    alternates: { canonical: `/authors/${author.slug}` },
    openGraph: { type: "profile", title: author.name, description, url: `/authors/${author.slug}`, images: author.imageUrl ? [author.imageUrl] : undefined }
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) notFound();
  const publications = await getAuthorPublications(author.id);
  const journals = [...new Map(publications.map((publication) => [publication.journal.id, publication.journal])).values()];
  const primaryJournal = journals[0];
  const latestYear = publications.map((publication) => publication.publicationDate.slice(0, 4)).sort().at(-1);
  const doiCount = publications.filter((publication) => publication.doi).length;
  const contentTypes = [...new Set(publications.map((publication) => publication.contentType))];
  const biography = author.bio || "No contributor biography has been supplied for this profile.";
  const orcidUrl = author.orcid ? `https://orcid.org/${author.orcid.replace(/^https?:\/\/orcid\.org\//, "")}` : undefined;
  const modifiedDate = publications.map((publication) => publication.modifiedDate).sort().at(-1);

  return (
    <main id="main-content" className="author-profile-page">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "ProfilePage", "@id": absoluteUrl(`/authors/${author.slug}#profile`), mainEntity: { "@type": "Person", "@id": absoluteUrl(`/authors/${author.slug}#person`), name: author.name, description: author.bio || undefined, image: author.imageUrl ? absoluteUrl(author.imageUrl) : undefined, affiliation: author.affiliation ? { "@type": "Organization", name: author.affiliation } : undefined, sameAs: orcidUrl ? [orcidUrl] : undefined }, url: absoluteUrl(`/authors/${author.slug}`), dateModified: modifiedDate },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Authors", item: absoluteUrl("/authors") }, { "@type": "ListItem", position: 3, name: author.name, item: absoluteUrl(`/authors/${author.slug}`) }] }
      ] }} />

      <header className="author-profile-hero" data-author-journal={primaryJournal?.slug}>
        <Image className="author-profile-background" src={primaryJournal?.heroImage || "/assets/published-authors-hero.webp"} alt="" fill priority sizes="100vw" />
        <div className="author-profile-overlay" aria-hidden="true" />
        <div className="author-profile-frame" aria-hidden="true" />
        <div className="section-shell">
          <nav className="author-profile-breadcrumb" aria-label="Breadcrumb"><Link href="/authors">Authors</Link><span aria-hidden="true">/</span><span>{author.name}</span></nav>
          <div className="author-profile-hero-inner">
            <div className="author-profile-portrait">
              {author.imageUrl ? <Image className="author-profile-portrait-image" src={author.imageUrl} alt={`Portrait of ${author.name}`} width={144} height={144} priority /> : <span className="author-profile-portrait-fallback" aria-hidden="true">{authorInitials(author.name)}</span>}
            </div>
            <div className="author-profile-identity">
              <p>Contributor profile</p>
              <h1>{author.name}</h1>
              {(author.credentials || author.affiliation) && <strong>{[author.credentials, author.affiliation].filter(Boolean).join(" · ")}</strong>}
              {orcidUrl && <a className="author-profile-orcid" href={orcidUrl} target="_blank" rel="noopener noreferrer">View ORCID <Icon name="external" className="h-3.5 w-3.5" /></a>}
              <nav aria-label="Profile links"><a href="#published-work"><span>{publications.length}</span> Published work</a>{primaryJournal && <Link href={`/journals/${primaryJournal.slug}`}><Icon name="book" className="h-3.5 w-3.5" /> {primaryJournal.title}</Link>}</nav>
            </div>
            <aside className="author-profile-summary">
              <p>Profile record</p>
              <div><span>Publications</span><strong>{publications.length}</strong></div>
              <div><span>Journals</span><strong>{journals.length}</strong></div>
              <div><span>Latest record</span><strong>{latestYear || "Not listed"}</strong></div>
              <div><span>ORCID</span>{orcidUrl ? <a href={orcidUrl} target="_blank" rel="noopener noreferrer">Verified link</a> : <strong>Not listed</strong>}</div>
            </aside>
          </div>
        </div>
      </header>

      <nav className="author-profile-local-nav" aria-label="Author profile sections"><div className="section-shell"><a href="#profile">Profile</a><a href="#published-work">Published work</a></div></nav>

      <section className="author-profile-metrics-band" aria-label="Publication summary">
        <div className="section-shell author-profile-metrics">
          <div><strong>{publications.length}</strong><span>Published works</span></div>
          <div><strong>{journals.length}</strong><span>Journals</span></div>
          <div><strong>{doiCount}</strong><span>DOI-linked records</span></div>
          <div><strong>{contentTypes.length}</strong><span>Publication types</span></div>
          <div><strong>{latestYear || "-"}</strong><span>Latest record</span></div>
        </div>
      </section>

      <section className="author-profile-archive" id="profile">
        <div className="section-shell author-profile-content">
          <aside className="author-profile-about">
            <p className="authors-overline">About the contributor</p>
            <h2>{author.name}</h2>
            <p>{biography}</p>
            <dl>
              {author.credentials && <div><dt>Credentials</dt><dd>{author.credentials}</dd></div>}
              {author.affiliation && <div><dt>Affiliation</dt><dd>{author.affiliation}</dd></div>}
              <div><dt>Published in</dt><dd>{journals.length ? journals.map((journal) => journal.title).join(", ") : "No linked journal records"}</dd></div>
            </dl>
            <Link href="/authors"><Icon name="arrow" className="h-3.5 w-3.5 rotate-180" /> Back to all authors</Link>
          </aside>
          <div className="author-profile-publications" id="published-work">
            <div className="author-profile-archive-heading"><div><p className="authors-overline">Publication record</p><h2>Published work</h2><p>Records currently connected to this contributor profile.</p></div><span>{publications.length} {publications.length === 1 ? "record" : "records"}</span></div>
            {publications.length ? <div className={`publication-folio-grid${publications.length % 2 ? " is-odd" : ""}`}>{publications.map((publication) => <PublicationCard key={publication.id} publication={publication} />)}</div> : <div className="authors-directory-empty"><div><Icon name="book" className="h-5 w-5" /></div><h3>No linked publications yet.</h3><p>Publication relationships are still being verified for this profile.</p></div>}
          </div>
        </div>
      </section>
    </main>
  );
}
