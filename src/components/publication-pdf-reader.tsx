"use client";

import dynamic from "next/dynamic";

const PDFViewer = dynamic(
  () => import("@/components/ui/pdf-viewer").then((m) => ({ default: m.PDFViewer })),
  { ssr: false, loading: () => <div className="publication-pdf-reader-loading">Loading full text…</div> }
);

export function PublicationPdfReader({ src, title }: { src: string; title: string }) {
  return (
    <div className="publication-pdf-reader">
      <PDFViewer src={src} fileName={`${title}.pdf`} showDownload={false} showUpload={false} className="h-full w-full" />
    </div>
  );
}
