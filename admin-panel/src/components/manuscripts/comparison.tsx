import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "@/components/icons";
import type { ComparisonFinding, ManuscriptSourceParagraph } from "./types";
import { normalizeManuscriptText } from "./types";
import { OriginalManuscriptViewer } from "./original-viewer";

function normalized(value: string) {
  return normalizeManuscriptText(value).toLocaleLowerCase();
}

export function compareManuscriptParagraphs(source: ManuscriptSourceParagraph[], convertedText: string): ComparisonFinding[] {
  const converted = convertedText.replace(/\r\n?/g, "\n").split(/\n+/).map((text) => text.trim()).filter(Boolean);
  const findings: ComparisonFinding[] = [];
  let sourceIndex = 0;
  let editorIndex = 0;
  const lookahead = 8;
  while (sourceIndex < source.length || editorIndex < converted.length) {
    const sourceText = source[sourceIndex]?.text || "";
    const editorText = converted[editorIndex] || "";
    if (sourceIndex < source.length && editorIndex < converted.length && normalized(sourceText) === normalized(editorText)) {
      sourceIndex += 1;
      editorIndex += 1;
      continue;
    }
    if (sourceIndex >= source.length) {
      findings.push({ id: `extra-${editorIndex}`, kind: "extra", editorIndex, editorText });
      editorIndex += 1;
      continue;
    }
    if (editorIndex >= converted.length) {
      findings.push({ id: `missing-${sourceIndex}`, kind: "missing", sourceIndex, sourceText });
      sourceIndex += 1;
      continue;
    }
    const sourceMatch = converted.slice(editorIndex + 1, editorIndex + lookahead + 1).findIndex((text) => normalized(text) === normalized(sourceText));
    const editorMatch = source.slice(sourceIndex + 1, sourceIndex + lookahead + 1).findIndex((paragraph) => normalized(paragraph.text) === normalized(editorText));
    if (sourceMatch >= 0 && (editorMatch < 0 || sourceMatch <= editorMatch)) {
      findings.push({ id: `extra-${editorIndex}`, kind: "extra", editorIndex, editorText });
      editorIndex += 1;
    } else if (editorMatch >= 0) {
      findings.push({ id: `missing-${sourceIndex}`, kind: "missing", sourceIndex, sourceText });
      sourceIndex += 1;
    } else {
      findings.push({ id: `changed-${sourceIndex}-${editorIndex}`, kind: "changed", sourceIndex, editorIndex, sourceText, editorText });
      sourceIndex += 1;
      editorIndex += 1;
    }
  }
  return findings;
}

function FindingCard({ finding, active, onSelect }: { finding: ComparisonFinding; active: boolean; onSelect: () => void }) {
  return <button type="button" className={`me-finding ${active ? "is-active" : ""}`} onClick={onSelect}>
    <span className={`me-finding-kind is-${finding.kind}`}>{finding.kind}</span>
    {finding.sourceText ? <span><small>Original</small>{finding.sourceText}</span> : null}
    {finding.editorText ? <span><small>Converted</small>{finding.editorText}</span> : null}
  </button>;
}

export function ManuscriptComparison({ sourceBlob, fileName, mimeType, sourceParagraphs, convertedText }: {
  sourceBlob: Blob | null;
  fileName: string;
  mimeType: string;
  sourceParagraphs: ManuscriptSourceParagraph[];
  convertedText: string;
}) {
  const findings = useMemo(() => compareManuscriptParagraphs(sourceParagraphs, convertedText), [sourceParagraphs, convertedText]);
  const [active, setActive] = useState(0);
  const selected = findings[active];
  const page = selected?.sourceIndex === undefined ? undefined : sourceParagraphs[selected.sourceIndex]?.page;
  return <div className="me-compare-workspace">
    <div className="me-compare-summary">
      <div><strong>{findings.length}</strong><span>differences</span></div>
      <div><strong>{findings.filter((finding) => finding.kind === "missing").length}</strong><span>missing</span></div>
      <div><strong>{findings.filter((finding) => finding.kind === "extra").length}</strong><span>extra</span></div>
      <div><strong>{findings.filter((finding) => finding.kind === "changed").length}</strong><span>changed</span></div>
      {findings.length ? <div className="me-compare-pager"><button type="button" aria-label="Previous difference" onClick={() => setActive((value) => Math.max(0, value - 1))} disabled={active === 0}><ChevronLeft size={16} /></button><span>{active + 1} / {findings.length}</span><button type="button" aria-label="Next difference" onClick={() => setActive((value) => Math.min(findings.length - 1, value + 1))} disabled={active === findings.length - 1}><ChevronRight size={16} /></button></div> : null}
    </div>
    <div className={`me-compare-grid ${findings.length ? "has-findings" : "is-clear"}`}>
      <section className="me-compare-source"><header><span>Original</span>{page ? <small>Source page {page}</small> : null}</header>{sourceBlob ? <OriginalManuscriptViewer blob={sourceBlob} fileName={fileName} mimeType={mimeType} page={page} /> : <div className="me-empty-inline">Load the original to compare.</div>}</section>
      <section className="me-compare-converted"><header><span>Converted text</span><small>Paragraph structure</small></header><div className="me-converted-pages">{sourceParagraphs.map((paragraph) => {
        const finding = findings.find((item) => item.sourceIndex === paragraph.index);
        return <p key={paragraph.index} className={finding ? `is-${finding.kind}` : ""} data-page={paragraph.page}><small>¶ {paragraph.index + 1}{paragraph.page ? ` · p. ${paragraph.page}` : ""}</small>{finding?.editorText ?? paragraph.text}</p>;
      })}</div></section>
      <aside className="me-findings-list">{findings.length ? findings.map((finding, index) => <FindingCard key={finding.id} finding={finding} active={index === active} onSelect={() => setActive(index)} />) : <div className="me-compare-clear"><span>✓</span><strong>No paragraph differences detected</strong><p>Text still requires the manual visual checklist before finalization.</p></div>}</aside>
    </div>
    {findings.length ? <div className="me-compare-note"><AlertTriangle size={16} />Automatic comparison assists review; it does not replace checking the immutable original.</div> : null}
  </div>;
}
