export function DoiBadge({ doi }: { doi?: string }) {
  if (!doi) return <span className="pub-badge pub-badge--muted">DOI pending</span>;
  const url = `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="pub-badge pub-badge--doi" title={`Resolve DOI: ${doi}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      DOI
    </a>
  );
}
