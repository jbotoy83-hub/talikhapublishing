"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export type FaqItem = Readonly<{
  id: string;
  groupId: string;
  category: string;
  question: string;
  answer: string;
}>;

export type FaqGroup = Readonly<{
  id: string;
  label: string;
  description: string;
}>;

type FaqExplorerProps = {
  faqs: readonly FaqItem[];
  groups: readonly FaqGroup[];
};

function pad(number: number) {
  return String(number).padStart(2, "0");
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToId(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerQuery);
  let key = 0;
  while (matchIndex !== -1) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <mark key={key} className="rounded-[3px] bg-[#e8b45e]/45 px-0.5 text-inherit">
        {text.slice(matchIndex, matchIndex + query.length)}
      </mark>
    );
    key += 1;
    cursor = matchIndex + query.length;
    matchIndex = lowerText.indexOf(lowerQuery, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function FaqExplorer({ faqs, groups }: FaqExplorerProps) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");
  const [openIds, setOpenIds] = useState<string[]>(faqs[0] ? [faqs[0].id] : []);
  const [activeSection, setActiveSection] = useState(groups[0]?.id ?? "");
  const [trackedQuery, setTrackedQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const pendingScroll = useRef<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const matchesQuery = useCallback(
    (faq: FaqItem) =>
      !normalizedQuery ||
      faq.question.toLowerCase().includes(normalizedQuery) ||
      faq.answer.toLowerCase().includes(normalizedQuery) ||
      faq.category.toLowerCase().includes(normalizedQuery),
    [normalizedQuery]
  );

  const visibleGroups = useMemo(
    () =>
      groups
        .filter((group) => activeGroup === "all" || group.id === activeGroup)
        .map((group) => ({
          ...group,
          number: pad(groups.findIndex((entry) => entry.id === group.id) + 1),
          items: faqs.filter((faq) => faq.groupId === group.id && matchesQuery(faq)),
        }))
        .filter((group) => group.items.length > 0),
    [groups, faqs, activeGroup, matchesQuery]
  );

  const visibleIds = useMemo(() => visibleGroups.flatMap((group) => group.items.map((faq) => faq.id)), [visibleGroups]);
  const visibleCount = visibleIds.length;
  const allOpen = visibleIds.length > 0 && visibleIds.every((id) => openIds.includes(id));
  const filterKey = `${activeGroup}|${normalizedQuery}`;

  if (normalizedQuery !== trackedQuery) {
    setTrackedQuery(normalizedQuery);
    setOpenIds(normalizedQuery ? faqs.filter(matchesQuery).map((faq) => faq.id) : faqs[0] ? [faqs[0].id] : []);
  }

  useEffect(() => {
    if (!pendingScroll.current) return;
    const targetId = pendingScroll.current;
    pendingScroll.current = null;
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToId(targetId)));
  }, [filterKey]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = visibleGroups
      .map((group) => document.getElementById(`faq-group-${group.id}`))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const current = inView[0]?.target.getAttribute("data-group-id");
        if (current) setActiveSection(current);
      },
      { rootMargin: "-160px 0px -50% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [visibleGroups]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const jumpToGroup = (groupId: string) => {
    setActiveGroup("all");
    pendingScroll.current = `faq-group-${groupId}`;
  };

  const handleRailClick = (groupId: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (activeGroup !== "all") {
      setActiveGroup("all");
      pendingScroll.current = `faq-group-${groupId}`;
      return;
    }
    scrollToId(`faq-group-${groupId}`);
  };

  const toggleAll = () => setOpenIds(allOpen ? [] : visibleIds);
  const resetFilters = () => {
    setQuery("");
    setActiveGroup("all");
  };

  const statusLabel = normalizedQuery
    ? `${visibleCount} of ${faqs.length} answers match`
    : activeGroup !== "all"
      ? `${visibleCount} answers in view`
      : `${faqs.length} answers · ${groups.length} editorial paths`;

  return (
    <>
      <section className="relative overflow-hidden border-b border-forest-900/10 bg-gradient-to-br from-parchment via-[#f8f8f3] to-[#e9f0ea]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(24,61,44,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(24,61,44,0.045)_1px,transparent_1px)] [background-size:54px_54px] [mask-image:linear-gradient(90deg,black,transparent_78%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-72 -right-48 h-[38rem] w-[38rem] rounded-full border border-clay-500/20 shadow-[0_0_0_4rem_rgba(166,83,53,0.045),0_0_0_9rem_rgba(24,61,44,0.035)]"
        />
        <div className="section-shell relative z-[1] grid items-end gap-10 py-14 pb-12 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.62fr)] lg:gap-24 lg:py-20 lg:pb-16">
          <div>
            <p className="eyebrow">Editorial help desk</p>
            <h1 className="mt-4 max-w-[750px] font-serif text-[clamp(2.9rem,6vw,5.5rem)] font-extrabold leading-[0.98] tracking-[-0.05em] text-forest-900 [text-wrap:balance]">
              Frequently asked questions
            </h1>
            <p className="mt-6 max-w-[610px] text-base leading-relaxed text-[#53635a]">
              Clear answers about submitting, reviewing, publishing, rights, privacy, and discovery. Search the desk or
              follow one of the editorial paths below.
            </p>
          </div>
          <aside aria-label="FAQ overview" className="w-full max-w-sm border-y border-forest-900/30 py-5 lg:justify-self-end">
            <div className="flex items-start justify-between gap-4 text-forest-900">
              <span className="pt-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-clay-600">Knowledge desk</span>
              <strong className="font-serif text-6xl font-extrabold leading-[0.8] tracking-[-0.06em]">{pad(faqs.length)}</strong>
            </div>
            <p className="mt-3 max-w-[20rem] text-sm leading-relaxed text-[#607169]">
              One place to understand the work before it becomes part of the record.
            </p>
            <div className="mt-5 grid gap-1 border-t border-forest-900/10 pt-4">
              {groups.map((group, index) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => jumpToGroup(group.id)}
                  className="group grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-2 rounded-md px-1 py-1.5 text-left transition-colors duration-200 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500/40"
                >
                  <span className="text-[11px] font-extrabold tracking-wider text-clay-600">{pad(index + 1)}</span>
                  <strong className="text-sm font-extrabold text-forest-800 transition-colors duration-200 group-hover:text-clay-700">
                    {group.label}
                  </strong>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <div className="sticky top-14 z-30 border-b border-forest-900/10 bg-parchment/90 backdrop-blur-md motion-reduce:backdrop-blur-none">
        <div className="section-shell flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b756d]" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Search the answers"
              aria-label="Search frequently asked questions"
              className="h-11 w-full rounded-full border border-forest-900/15 bg-white pl-10 pr-12 text-sm font-semibold text-ink placeholder:font-medium placeholder:text-[#6b756d]/80 transition-all duration-200 focus:border-forest-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[#6b756d] transition-colors duration-200 hover:bg-clay-50 hover:text-clay-700"
              >
                <Icon name="plus" className="h-3.5 w-3.5 rotate-45" />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="absolute right-3.5 top-1/2 hidden h-6 -translate-y-1/2 items-center rounded-md border border-forest-900/15 bg-parchment px-1.5 text-[11px] font-bold text-[#6b756d] sm:grid"
              >
                /
              </kbd>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter answers by topic">
            <button
              type="button"
              onClick={() => setActiveGroup("all")}
              aria-pressed={activeGroup === "all"}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-all duration-200 active:scale-[0.98]",
                activeGroup === "all"
                  ? "border-forest-900 bg-forest-800 text-white"
                  : "border-forest-900/15 bg-white text-forest-900/75 hover:border-clay-500/50 hover:text-clay-700"
              )}
            >
              All
              <span className={cn("text-[11px] font-extrabold", activeGroup === "all" ? "text-white/70" : "text-clay-600")}>
                {faqs.length}
              </span>
            </button>
            {groups.map((group) => {
              const count = faqs.filter((faq) => faq.groupId === group.id && matchesQuery(faq)).length;
              const isActive = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroup(isActive ? "all" : group.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-all duration-200 active:scale-[0.98]",
                    isActive
                      ? "border-forest-900 bg-forest-800 text-white"
                      : "border-forest-900/15 bg-white text-forest-900/75 hover:border-clay-500/50 hover:text-clay-700",
                    !isActive && count === 0 && "opacity-50"
                  )}
                >
                  {group.label}
                  <span className={cn("text-[11px] font-extrabold", isActive ? "text-white/70" : "text-clay-600")}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="section-shell grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(150px,0.26fr)_minmax(0,1fr)] lg:gap-16">
        <aside className="hidden lg:block">
          <div className="sticky top-40">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-clay-600">On this page</p>
            <nav aria-label="FAQ topics" className="mt-4 flex flex-col">
              {groups.map((group, index) => {
                const isActive = activeSection === group.id;
                return (
                  <a
                    key={group.id}
                    href={`#faq-group-${group.id}`}
                    onClick={handleRailClick(group.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex items-baseline gap-3 border-l py-2.5 pl-4 text-sm font-bold transition-all duration-200",
                      isActive
                        ? "border-clay-600 bg-white/70 text-forest-900"
                        : "border-forest-900/15 text-[#53635a] hover:border-clay-500 hover:bg-white/40 hover:text-forest-900"
                    )}
                  >
                    <span className="text-[11px] font-extrabold tracking-wider text-clay-600">{pad(index + 1)}</span>
                    {group.label}
                  </a>
                );
              })}
            </nav>
            <div className="mt-6 grid gap-1 border-t border-forest-900/10 pt-4">
              <strong className="font-serif text-base font-extrabold text-forest-900">{faqs.length} answers</strong>
              <span className="text-xs leading-relaxed text-[#607169]">Written for authors, readers, and editorial partners.</span>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-forest-900/20 pb-4">
            <p className="font-serif text-xl font-extrabold text-forest-900">Questions and answers</p>
            <div className="flex items-center gap-4">
              <p aria-live="polite" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-clay-600">
                {statusLabel}
              </p>
              <button
                type="button"
                onClick={toggleAll}
                disabled={visibleCount === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-forest-900/15 bg-white px-3 text-xs font-bold text-forest-900/75 transition-all duration-200 hover:border-clay-500/50 hover:text-clay-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              >
                <Icon name="chevron" className={cn("h-3.5 w-3.5 transition-transform duration-300", allOpen && "rotate-180")} />
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>
          </div>

          {visibleGroups.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-forest-900/25 bg-white/60 px-6 py-16 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-clay-50 text-clay-600">
                <Icon name="search" className="h-5 w-5" />
              </span>
              <h2 className="mt-5 font-serif text-2xl font-extrabold text-forest-900">No answers match</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#607169]">
                Nothing on the desk matches{normalizedQuery ? ` “${query.trim()}”` : " this filter"}
                {activeGroup !== "all" ? ` within ${groups.find((group) => group.id === activeGroup)?.label}` : ""}. Try
                different words, or browse every topic again.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-bold text-white transition-all duration-200 hover:bg-forest-900 active:scale-[0.98]"
              >
                Clear search and filters
              </button>
            </div>
          ) : (
            <Accordion type="multiple" value={openIds} onValueChange={setOpenIds} className="mt-2">
              {visibleGroups.map((group, groupIndex) => (
                <section
                  key={group.id}
                  id={`faq-group-${group.id}`}
                  data-group-id={group.id}
                  className={cn(
                    "scroll-mt-48 animate-faq-rise motion-reduce:animate-none lg:scroll-mt-40",
                    groupIndex > 0 && "mt-14"
                  )}
                  style={{ animationDelay: `${groupIndex * 90}ms` }}
                >
                  <header className="flex items-end justify-between gap-4 border-b border-forest-900/20 pb-5">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-clay-600">
                        Editorial path {group.number}
                      </p>
                      <h2 className="mt-2 font-serif text-2xl font-extrabold tracking-[-0.03em] text-forest-900 sm:text-3xl">
                        {group.label}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#607169]">{group.description}</p>
                    </div>
                    <span aria-hidden="true" className="hidden select-none font-serif text-5xl font-extrabold leading-none text-forest-900/10 sm:block">
                      {group.number}
                    </span>
                  </header>

                  <div>
                    {group.items.map((faq) => {
                      const number = pad(faqs.findIndex((entry) => entry.id === faq.id) + 1);
                      return (
                        <AccordionItem
                          key={faq.id}
                          value={faq.id}
                          className="border-forest-900/10 transition-colors duration-200 data-[state=open]:bg-[#fffdf8] data-[state=open]:shadow-[inset_3px_0_0_#bc5739]"
                        >
                          <AccordionTrigger className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-none px-1 py-5 hover:bg-white/50 focus-visible:ring-clay-500/40 sm:grid-cols-[3rem_minmax(0,1fr)_3rem] sm:gap-4 sm:px-2">
                            <span aria-hidden="true" className="text-xs font-extrabold tracking-[0.1em] text-clay-600">
                              {number}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#718077]">
                                {faq.category}
                              </span>
                              <span className="mt-1 block font-serif text-base font-extrabold leading-snug text-forest-900 [overflow-wrap:anywhere] sm:text-lg">
                                {highlight(faq.question, normalizedQuery)}
                              </span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="grid h-9 w-9 place-items-center justify-self-end rounded-full border border-clay-600/25 bg-clay-50 text-clay-600 transition-all duration-300 group-data-[state=open]/accordion-trigger:rotate-180 group-data-[state=open]/accordion-trigger:border-clay-600 group-data-[state=open]/accordion-trigger:bg-clay-600 group-data-[state=open]/accordion-trigger:text-white sm:h-10 sm:w-10"
                            >
                              <Icon name="chevron" className="h-4 w-4" />
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="text-base leading-relaxed text-[#4d5b54]">
                            <p className="max-w-[68ch] pb-6 pl-[3.25rem] pr-2 sm:pl-16 sm:pr-8">
                              {highlight(faq.answer, normalizedQuery)}
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </div>
                </section>
              ))}
            </Accordion>
          )}

          <aside className="mt-16 grid items-center gap-5 rounded-2xl border border-forest-900/10 bg-[#edf3ee] p-6 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-6">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-forest-900 text-white">
              <Icon name="mail" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-clay-700">Need another answer?</p>
              <h2 className="mt-1.5 font-serif text-xl font-extrabold leading-tight text-forest-900 sm:text-2xl">
                Give the editorial team enough context to help.
              </h2>
              <p className="mt-1.5 max-w-[45rem] text-sm leading-relaxed text-[#5b6a61]">
                Use a submission reference, DOI, or publication URL whenever you have one.
              </p>
            </div>
            <Link
              href="/submit"
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-forest-900 px-5 text-sm font-extrabold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500/40 focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:hover:translate-y-0 sm:justify-self-end"
            >
              Submit securely <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}
