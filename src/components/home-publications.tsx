"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Publication } from "@/lib/types";
import { Icon } from "./icon";

const journalOrder = ["academic-frontiers", "echoes-of-expression", "visionary-voices"];
const gradients: Record<string, string> = {
  "academic-frontiers": "from-emerald-900 via-emerald-700 to-amber-600",
  "echoes-of-expression": "from-rose-950 via-rose-700 to-orange-500",
  "visionary-voices": "from-violet-950 via-violet-700 to-amber-500"
};

function issueLabel(publication: Publication) {
  if (publication.issue && publication.volume) return `Vol. ${publication.volume}, No. ${publication.issue}`;
  if (publication.issue) return `Issue ${publication.issue}`;
  if (publication.volume) return `Vol. ${publication.volume}`;
  return "Current issue";
}

function displayDate(publication: Publication) {
  if (publication.publicationDatePrecision === "year") return publication.publicationDate;
  return new Date(`${publication.publicationDate}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function PublicationCard({ publication, large = false }: { publication: Publication; large?: boolean }) {
  const articleHref = `/publications/${publication.slug}`;
  const issue = issueLabel(publication);
  return <article className={`article-card group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-forest-900/10 bg-white ${large ? "md:grid md:grid-cols-[1.15fr_.85fr]" : ""}`}>
    <Link href={articleHref} className={`article-visual relative block bg-gradient-to-br ${gradients[publication.journal.slug] || gradients["academic-frontiers"]} ${large ? "article-visual-large" : ""}`} aria-label={`${publication.contentType}. Read ${publication.title}`}><div className="article-image-shade absolute inset-0"/><div aria-hidden="true" className="absolute left-5 top-5 rounded-full bg-white/95 px-3 py-1 text-[.68rem] font-bold uppercase tracking-wider text-forest-900 shadow-sm">{publication.contentType}</div></Link>
    <div className={`flex flex-1 flex-col p-6 ${large ? "md:justify-center md:p-8" : ""}`}><div className="article-card-journal-meta mb-3 text-[.7rem] font-semibold uppercase tracking-wider text-clay-700"><Link href={`/journals/${publication.journal.slug}`} className="truncate hover:underline">{publication.journal.title}</Link><span>{issue}</span><span>{publication.publicationDate.slice(0,4)}</span></div><h3 className={`article-title font-serif ${large ? "text-3xl" : "text-xl"} font-bold leading-tight text-forest-900`}><Link href={articleHref}>{publication.title}</Link></h3><p className="article-card-abstract mt-3 text-sm leading-6 text-gray-700">{publication.abstract || "Open the publication record for verified citation, authorship, and journal details."}</p><div className="publication-meta mt-auto border-t border-forest-900/10 pt-4 text-xs leading-5 text-gray-700"><div className="article-card-byline"><span className="article-card-authors" title={publication.authorDisplay}>{publication.authors.length ? publication.authors.map((author,index)=><span key={author.id}>{index>0 && ", "}<Link href={`/authors/${author.slug}`} className="font-semibold text-forest-800 hover:text-clay-700">{author.name}</Link></span>) : publication.authorDisplay}</span><time className="article-card-date text-gray-600" dateTime={publication.publicationDate}>{displayDate(publication)}</time></div><div className="citation-details"><p>{publication.journal.title}, {issue}, {publication.publicationDate.slice(0,4)}.</p>{publication.doi && <a className="block break-all font-semibold text-clay-700 underline decoration-clay-500/35 underline-offset-2 hover:text-clay-600" href={`https://doi.org/${publication.doi}`} target="_blank" rel="noreferrer">{publication.doi}</a>}</div><div className="article-card-actions"><Link href={articleHref} className="article-see-more">See more<span className="sr-only"> about {publication.title}</span> <Icon name="arrow" className="h-3.5 w-3.5"/></Link></div></div></div>
  </article>;
}

export function HomePublications({ publications }: { publications: Publication[] }) {
  const { featured, rail } = useMemo(() => {
    const firstByJournal = journalOrder.flatMap((slug) => publications.find((item) => item.journal.slug === slug) || []);
    const featuredIds = new Set(firstByJournal.map((item) => item.id));
    return { featured: firstByJournal.length ? firstByJournal : publications.slice(0,3), rail: publications.filter((item) => !featuredIds.has(item.id)).slice(0,6) };
  }, [publications]);
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (featured.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: number | undefined;
    const start = () => { timer = window.setInterval(() => setActive((value) => (value + 1) % featured.length), 6000); };
    const stop = () => { window.clearInterval(timer); };
    start();
    const onVisibility = () => { document.visibilityState === "visible" ? start() : stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [featured.length]);
  function moveRail(direction: 1 | -1) {
    const element = railRef.current;
    if (!element) return;
    const max = Math.max(0, element.scrollWidth - element.clientWidth);
    if (direction === 1 && element.scrollLeft >= max - 8) element.scrollTo({ left: 0, behavior: "smooth" });
    else if (direction === -1 && element.scrollLeft <= 8) element.scrollTo({ left: max, behavior: "smooth" });
    else element.scrollBy({ left: direction * Math.max(320, element.clientWidth * .72), behavior: "smooth" });
  }
  if (!featured.length) return <div className="rounded-2xl border border-dashed border-forest-900/25 bg-white p-10 text-center"><h3 className="font-serif text-xl font-bold text-forest-900">No publications are available yet</h3></div>;
  return <div className="newsworthy-carousel"><div className="newsworthy-stage">{featured.map((publication,index)=><div key={publication.id} className={`newsworthy-slide ${index===active?"active":""}`} aria-hidden={index!==active}><PublicationCard publication={publication} large/></div>)}<div className="newsworthy-progress">{featured.map((publication,index)=><button key={publication.id} type="button" className={index===active?"active":""} onClick={()=>setActive(index)} aria-label={`Show ${publication.title}`} aria-current={index===active?"true":undefined}><i/></button>)}</div></div>{rail.length>0 && <div className="newsworthy-rail-shell"><button type="button" className="newsworthy-rail-arrow newsworthy-rail-arrow-prev" onClick={()=>moveRail(-1)} aria-label="Show previous studies"><Icon name="arrow" className="h-5 w-5"/></button><div className="newsworthy-rail" ref={railRef}>{rail.map((publication)=><div className="newsworthy-rail-item" key={publication.id}><PublicationCard publication={publication}/></div>)}</div><button type="button" className="newsworthy-rail-arrow newsworthy-rail-arrow-next" onClick={()=>moveRail(1)} aria-label="Show next studies"><Icon name="arrow" className="h-5 w-5"/></button></div>}</div>;
}
