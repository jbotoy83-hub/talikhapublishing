import { isOpenAccess } from "@/lib/citation-format";

export function OpenAccessBadge({ licenseName }: { licenseName: string }) {
  if (!isOpenAccess(licenseName)) return null;
  return <span className="pub-badge pub-badge--oa">Open Access</span>;
}
