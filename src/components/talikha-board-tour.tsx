"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const tourItems = [
  {
    title: "Welcome to TalikhaBoard",
    summary: "Your editorial workspace",
    detail: "TalikhaBoard brings your editorial work into one clear workspace, from the first submission through publication.",
  },
  {
    title: "Review submissions",
    summary: "Move each work forward",
    detail: "Read incoming manuscripts, follow their review status, and keep each editorial decision visible to the team.",
  },
  {
    title: "Plan publication",
    summary: "Keep every issue on track",
    detail: "Approve work, set publication dates, and maintain a clear schedule for the next issue and its production steps.",
  },
  {
    title: "Manage authors and records",
    summary: "Keep the full history together",
    detail: "Store author details, submission history, and publication information alongside the work they belong to.",
  },
  {
    title: "Prepare certificates",
    summary: "Finish each publication well",
    detail: "Create publication certificates for scheduled works and keep the final record ready for private delivery.",
  },
] as const;

export function TalikhaBoardTour() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const activeItem = tourItems[activeIndex];

  return (
    <section aria-labelledby="talikha-board-tour-title" className="min-h-[420px] w-full rounded-2xl border border-white/15 bg-[#1c1c1c] p-5 shadow-2xl xl:p-6">
      <p id="talikha-board-tour-title" className="text-xs font-bold uppercase tracking-[.16em] text-clay-500">Explore TalikhaBoard</p>
      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)] xl:gap-6">
        <div className="space-y-1" role="tablist" aria-label="TalikhaBoard features">
          {tourItems.map((item, index) => {
            const selected = activeIndex === index;
            return (
              <button
                key={item.title}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="talikha-board-tour-panel"
                onClick={() => setActiveIndex(index)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${selected ? "bg-white text-[#1c1c1c]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${selected ? "bg-[#1c1c1c] text-white" : "border border-white/45 text-transparent"}`}>✓</span>
                <span className="min-w-0"><span className="block text-sm font-semibold leading-5">{item.title}</span><span className={`mt-0.5 block text-xs leading-4 ${selected ? "text-[#1c1c1c]/65" : "text-white/50"}`}>{item.summary}</span></span>
              </button>
            );
          })}
        </div>
        <div id="talikha-board-tour-panel" role="tabpanel" className="flex min-h-36 items-end border-l border-white/15 pl-5 xl:min-h-52 xl:pl-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeItem.title}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            >
              <p className="text-xs font-bold uppercase tracking-[.16em] text-clay-500">TalikhaBoard</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] text-white xl:text-3xl">{activeItem.title}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/70 xl:text-base">{activeItem.detail}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
