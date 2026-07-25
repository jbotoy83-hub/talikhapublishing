import Link from "next/link";
import { SITE_NAME, SITE_SHORT_NAME } from "@/lib/site";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  const suffix = SITE_NAME.startsWith(SITE_SHORT_NAME)
    ? SITE_NAME.slice(SITE_SHORT_NAME.length).trim() || "Publishing"
    : "Publishing";
  return (
    <Link href="/" className="brand-logo group flex items-center gap-2.5">
      <span className={`brand-mark grid h-9 w-9 place-items-center rounded-xl ${inverse ? "bg-white text-forest-900" : "bg-forest-800 text-white"}`}>
        <svg viewBox="0 0 40 40" className="h-6 w-6" fill="none" aria-hidden="true"><path d="M7 9h8c5 0 8 3 8 8v14c-1.8-3-4.8-4.5-9-4.5H7V9Z" stroke="currentColor" strokeWidth="2"/><path d="M33 9h-8c-2 0-3.5.5-5 1.5M33 9v17.5h-7c-4.2 0-7.2 1.5-9 4.5" stroke="currentColor" strokeWidth="2"/><path d="M20 13v18" stroke="currentColor" strokeWidth="2"/></svg>
      </span>
      <span className="brand-copy">
        <span className={`block font-serif text-[.95rem] font-bold leading-none ${inverse ? "text-white" : "text-forest-900"}`}>{SITE_SHORT_NAME}</span>
        <span className={`block text-[.95rem] font-semibold uppercase leading-none tracking-[.12em] ${inverse ? "text-forest-100" : "text-clay-600"}`}>{suffix}</span>
      </span>
      <span className="sr-only">home</span>
    </Link>
  );
}
