"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function PublicationTools({ citation, title }: { citation: string; title: string }) {
  const [copied, setCopied] = useState<"citation" | "link" | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  async function copy(value: string, kind: "citation" | "link") {
    try {
      await copyText(value);
      setCopied(kind);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
      } catch {
        // Dismissing the native share sheet requires no UI recovery.
      }
      return;
    }
    await copy(window.location.href, "link");
  }

  return (
    <div className="publication-tools" aria-label="Publication tools">
      <button type="button" onClick={() => copy(citation, "citation")}>
        <Icon name={copied === "citation" ? "check" : "file"} className="h-4 w-4" />
        {copied === "citation" ? "Citation copied" : "Copy citation"}
      </button>
      <button type="button" onClick={() => copy(window.location.href, "link")}>
        <Icon name={copied === "link" ? "check" : "external"} className="h-4 w-4" />
        {copied === "link" ? "Link copied" : "Copy link"}
      </button>
      <button type="button" onClick={share}>
        <Icon name="arrow" className="h-4 w-4" /> Share
      </button>
    </div>
  );
}
