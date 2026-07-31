"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONTACT_EMAIL, SITE_NAME, SITE_TAGLINE, SOCIAL_LINKS } from "@/lib/site";
import { Brand } from "./brand";
import { Icon } from "./icon";
import { GooeyInput } from "@/components/ui/gooey-input";

export type HeaderJournal = {
  slug: string;
  title: string;
  type: string;
};

export function SiteHeader({ journals }: { journals: HeaderJournal[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  const runSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        router.push("/search");
      }
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = menuOpen ? "hidden" : "";
    if (menuOpen) closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen, router]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="top-strip">
        <div className="section-shell top-strip-layout">
          <div className="top-strip-message"><Icon name="leaf" className="h-3.5 w-3.5"/><span>{SITE_TAGLINE}</span></div>
          <div className="top-strip-actions">
            {SOCIAL_LINKS.facebook && <>
              <span className="top-strip-follow">Follow us</span>
              <a className="top-strip-social" href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${SITE_NAME} on Facebook`}><Icon name="facebook" className="h-4 w-4"/></a>
            </>}
            <a className="top-strip-social top-strip-social-mail" href={`mailto:${CONTACT_EMAIL}`} aria-label={`Email ${SITE_NAME}`}><Icon name="mail" className="h-4 w-4"/></a>
            <span className="top-strip-divider" aria-hidden="true"/>
            <Link className="top-strip-text-link" href="/editorial-standards">Editorial standards</Link>
            <a className="top-strip-text-link" href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
          </div>
        </div>
      </div>
      <header className="site-header sticky top-0 z-40">
        <nav className="section-shell flex h-[56px] items-center justify-between" aria-label="Primary navigation">
          <Brand />
          <div className="hidden items-center gap-5 lg:flex">
            <Link className="nav-link" href="/">Home</Link>
            <div className="group relative">
              <Link className="nav-link flex items-center gap-1" href="/journals">Journals <Icon name="chevron" className="h-3.5 w-3.5"/></Link>
              <div className="invisible absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-4 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="divide-y divide-gray-100 rounded-xl border border-forest-900/10 bg-white shadow-paper">
                  {journals.length > 0 && <div className="p-2">{journals.map((journal) => <Link key={journal.slug} href={`/journals/${journal.slug}`} className="block rounded-lg px-3 py-3 hover:bg-forest-50"><span className="block text-sm font-bold text-forest-900">{journal.title}</span><span className="mt-1 block text-xs text-gray-500">{journal.type}</span></Link>)}</div>}
                  <Link href="/journals" className="flex items-center justify-between p-4 text-sm font-bold text-clay-700">View all journals <Icon name="arrow" className="h-4 w-4"/></Link>
                </div>
              </div>
            </div>
            <Link className="nav-link" href="/authors">Authors</Link>
            <Link className="nav-link" href="/track">Track Submission</Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <form role="search" onSubmit={runSearch} className="hidden shrink-0 items-center xl:flex" aria-label="Search publications">
              <GooeyInput value={query} onValueChange={setQuery} placeholder="Search" collapsedWidth={116} expandedWidth={210} expandedOffset={56} gooeyBlur={6} classNames={{ trigger: "bg-white text-forest-900 font-semibold shadow-none ring-1 ring-forest-900/20 hover:bg-forest-50 hover:ring-forest-900/35 focus-visible:ring-2 focus-visible:ring-clay-400/70 focus-visible:ring-offset-0", input: "text-forest-900 font-medium placeholder:text-forest-800/55", bubbleSurface: "bg-white text-forest-800 shadow-none ring-0" }} />
              <button type="submit" className="sr-only">Search</button>
            </form>
            <Link href="/search" className="inline-flex h-9 items-center gap-2 rounded-full border border-forest-800/15 bg-white/70 px-3 text-sm font-semibold text-forest-800 hover:border-clay-500 hover:text-clay-700 xl:hidden" aria-label="Search publications"><Icon name="search" className="h-4 w-4"/><span className="hidden sm:inline">Search</span></Link>
            <Link href="/submit" className="hidden rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-900 sm:inline-flex">Submit work</Link>
            <button type="button" onClick={() => setMenuOpen(true)} className="grid h-9 w-9 place-items-center rounded-full text-forest-800 hover:bg-white lg:hidden" aria-label="Open navigation" aria-controls="mobile-navigation" aria-expanded={menuOpen}><Icon name="menu"/></button>
          </div>
        </nav>
      </header>
      <aside id="mobile-navigation" role="dialog" aria-modal={menuOpen ? true : undefined} aria-label="Mobile navigation" inert={!menuOpen} className={`drawer fixed inset-y-0 right-0 z-[70] w-[86%] max-w-sm bg-white p-6 shadow-2xl ${menuOpen ? "open" : "closed"}`} aria-hidden={!menuOpen}>
        <div className="flex items-center justify-between"><Brand/><button ref={closeButtonRef} type="button" onClick={closeMenu} className="grid h-10 w-10 place-items-center rounded-full text-2xl hover:bg-gray-100" aria-label="Close navigation">×</button></div>
        <nav className="mt-10 space-y-1 text-lg font-semibold">
          <Link onClick={closeMenu} className="block rounded-lg px-3 py-3 hover:bg-forest-50" href="/">Home</Link>
          <div className="px-3 pt-4 text-xs uppercase tracking-widest text-gray-400">Journals</div>
          {journals.map((journal) => <Link onClick={closeMenu} key={journal.slug} className="block rounded-lg px-3 py-2 text-base hover:bg-forest-50" href={`/journals/${journal.slug}`}>{journal.title}</Link>)}
          <Link onClick={closeMenu} className="block rounded-lg px-3 py-3 hover:bg-forest-50" href="/authors">Authors</Link>
          <Link onClick={closeMenu} className="block rounded-lg px-3 py-3 hover:bg-forest-50" href="/track">Track Submission</Link>
        </nav>
        <Link onClick={closeMenu} href="/submit" className="mt-8 flex w-full justify-center rounded-xl bg-forest-800 px-4 py-3 font-bold text-white">Submit your work</Link>
      </aside>
      <button type="button" aria-label="Close menu" onClick={closeMenu} className={`fixed inset-0 z-[60] bg-forest-950/40 backdrop-blur-sm ${menuOpen ? "block" : "hidden"}`}/>
    </>
  );
}
