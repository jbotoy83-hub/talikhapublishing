"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Publication } from "@/lib/types";
import { formatApa, formatMla, formatChicago, formatBibtex, formatRis } from "@/lib/citation-format";

const TABS = ["APA", "MLA", "Chicago"] as const;
type Tab = (typeof TABS)[number];

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CitationPanel({ publication }: { publication: Publication }) {
  const [tab, setTab] = useState<Tab>("APA");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const formatted = tab === "APA" ? formatApa(publication) : tab === "MLA" ? formatMla(publication) : formatChicago(publication);

  const flash = useCallback(() => {
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1800);
  }, []);

  async function copyCitation() {
    try { await navigator.clipboard.writeText(formatted); flash(); } catch {}
  }

  const slug = publication.slug;

  return (
    <div className="cite-panel">
      <div className="cite-tabs" role="tablist" aria-label="Citation format">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`cite-tab${tab === t ? " cite-tab--active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
        <span className="cite-tab-indicator" style={{ transform: `translateX(${TABS.indexOf(tab) * 100}%)` }} aria-hidden="true" />
      </div>
      <div className="cite-body">
        <blockquote className="cite-text">{formatted}</blockquote>
        <div className="cite-actions">
          <button type="button" className="cite-copy" onClick={copyCitation}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{copied ? <path d="M20 6 9 17l-5-5"/> : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>}</svg>
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="cite-export" onClick={() => downloadFile(formatBibtex(publication), `${slug}.bib`, "application/x-bibtex")}>BibTeX</button>
          <button type="button" className="cite-export" onClick={() => downloadFile(formatRis(publication), `${slug}.ris`, "application/x-research-info-systems")}>RIS</button>
        </div>
      </div>
    </div>
  );
}
