import Link from "next/link";
import { Brand } from "./brand";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_LOCATION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="bg-forest-900 text-forest-100">
      <div className="section-shell grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2"><Brand inverse/><p className="mt-5 max-w-sm text-sm leading-7 text-forest-100/75">{SITE_DESCRIPTION}</p><p className="mt-5 font-serif text-sm italic text-white">“{SITE_TAGLINE}”</p></div>
        <div><h2 className="text-sm font-bold text-white">Discover</h2><div className="mt-4 space-y-3 text-sm text-forest-100/75"><Link className="block hover:text-white" href="/journals">Journals</Link><Link className="block hover:text-white" href="/authors">Authors</Link><Link className="block hover:text-white" href="/#topics">Topics</Link><Link className="block hover:text-white" href="/search">Advanced search</Link></div></div>
        <div><h2 className="text-sm font-bold text-white">Publish</h2><div className="mt-4 space-y-3 text-sm text-forest-100/75"><Link className="block hover:text-white" href="/submit">Submit your work</Link><Link className="block hover:text-white" href="/editorial-standards">Editorial standards</Link><Link className="block hover:text-white" href="/faq">FAQs</Link></div></div>
        <div><h2 className="text-sm font-bold text-white">Company</h2><div className="mt-4 space-y-3 text-sm text-forest-100/75"><Link className="block hover:text-white" href="/services">Services</Link><Link className="block hover:text-white" href="/privacy">Privacy</Link><Link className="block hover:text-white" href="/terms">Terms of use</Link><a className="block hover:text-white" href={`mailto:${CONTACT_EMAIL}`}>Contact</a></div></div>
      </div>
      <div className="border-t border-white/10"><div className="section-shell flex flex-col gap-3 py-5 text-xs text-forest-100/60 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getUTCFullYear()} {SITE_NAME}. All rights reserved.</p><p>Made for readers, writers, and communities in {SITE_LOCATION}.</p></div></div>
    </footer>
  );
}
