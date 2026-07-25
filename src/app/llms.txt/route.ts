import { isIndexingEnabled } from "@/lib/launch";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export function GET() {
  if (!isIndexingEnabled()) {
    return new Response("AI discovery information is unavailable while this site is in preview mode.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow, noarchive" }
    });
  }
  const siteUrl = getSiteUrl();
  const body = `# ${SITE_NAME}

${SITE_DESCRIPTION}

## Canonical collections

- Journals: ${siteUrl}/journals
- Publications: ${siteUrl}/publications
- Authors: ${siteUrl}/authors
- Editorial standards: ${siteUrl}/editorial-standards
- Submission guidance: ${siteUrl}/submit
- XML sitemap: ${siteUrl}/sitemap.xml

## Citation guidance

Use each publication page's recommended citation and DOI. Author names, DOI records, dates, journal volume/issue data, and licenses should be quoted exactly as shown on the publication page.

## Access guidance

Public journal, publication, author, policy, and informational pages may be crawled and indexed. Admin, authentication, API, and private submission-file routes must not be crawled, indexed, or treated as public sources.
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400"
    }
  });
}
