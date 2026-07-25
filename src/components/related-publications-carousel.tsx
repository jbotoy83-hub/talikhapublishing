"use client";

import { useEffect, useRef } from "react";
import type { Publication } from "@/lib/types";
import { Icon } from "./icon";
import { PublicationCard } from "./publication-card";

export function RelatedPublicationsCarousel({ publications }: { publications: Publication[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pauseUntilRef = useRef(0);

  function move(direction: 1 | -1, manual = false) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (manual) pauseUntilRef.current = Date.now() + 14000;
    const firstCard = viewport.querySelector<HTMLElement>(".publication-folio-card");
    const gap = Number.parseFloat(getComputedStyle(viewport).gap) || 16;
    const distance = (firstCard?.getBoundingClientRect().width || viewport.clientWidth) + gap;
    const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 4;
    if (direction === 1 && atEnd) viewport.scrollTo({ left: 0, behavior: "smooth" });
    else viewport.scrollBy({ left: direction * distance, behavior: "smooth" });
  }

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!reduceMotion.matches && Date.now() >= pauseUntilRef.current) move(1);
    }, 7000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="publication-related-carousel">
    <div className="publication-related-controls" aria-label="Related publications controls">
      <button type="button" onClick={() => move(-1, true)} aria-label="Show previous related publications"><Icon name="arrow" className="h-4 w-4" /></button>
      <button type="button" onClick={() => move(1, true)} aria-label="Show next related publications"><Icon name="arrow" className="h-4 w-4" /></button>
    </div>
    <div className="publication-related-viewport" ref={viewportRef} aria-label="Related publications">
      {publications.map((publication) => <PublicationCard key={publication.id} publication={publication} />)}
    </div>
  </div>;
}
