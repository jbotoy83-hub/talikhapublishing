"use client";

import { useId, useState } from "react";
import { Icon } from "./icon";

export type FaqItem = Readonly<{
  id: string;
  groupId: string;
  category: string;
  question: string;
  answer: string;
}>;

export type FaqGroup = Readonly<{
  id: string;
  label: string;
  description: string;
}>;

export function FaqAccordion({ faqs, groups }: { faqs: readonly FaqItem[]; groups: readonly FaqGroup[] }) {
  const [openId, setOpenId] = useState(faqs[0]?.id || "");
  const instanceId = useId().replace(/:/g, "");

  return <div className="faq-page-accordion">
    {groups.map((group) => {
      const groupFaqs = faqs.filter((faq) => faq.groupId === group.id);
      if (!groupFaqs.length) return null;
      return <section className="faq-page-group" id={group.id} aria-labelledby={`${instanceId}-${group.id}-heading`} key={group.id}>
        <header className="faq-page-group-heading">
          <div><p>Editorial path</p><h2 id={`${instanceId}-${group.id}-heading`}>{group.label}</h2></div>
          <span>{group.description}</span>
        </header>
        <div className="faq-page-items">
          {groupFaqs.map((faq) => {
            const isOpen = openId === faq.id;
            const triggerId = `${instanceId}-${faq.id}-trigger`;
            const panelId = `${instanceId}-${faq.id}-panel`;
            const number = String(faqs.findIndex((item) => item.id === faq.id) + 1).padStart(2, "0");
            return <article className={`faq-page-item${isOpen ? " is-open" : ""}`} key={faq.id}>
              <h3>
                <button id={triggerId} type="button" className="faq-page-trigger" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenId(isOpen ? "" : faq.id)}>
                  <span className="faq-page-number" aria-hidden="true">{number}</span>
                  <span className="faq-page-question-copy"><span className="faq-page-question-category">{faq.category}</span><span className="faq-page-question">{faq.question}</span></span>
                  <span className="faq-page-toggle" aria-hidden="true"><Icon name="chevron" className="h-4 w-4" /></span>
                </button>
              </h3>
              <div id={panelId} className="faq-page-answer" role="region" aria-labelledby={triggerId} aria-hidden={!isOpen}>
                <div><p>{faq.answer}</p></div>
              </div>
            </article>;
          })}
        </div>
      </section>;
    })}
  </div>;
}
