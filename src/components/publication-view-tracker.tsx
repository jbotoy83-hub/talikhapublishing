"use client";

import { useEffect } from "react";

export function PublicationViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (navigator.webdriver) return;
    if (document.visibilityState !== "visible") return;
    const key = `talikha-viewed:${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    void fetch(`/api/publications/${encodeURIComponent(slug)}/view`, { method: "POST", keepalive: true }).then(() => {
      window.dispatchEvent(new CustomEvent("talikha:publication-viewed", { detail: { slug } }));
    }).catch(() => undefined);
  }, [slug]);

  return null;
}
