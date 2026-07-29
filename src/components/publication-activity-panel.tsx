"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

export function PublicationActivityPanel({ slug, views, downloads, pdfUrl }: { slug: string; views: number; downloads: number; pdfUrl?: string }) {
  const [liveViews, setLiveViews] = useState(() => views);
  const [liveDownloads, setLiveDownloads] = useState(() => downloads);

  useEffect(() => {
    const onViewed = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string }>).detail;
      if (detail?.slug === slug) setLiveViews((value) => value + 1);
    };
    window.addEventListener("talikha:publication-viewed", onViewed);
    return () => window.removeEventListener("talikha:publication-viewed", onViewed);
  }, [slug]);

  return <section className="publication-access-panel publication-activity-panel"><div className="publication-activity-heading"><span className="publication-activity-icon"><Icon name="eye" className="h-4 w-4" /></span><span className="publication-activity-label">Publication reach</span></div><div className="publication-activity-metrics" aria-label="Publication analytics"><div><span>Views</span><strong>{liveViews.toLocaleString("en-PH")}</strong><small>all time</small></div><div><span>Downloads</span><strong>{liveDownloads.toLocaleString("en-PH")}</strong><small>all time</small></div></div><div className="publication-activity-action">{pdfUrl ? <a href={pdfUrl} target="_blank" rel="noopener noreferrer" onClick={() => setLiveDownloads((value) => value + 1)}><Icon name="file" className="h-4 w-4" /> Download publication</a> : <p>The full-text PDF for this record is not available yet.</p>}</div></section>;
}
