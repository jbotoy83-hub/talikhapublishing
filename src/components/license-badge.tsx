import { isOpenAccess, ccType } from "@/lib/citation-format";

export function LicenseBadge({ name, url }: { name: string; url?: string }) {
  const open = isOpenAccess(name);
  const cc = ccType(name);
  const Tag = url ? "a" : "span";
  const props = url ? { href: url, target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Tag {...props} className={`pub-badge ${open ? "pub-badge--open" : "pub-badge--muted"}`} title={name}>
      {open && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
      {cc || name}
    </Tag>
  );
}

export function OpenAccessBadge({ licenseName }: { licenseName: string }) {
  if (!isOpenAccess(licenseName)) return null;
  return <span className="pub-badge pub-badge--oa">Open Access</span>;
}
