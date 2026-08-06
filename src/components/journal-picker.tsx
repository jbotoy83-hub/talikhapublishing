"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { Icon } from "./icon";

export type JournalPickerEntry = {
  slug: string;
  title: string;
  longTitle: string;
  scope: string;
  blurb: string;
  description?: string;
  detail?: string;
  status?: string;
  volume?: string;
  issue?: string;
};

const SPRING: Transition = { duration: 0.28, ease: [0.16, 1, 0.3, 1] };
const FADE: Transition = { duration: 0.16, ease: "easeOut" };

const COVERS: Record<string, { cover: string; fallback: string }> = {
  inquira: { cover: "/assets/journal-inquira-cover.png", fallback: "/assets/journal-academic-frontiers-hero.jpg" },
  lumera: { cover: "/assets/journal-lumera-cover.png", fallback: "/assets/journal-echoes-expression-hero.jpg" },
};

function coverFor(slug: string) {
  return COVERS[slug] ?? { cover: "/assets/journal-academic-frontiers-hero.jpg", fallback: "/assets/journal-academic-frontiers-hero.jpg" };
}

function CoverImage({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const [src, setSrc] = useState(() => coverFor(slug).cover);
  return (
    <img
      src={src}
      alt={`${title} journal cover`}
      decoding="async"
      className={className}
      onError={() => setSrc((current) => (current === coverFor(slug).cover ? coverFor(slug).fallback : current))}
    />
  );
}

export function JournalPicker({ journals, selected, onSelect }: { journals: JournalPickerEntry[]; selected: string; onSelect: (slug: string) => void }) {
  const [active, setActive] = useState<JournalPickerEntry | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);

  useEffect(() => {
    journals.forEach((journal) => {
      const img = new Image();
      img.decoding = "async";
      img.src = coverFor(journal.slug).cover;
      if (typeof img.decode === "function") img.decode().catch(() => {});
    });
  }, [journals]);

  useOutsideClick(cardRef, () => setActive(null));

  return (
    <>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Journal">
        {journals.map((journal) => {
          const isSelected = selected === journal.slug;
          const isDimmed = selected !== "" && !isSelected;
          return (
            <button
              type="button"
              key={journal.slug}
              role="radio"
              aria-checked={isSelected}
              onClick={() => setActive(journal)}
              className={`group flex w-full items-center gap-4 rounded-xl border bg-white p-3 text-left transition-all ${isSelected ? "border-[#2d6045] shadow-[0_0_0_3px_rgba(31,107,70,0.12)]" : isDimmed ? "border-[#e3e6ea] hover:border-[#7fae93]" : "border-[#dfe2e6] hover:border-[#7fae93]"}`}
              style={{ opacity: isDimmed ? 0.5 : 1, filter: isDimmed ? "saturate(0.55)" : "none" }}
            >
              <span className="relative block w-14 shrink-0 overflow-hidden rounded-md border border-[#e6e9ec] bg-[#eef2ef] sm:w-16" style={{ aspectRatio: "1414 / 2000" }}>
                <CoverImage slug={journal.slug} title={journal.title} className="h-full w-full object-cover" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <strong className="font-serif text-base text-ink sm:text-lg">{journal.longTitle}</strong>
                <span className="text-sm text-[#4a5560]">{journal.blurb}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-[#5d6e64]">{journal.scope}</span>
              </span>
              <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${isSelected ? "bg-[#214d37] text-white" : "bg-[#eef2ef] text-[#183d2c] group-hover:bg-[#dfe9e2]"}`}>
                {isSelected && <Icon name="check" className="h-4 w-4" />}
                <span className="whitespace-nowrap">Submit to {journal.title} Journal</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {active && (
          <div className="fixed inset-0 z-[90]">
            <motion.button
              type="button"
              aria-label="Close journal preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE}
              onClick={() => setActive(null)}
              className="absolute inset-0 h-full w-full cursor-default bg-ink/50"
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
              <motion.div
                ref={cardRef}
                initial={{ opacity: 0, scale: 0.94, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.14, ease: "easeIn" } }}
                transition={SPRING}
                className="pointer-events-auto relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-lift transform-gpu md:flex-row"
              >
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setActive(null)}
                  className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-lift transition hover:bg-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
                <div className="relative w-full shrink-0 overflow-hidden bg-[#eef2ef] md:w-80 md:flex-none" style={{ aspectRatio: "1414 / 2000" }}>
                  <CoverImage slug={active.slug} title={active.title} className="absolute inset-0 h-full w-full object-contain" />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ ...SPRING, delay: 0.04 }}
                  className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6 md:p-8"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-600">{active.scope}</p>
                    <h3 className="mt-2 font-serif text-2xl text-ink md:text-3xl">{active.longTitle}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-[#4a5560] md:text-base">{active.description || active.blurb}</p>
                  {active.volume && (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-[#dfe9e2] px-3 py-1.5 text-[#183d2c]">{active.status ?? "Accepting submissions"}</span>
                      <span className="rounded-full bg-[#eef2ef] px-3 py-1.5 text-[#4a5560]">Volume {active.volume}, Issue {active.issue}</span>
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(active.slug);
                        setActive(null);
                      }}
                      className="rounded-full bg-[#214d37] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#183d2c]"
                    >
                      Submit to {active.title}
                    </button>
                    <button type="button" onClick={() => setActive(null)} className="rounded-full px-5 py-3 text-sm font-semibold text-[#4a5560] transition hover:bg-[#eef2ef]">
                      Keep browsing
                    </button>
                    {selected === active.slug && (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-[#214d37]">
                        <Icon name="check" className="h-4 w-4" />
                        Currently selected
                      </span>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
