import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function NotFound() {
  return <main id="main-content" className="section-shell grid min-h-[60vh] place-items-center py-20 text-center"><div><p className="eyebrow">404 · Page not found</p><h1 className="display-title mt-4 text-5xl font-bold text-forest-900">This page is not in the archive.</h1><p className="mx-auto mt-5 max-w-xl leading-8 text-gray-600">The address may be incomplete, outdated, or unavailable in the current {SITE_NAME} catalogue. Search the archive or return home.</p><div className="mt-8 flex justify-center gap-3"><Link href="/search" className="rounded-xl border border-forest-900/15 bg-white px-5 py-3 text-sm font-bold text-forest-900">Search archive</Link><Link href="/" className="rounded-xl bg-forest-800 px-5 py-3 text-sm font-bold text-white">Return home</Link></div></div></main>;
}
