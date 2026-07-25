"use client";

import { useId, useState } from "react";
import { Icon } from "./icon";

type Faq = readonly [question: string, answer: string];

export function FaqAccordion({ faqs }: { faqs: readonly Faq[] }) {
  const [openIndex, setOpenIndex] = useState(0);
  const id = useId();

  return <div className="faq-accordion">
    {faqs.map(([question, answer], index) => {
      const isOpen = openIndex === index;
      const panelId = `${id}-panel-${index}`;
      return <article key={question} className={`faq-item${isOpen ? " is-open" : ""}`}>
        <h2>
          <button
            type="button"
            className="faq-trigger"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setOpenIndex(isOpen ? -1 : index)}
          >
            <span className="faq-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="faq-question">{question}</span>
            <span className="faq-toggle"><Icon name="chevron" className="h-4 w-4" /></span>
          </button>
        </h2>
        <div id={panelId} className="faq-answer" hidden={!isOpen}>
          <div><p>{answer}</p></div>
        </div>
      </article>;
    })}
  </div>;
}
