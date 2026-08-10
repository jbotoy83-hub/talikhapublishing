import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InboxAttachment } from "./types";

function normalizeContentId(value: string) {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { decoded = value; }
  return decoded.trim().replace(/^<|>$/g, "").toLowerCase();
}

function buildEmailDocument(html: string, attachments: InboxAttachment[]) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const inlineByContentId = new Map(attachments.filter((attachment) => attachment.content_id).map((attachment) => [normalizeContentId(attachment.content_id || ""), attachment]));
  document.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src") || "";
    if (src.toLowerCase().startsWith("cid:")) {
      const attachment = inlineByContentId.get(normalizeContentId(src.slice(4)));
      if (attachment) image.setAttribute("src", `/api/admin/inbox/attachments/${attachment.id}?inline=1`);
      else image.replaceWith(document.createTextNode(image.alt ? `[Image: ${image.alt}]` : "[Embedded image unavailable]"));
    }
    const remoteSource = image.getAttribute("data-remote-src");
    if (remoteSource) image.setAttribute("src", `/api/admin/inbox/remote-image?url=${encodeURIComponent(remoteSource)}`);
  });
  document.querySelectorAll("a").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });
  const csp = document.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content = "default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  document.head.prepend(csp);
  const styles = document.createElement("style");
  styles.textContent = "html{background:transparent}body{min-width:0;overflow-wrap:anywhere}img{max-width:100%;height:auto}img[data-remote-image]:not([src]){display:none}table{max-width:100%}pre{max-width:100%;overflow:auto;white-space:pre-wrap}a{cursor:pointer}";
  document.head.append(styles);
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

export function EmailHtmlFrame({ html, attachments, title }: { html: string; attachments: InboxAttachment[]; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const source = useMemo(() => buildEmailDocument(html, attachments), [attachments, html]);
  const measure = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (!document) return;
    const next = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0, 80);
    setHeight(Math.min(next + 2, 3600));
  }, []);

  useEffect(() => {
    const document = frameRef.current?.contentDocument;
    if (!document?.body) return;
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    const timer = window.setTimeout(measure, 120);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [measure, source]);

  return <iframe ref={frameRef} className="mail-html-frame" title={title} srcDoc={source} style={{ height }} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" onLoad={measure} />;
}
