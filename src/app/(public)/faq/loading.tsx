export default function Loading() {
  return <main id="main-content" className="faq-page faq-page-loading" aria-busy="true">
    <span className="sr-only" role="status">Loading frequently asked questions</span>
    <section className="faq-page-loading-hero"><div className="section-shell faq-page-loading-hero-grid"><div><span className="faq-loading-line faq-loading-eyebrow" /><span className="faq-loading-line faq-loading-title" /><span className="faq-loading-line faq-loading-copy" /></div><div className="faq-loading-register" /></div></section>
    <section className="section-shell faq-page-loading-body"><aside><span className="faq-loading-line faq-loading-rail-title" /><span className="faq-loading-line faq-loading-rail-link" /><span className="faq-loading-line faq-loading-rail-link" /><span className="faq-loading-line faq-loading-rail-link" /></aside><div className="faq-loading-items">{Array.from({ length: 6 }, (_, index) => <span className="faq-loading-item" key={index} />)}</div></section>
  </main>;
}
