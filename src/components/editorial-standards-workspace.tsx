"use client";

import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { SITE_SHORT_NAME } from "@/lib/site";
import { Icon } from "./icon";

const sectionLinks = [
  ["editorialPrinciples", "Core principles"],
  ["editorialReview", "Review process"],
  ["editorialChecklist", "Integrity checklist"],
  ["editorialAppeals", "Questions and appeals"],
] as const;

type SectionId = (typeof sectionLinks)[number][0];

const principles = [
  ["shield", "Editorial independence", "Publication decisions are based on relevance, quality, originality, clarity, ethics, and journal fit. Commercial relationships do not determine acceptance."],
  ["users", "Fair review", "Scholarly work selected for review is evaluated by qualified reviewers. Conflicts and confidentiality are managed explicitly."],
  ["search", "Research integrity", "Authors disclose funding, conflicts, meaningful AI assistance, ethics approval where required, data limitations, and material corrections."],
  ["book", "Originality and rights", "Authors secure permissions and accurately acknowledge sources, collaborators, and any earlier dissemination."],
  ["edit", "Corrections and retractions", "Errors are corrected transparently. Serious reliability, ethics, authorship, rights, safety, or legal concerns may require an explanatory record, restriction, removal, or retraction."],
  ["users", "Accessibility and inclusion", "We value clear language, accessible formats, respectful representation, multilingual work, and participation from writers across the Philippines."],
] as const;

function scrollToEditorialSection(targetId: SectionId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const destination = Math.max(0, window.scrollY + target.getBoundingClientRect().top - (Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0));
  const distance = destination - window.scrollY;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || Math.abs(distance) < 2) {
    window.scrollTo({ top: destination, behavior: "auto" });
  } else {
    const duration = Math.min(320, Math.max(180, 180 + Math.abs(distance) * 0.07));
    const startedAt = performance.now();
    const startY = window.scrollY;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const easedProgress = 1 - (1 - progress) ** 3;
      window.scrollTo(0, startY + distance * easedProgress);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  if (window.location.hash !== `#${targetId}`) window.history.pushState(null, "", `#${targetId}`);
}

function followEditorialSection(event: MouseEvent<HTMLAnchorElement>, targetId: SectionId, onFollow?: (target: SectionId) => void) {
  event.preventDefault();
  onFollow?.(targetId);
  scrollToEditorialSection(targetId);
}

export function EditorialScrollLink({ targetId, children }: { targetId: SectionId; children: ReactNode }) {
  return <a href={`#${targetId}`} onClick={(event) => followEditorialSection(event, targetId)}>{children}</a>;
}

export function EditorialStandardsNavigation() {
  const [activeTarget, setActiveTarget] = useState<SectionId>("editorialPrinciples");

  return <nav className="editorial-standards-nav" aria-label="Editorial standards sections"><div className="section-shell">
    {sectionLinks.map(([targetId, label]) => <a key={targetId} href={`#${targetId}`} aria-current={activeTarget === targetId ? "location" : undefined} onClick={(event) => followEditorialSection(event, targetId, setActiveTarget)}>{label}</a>)}
  </div></nav>;
}

export function EditorialPrinciples() {
  const [openIndex, setOpenIndex] = useState(0);

  return <div className="editorial-principles-grid">{principles.map(([icon, title, copy], index) => {
    const open = openIndex === index;
    const panelId = `editorial-principle-${index + 1}`;
    const buttonId = `${panelId}-button`;
    return <article key={title} className={`editorial-principle${open ? " is-open" : ""}`}>
      <h3><button id={buttonId} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenIndex(open ? -1 : index)}>
        <span><Icon name={icon} className="h-5 w-5" /></span><b>{String(index + 1).padStart(2, "0")}</b><strong>{title}</strong><Icon name="chevron" className="h-4 w-4" />
      </button></h3>
      <div id={panelId} className="editorial-principle-panel" role="region" aria-hidden={!open} aria-labelledby={buttonId}><div><p>{copy}</p></div></div>
    </article>;
  })}</div>;
}

const reviewSteps = [
  ["01", "Editorial screening", "We confirm scope, completeness, originality, disclosures, and basic readiness.", "Journal fit, required files, authorship details, and initial integrity checks."],
  ["02", "Expert evaluation", "Research selected for peer review is assessed by qualified reviewers with conflicts and confidentiality managed explicitly.", "Method, evidence, originality, ethics, clarity, and contribution to the field."],
  ["03", "Decision and revision", "Editors provide a clear decision and consolidated guidance for any required changes.", "A traceable response to editorial or reviewer comments and a clearly revised manuscript."],
  ["04", "Publication check", "Accepted work receives final editing, rights review, accessibility checks, and record preparation.", "Language, permissions, metadata, citations, licenses, and the publication record."],
] as const;

const checklist = [
  "The work is original and every source, quotation, figure, and dataset is properly credited.",
  "All authors and contributors are accurately identified and have approved the submission.",
  "Required ethics approval, consent, permissions, disclosures, and conflict information are ready to share.",
  "The manuscript, figures, references, and contributor details are complete and readable.",
] as const;

export function EditorialStandardsWorkspace() {
  const [selectedStep, setSelectedStep] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(() => checklist.map(() => false));
  const step = reviewSteps[selectedStep];
  const completed = checked.filter(Boolean).length;

  return <>
    <section id="editorialReview" className="editorial-review">
      <div className="section-shell editorial-review-layout">
        <header>
          <p className="editorial-overline">How review works</p>
          <h2>A clear path from submission to publication.</h2>
          <p>Select a stage to see what happens and what the editorial team examines.</p>
        </header>
        <div className="editorial-review-workspace">
          <div className="editorial-review-tabs" role="tablist" aria-label="Editorial review stages">
            {reviewSteps.map(([number, title], index) => <button key={number} type="button" role="tab" aria-selected={selectedStep === index} onClick={() => setSelectedStep(index)} className={selectedStep === index ? "active" : ""}>
              <span>{number}</span><strong>{title}</strong>
            </button>)}
          </div>
          <article className="editorial-review-panel" role="tabpanel">
            <span aria-hidden="true">{step[0]}</span>
            <p>Current stage</p>
            <h3>{step[1]}</h3>
            <strong>{step[2]}</strong>
            <div><small>What we examine</small><p>{step[3]}</p></div>
          </article>
        </div>
      </div>
    </section>
    <section id="editorialChecklist" className="editorial-checklist">
      <div className="section-shell editorial-checklist-layout">
        <header>
          <p className="editorial-overline">Preparation tool</p>
          <h2>Submission integrity checklist</h2>
          <p>Use this private, browser-only checklist to review essential information before editorial screening.</p>
          <div className="editorial-checklist-progress" aria-live="polite">
            <div><span style={{ width: `${(completed / checklist.length) * 100}%` }} /></div>
            <strong>{completed} of {checklist.length} reviewed</strong>
          </div>
        </header>
        <div className="editorial-checklist-items">
          {checklist.map((item, index) => <label key={item}>
            <input type="checkbox" checked={checked[index]} onChange={(event) => setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} />
            <span><Icon name="check" className="h-3.5 w-3.5" /></span>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <strong>{item}</strong>
          </label>)}
          <p>This checklist is not sent or stored by {SITE_SHORT_NAME}.</p>
        </div>
      </div>
    </section>
  </>;
}
