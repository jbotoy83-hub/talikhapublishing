import { getPublications } from "@/lib/content";
import { isIndexingEnabled } from "@/lib/launch";
import { absoluteUrl, SITE_DESCRIPTION, SITE_LANGUAGE, SITE_NAME } from "@/lib/site";

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  if (!isIndexingEnabled()) {
    return new Response("Publication feed is unavailable while this site is in preview mode.\n", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  }

  const publications = (await getPublications()).slice(0, 50);
  const items = publications.map((publication) => {
    const url = absoluteUrl(`/publications/${publication.slug}`);
    const modified = new Date(`${publication.modifiedDate}T00:00:00Z`).toUTCString();
    return `<item>
      <title>${xml(publication.title)}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="true">${xml(url)}</guid>
      <pubDate>${modified}</pubDate>
      <description>${xml(publication.abstract || publication.recommendedCitation)}</description>
      <category>${xml(publication.journal.title)}</category>
      ${publication.doi ? `<dc:identifier>${xml(publication.doi)}</dc:identifier>` : ""}
    </item>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xml(SITE_NAME)}</title>
    <link>${xml(absoluteUrl("/"))}</link>
    <description>${xml(SITE_DESCRIPTION)}</description>
    <language>${xml(SITE_LANGUAGE)}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${xml(absoluteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600"
    }
  });
}
