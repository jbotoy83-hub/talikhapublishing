"use client";

import { useState } from "react";
import { SITE_SHORT_NAME } from "@/lib/site";
import { Icon } from "./icon";

const questions = [
  ["What kinds of work do you publish?", "We publish peer-reviewed research, informed articles and essays, poetry, fiction, creative nonfiction, books, and selected institutional publications. Each journal has its own scope and submission requirements."],
  ["Do authors retain copyright?", `Our default approach allows authors to retain copyright while granting ${SITE_SHORT_NAME} the rights required to edit, publish, archive, and promote accepted work.`],
  ["How long does review take?", "Initial editorial screening normally takes 10 to 15 working days. Peer-reviewed research may require 8 to 12 weeks depending on reviewer availability and revision rounds."],
  ["Are there publication fees?", "Submitting work is free. Any optional or required service fee is disclosed before an author commits to publication. We do not use hidden fees."]
] as const;

export function HomeFaq() {
  const [open, setOpen] = useState(0);
  return <div className="faq-accordion" data-faq-accordion>{questions.map(([question, answer], index) => <article key={question} className={`faq-item ${open === index ? "is-open" : ""}`}><h3><button type="button" className="faq-trigger" onClick={()=>setOpen(open === index ? -1 : index)} aria-expanded={open === index}><span className="faq-number">{String(index + 1).padStart(2,"0")}</span><span className="faq-question">{question}</span><span className="faq-toggle" aria-hidden="true"><Icon name="chevron" className="h-4 w-4"/></span></button></h3><div className="faq-answer" aria-hidden={open !== index}><div><p>{answer}</p></div></div></article>)}</div>;
}
