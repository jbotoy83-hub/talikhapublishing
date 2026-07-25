type SkeletonVariant = "home" | "listing" | "detail" | "editorial" | "submission" | "admin";

function Block({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`page-skeleton-block ${className}`} />;
}

function Lines({ count = 3, className = "" }: { count?: number; className?: string }) {
  return <div className={`page-skeleton-lines ${className}`} aria-hidden="true">{Array.from({ length: count }, (_, index) => <Block key={index} />)}</div>;
}

function CardGrid({ count = 3 }: { count?: number }) {
  return <div className="page-skeleton-card-grid" aria-hidden="true">{Array.from({ length: count }, (_, index) => <article className="page-skeleton-card" key={index}><Block className="page-skeleton-image" /><div><Block className="page-skeleton-overline" /><Block className="page-skeleton-card-title" /><Lines count={2} /></div></article>)}</div>;
}

function Hero() {
  return <section className="page-skeleton-hero"><div className="section-shell page-skeleton-hero-inner"><div><Block className="page-skeleton-overline" /><Block className="page-skeleton-title page-skeleton-title-large" /><Block className="page-skeleton-title page-skeleton-title-medium" /><Lines count={2} className="page-skeleton-hero-copy" /></div><Block className="page-skeleton-hero-aside" /></div></section>;
}

export function PageSkeleton({ variant }: { variant: SkeletonVariant }) {
  if (variant === "home") return <main id="main-content" className="page-skeleton page-skeleton-home" aria-busy="true"><span className="sr-only" role="status">Loading page</span><Hero /><section className="section-shell page-skeleton-section"><div className="page-skeleton-stats">{Array.from({ length: 4 }, (_, index) => <Block key={index} />)}</div><Block className="page-skeleton-overline" /><Block className="page-skeleton-title page-skeleton-section-title" /><CardGrid /></section></main>;

  if (variant === "detail") return <main id="main-content" className="page-skeleton page-skeleton-detail" aria-busy="true"><span className="sr-only" role="status">Loading publication details</span><Hero /><section className="section-shell page-skeleton-detail-layout"><article className="page-skeleton-reading-panel"><Block className="page-skeleton-overline" /><Lines count={10} className="page-skeleton-reading-copy" /></article><aside><div className="page-skeleton-side-card"><Block className="page-skeleton-overline" /><Lines count={4} /></div><div className="page-skeleton-side-card"><Block className="page-skeleton-overline" /><Lines count={3} /></div></aside></section></main>;

  if (variant === "submission") return <main id="main-content" className="page-skeleton page-skeleton-submission" aria-busy="true"><span className="sr-only" role="status">Loading submission workspace</span><Hero /><section className="section-shell page-skeleton-submission-layout"><aside><Lines count={4} /></aside><article className="page-skeleton-form-card"><div className="page-skeleton-step-row">{Array.from({ length: 4 }, (_, index) => <Block key={index} />)}</div><Block className="page-skeleton-title page-skeleton-section-title" /><div className="page-skeleton-fields">{Array.from({ length: 5 }, (_, index) => <Block key={index} />)}</div></article></section></main>;

  if (variant === "admin") return <main id="main-content" className="page-skeleton page-skeleton-admin" aria-busy="true"><span className="sr-only" role="status">Loading protected workspace</span><section className="page-skeleton-admin-header"><div className="section-shell"><Block className="page-skeleton-title page-skeleton-section-title" /><Lines count={1} /></div></section><section className="section-shell page-skeleton-section"><div className="page-skeleton-stats">{Array.from({ length: 3 }, (_, index) => <Block key={index} />)}</div><div className="page-skeleton-table">{Array.from({ length: 6 }, (_, index) => <Block key={index} />)}</div></section></main>;

  if (variant === "editorial") return <main id="main-content" className="page-skeleton page-skeleton-editorial" aria-busy="true"><span className="sr-only" role="status">Loading page</span><Hero /><section className="section-shell page-skeleton-editorial-layout"><div><Block className="page-skeleton-overline" /><Block className="page-skeleton-title page-skeleton-section-title" /><Lines count={7} className="page-skeleton-reading-copy" /></div><aside><Block className="page-skeleton-image" /><Lines count={3} /></aside></section></main>;

  return <main id="main-content" className="page-skeleton page-skeleton-listing" aria-busy="true"><span className="sr-only" role="status">Loading page</span><Hero /><section className="section-shell page-skeleton-section"><div className="page-skeleton-filter-row"><Block /><Block /><Block /></div><CardGrid count={6} /></section></main>;
}
