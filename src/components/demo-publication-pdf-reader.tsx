"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(
  () => import("@/components/ui/pdf-viewer").then((m) => ({ default: m.PDFViewer })),
  { ssr: false, loading: () => <div className="publication-pdf-reader-loading">Loading full text…</div> }
);

const SAMPLE_PDF_BASE64 =
  "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";

export function DemoPublicationPdfReader({ title }: { title: string }) {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const binary = atob(SAMPLE_PDF_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, []);

  return (
    <div className="publication-pdf-reader">
      {url ? (
        <PDFViewer src={url} fileName={`${title}.pdf`} showDownload={false} showUpload={false} className="h-full w-full" />
      ) : (
        <div className="publication-pdf-reader-loading">Loading full text…</div>
      )}
    </div>
  );
}
