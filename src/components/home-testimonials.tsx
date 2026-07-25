"use client";

import { useEffect, useState } from "react";

const storageKey = "lakbay-sinag-testimonial-likes-v1";
const testimonials = [
  ["andrea-villanueva","Andrea Villanueva","Research Teacher","Thank you for the smooth and well-organized publication process. Your team made every step easy to understand.",186],
  ["miguel-santos","Miguel Santos","Educational Researcher","Our manuscript was handled professionally, and the communication was consistent throughout the process.",274],
  ["clarisse-mendoza","Clarisse Mendoza","Science Teacher","I am grateful that our research became more visible and accessible online. The publishing team gave our work a wider academic reach.",139],
  ["paolo-ramirez","Paolo Ramirez","Research Coordinator","The transaction was smooth, transparent, and efficient. We received clear updates from submission to publication.",318],
  ["rhea-fernandez","Rhea Fernandez","Graduate Researcher","As a first-time author, I appreciated the patient guidance and prompt responses from the team.",96],
  ["joshua-manalo","Joshua Manalo","Academic Researcher","Seeing our study searchable through Google Scholar was a rewarding experience. Thank you for helping improve the visibility of our work.",241],
  ["camille-navarro","Camille Navarro","Thesis Adviser","The publishing team provided our student researchers with a meaningful and professional publishing experience.",167],
  ["adrian-castillo","Adrian Castillo","Data Analyst","The publication process was straightforward, and the final presentation of our research was clean and professional.",342],
  ["bianca-dominguez","Bianca Dominguez","University Instructor","Thank you for giving educators and researchers a reliable platform to share their academic work.",78],
  ["nathaniel-flores","Nathaniel Flores","Research Consultant","The team was responsive, accommodating, and attentive to our concerns. The entire process was completed without unnecessary complications.",229],
  ["elaine-bautista","Elaine Bautista","Student Research Adviser","Our students were excited to see their research published and accessible to a wider audience.",56],
  ["carlo-de-guzman","Carlo De Guzman","Social Science Researcher","The publishing team helped us share our findings beyond the classroom. The service was professional from beginning to end.",293]
] as const;

function initials(name: string) { return name.split(/\s+/).slice(0,2).map((word) => word[0]).join("").toUpperCase(); }

export function HomeTestimonials() {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setLiked(JSON.parse(localStorage.getItem(storageKey) || "{}")); } catch { setLiked({}); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function toggle(id: string) {
    setLiked((current) => {
      const next = { ...current };
      if (next[id]) delete next[id]; else next[id] = true;
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The control still works when storage is unavailable. */ }
      return next;
    });
  }
  const rows = [testimonials.slice(0,6), testimonials.slice(6,12)];
  return <section className="relative w-full overflow-hidden px-4 pb-20 pt-10"><div className="relative z-[1] mx-auto max-w-5xl space-y-8"><div className="flex max-w-3xl flex-col gap-3"><h2 className="font-serif text-3xl font-bold leading-tight text-forest-900 md:text-4xl lg:text-5xl"><em className="title-emphasis title-emphasis-trusted">Trusted</em> by Readers and Contributors</h2><p className="text-sm leading-7 text-gray-600 md:text-base lg:text-lg">See why our community continues to support a publication committed to credible information, meaningful stories, and responsible expression.</p></div><div className="relative space-y-3">{rows.map((row, rowIndex) => <div className="testimonial-portal" key={rowIndex}><div className={`testimonial-portal-track testimonial-portal-track-${rowIndex + 1}`}>{[0,1].map((duplicate) => <div className="testimonial-portal-group" aria-hidden={duplicate === 1} key={duplicate}>{row.map(([id,name,role,quote,count]) => <article className="testimonial-portal-card group relative grid min-h-[276px] shrink-0 grid-cols-[auto_1fr] gap-x-3 overflow-hidden rounded-xl border border-forest-900/25 bg-white/25 p-5 transition duration-300 hover:-translate-y-1 hover:border-clay-500/50 hover:bg-white hover:shadow-paper" key={`${duplicate}-${id}`}><span className="relative z-[1] grid h-11 w-11 place-items-center rounded-full bg-forest-800 font-serif text-sm font-bold text-white">{initials(name)}</span><div className="relative z-[1] flex min-w-0 flex-col"><div><p className="font-serif text-base font-bold text-forest-900">{name}</p><span className="mt-0.5 block text-[11px] font-semibold text-gray-600">{role}</span></div><blockquote className="mt-4 flex-1"><p className="testimonial-portal-quote text-sm font-normal leading-6 tracking-wide">“{quote}”</p></blockquote><div className="mt-5 flex items-center justify-between border-t border-forest-900/10 pt-3"><span className="text-[10px] font-semibold text-forest-700/65">Community testimony</span><button type="button" tabIndex={duplicate ? -1 : 0} onClick={() => toggle(id)} aria-pressed={Boolean(liked[id])} aria-label={`${liked[id] ? "Unlike" : "Like"} testimony from ${name}`} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold ${liked[id] ? "border-clay-500/35 bg-clay-50 text-clay-700" : "border-forest-900/15 bg-white/75 text-forest-800"}`}><span aria-hidden="true">♡</span><span>{liked[id] ? "Unlike" : "Like"}</span><strong>{count + (liked[id] ? 1 : 0)}</strong></button></div></div></article>)}</div>)}</div></div>)}</div></div></section>;
}
