import type { MetadataRoute } from "next";
import { isAiTrainingAllowed, isIndexingEnabled } from "@/lib/launch";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  if (!isIndexingEnabled()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
      host: siteUrl
    };
  }

  const privatePaths = ["/admin/", "/api/"];
  const aiTrainingRule = isAiTrainingAllowed()
    ? { userAgent: "GPTBot", allow: "/", disallow: privatePaths }
    : { userAgent: "GPTBot", disallow: "/" };

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: privatePaths },
      { userAgent: "ChatGPT-User", allow: "/", disallow: privatePaths },
      aiTrainingRule,
      { userAgent: "PerplexityBot", allow: "/", disallow: privatePaths },
      { userAgent: "Claude-SearchBot", allow: "/", disallow: privatePaths },
      { userAgent: "Googlebot", allow: "/", disallow: privatePaths },
      { userAgent: "Bingbot", allow: "/", disallow: privatePaths }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
