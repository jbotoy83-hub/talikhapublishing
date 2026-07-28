import Image from "next/image";
import Link from "next/link";
import type { Publication } from "@/lib/types";
import { Icon } from "./icon";
import { DoiBadge } from "./doi-badge";
import { OpenAccessBadge } from "./license-badge";

function publicationDate(publication: Publication) {
  return publication.publicationDatePrecision === "year"
    ? publication.publicationDate
    : new Date(`${publication.publicationDate}T00:00:00`).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

export function PublicationCard({ publication }: { publication: Publication }) {
  const date = publicationDate(publication);
  const typeLabel = publication.contentType === "research"
    ? "Research article"
    : publication.contentType === "creative"
      ? "Creative work"
      : "Commentary";

  return (
    <article className="publication-folio-card group">
      <Link
        href={`/publications/${publication.slug}`}
        className="publication-folio-image"
        aria-label={`Read ${publication.title}`}
      >
        <Image src={publication.journal.heroImage} alt="" fill sizes="(max-width: 768px) 100vw, 36vw" />
        <span>{typeLabel}</span>
      </Link>
      <div className="publication-folio-body">
        <div className="publication-folio-journal">
          <Link href={`/journals/${publication.journal.slug}`}>{publication.journal.title}</Link>
          <time dateTime={publication.publicationDate}>{date}</time>
        </div>
        <h2>
          <Link href={`/publications/${publication.slug}`}>{publication.title}</Link>
        </h2>
        <div className="pub-badges-row"><OpenAccessBadge licenseName={publication.licenseName} /><DoiBadge doi={publication.doi} /></div>
        <p className="publication-folio-authors">{publication.authorDisplay}</p>
        <p className="publication-folio-abstract">
          {publication.abstract || "This historical record is preserved with its journal, authorship, and citation details."}
        </p>
        <dl className="publication-folio-metadata">
          <div>
            <dt>Volume / issue</dt>
            <dd>{publication.volume ? `Vol. ${publication.volume}` : "Not listed"}{publication.issue ? `, No. ${publication.issue}` : ""}</dd>
          </div>
          <div>
            <dt>Pages</dt>
            <dd>{publication.pages || "Not listed"}</dd>
          </div>
          <div>
            <dt>DOI</dt>
            <dd>{publication.doi ? "Registered" : "Not listed"}</dd>
          </div>
        </dl>
        <Link href={`/publications/${publication.slug}`} className="publication-folio-link">
          View publication <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
