import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "@/components/icons";

export function OriginalManuscriptViewer({ blob, fileName, mimeType, page }: { blob: Blob; fileName: string; mimeType: string; page?: number }) {
  const docxContainer = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(fileName);
  const pdfUrl = useMemo(() => isPdf ? URL.createObjectURL(blob) : "", [blob, isPdf]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  useEffect(() => {
    if (isPdf || !docxContainer.current) return;
    let cancelled = false;
    const container = docxContainer.current;
    container.replaceChildren();
    setError("");
    setRendering(true);
    void import("docx-preview").then(async ({ renderAsync }) => {
      if (cancelled) return;
      await renderAsync(await blob.arrayBuffer(), container, undefined, { className: "me-source-docx", breakPages: true, ignoreLastRenderedPageBreak: false, useBase64URL: true, renderHeaders: true, renderFooters: true, renderFootnotes: true });
      if (!cancelled) setRendering(false);
    }).catch(() => {
      if (!cancelled) {
        setRendering(false);
        setError("The original Word preview could not be rendered. The secure source remains downloadable.");
      }
    });
    return () => { cancelled = true; };
  }, [blob, isPdf]);

  if (isPdf) return <iframe className="me-source-pdf" src={`${pdfUrl}#page=${page || 1}&view=FitH&toolbar=0`} title={`Original manuscript: ${fileName}`} />;
  return <div className="me-source-docx-wrap">{error ? <div className="me-viewer-error"><AlertTriangle size={18} />{error}</div> : rendering ? <div className="me-viewer-loading"><RefreshCw size={18} />Rendering the original…</div> : null}<div ref={docxContainer} className="me-source-docx-container" /></div>;
}
