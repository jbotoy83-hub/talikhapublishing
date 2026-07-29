import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Publication preview",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default async function PublicationPreviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  await requireAdmin();
  const { submissionId } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  const { data: record } = await admin
    .from("publication_records")
    .select("id,doi,final_pdf_file_id,metadata,publications(id,title,abstract,author_display,volume,issue_number,pages,keywords,license_name,copyright_holder,recommended_citation,status,journals(title,slug),publication_authors(position,authors(name,slug)))")
    .eq("submission_id", submissionId)
    .maybeSingle();
  const publication = Array.isArray(record?.publications) ? record.publications[0] : record?.publications;
  if (!record || !publication || publication.status !== "draft") notFound();
  const journal = Array.isArray(publication.journals) ? publication.journals[0] : publication.journals;
  const authors = (publication.publication_authors || [])
    .sort((left, right) => left.position - right.position)
    .map((link) => Array.isArray(link.authors) ? link.authors[0] : link.authors)
    .filter(Boolean);
  return (
    <main id="main-content" className="publication-detail-page" style={{ paddingTop: 46 }}>
      <div style={{ position: "fixed", inset: "0 0 auto", zIndex: 1000, background: "#8f3d31", color: "white", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
        <strong>Preview only — this publication is private and not public</strong>
        <Link href={`/admin?view=production&submission=${submissionId}`} style={{ color: "white", textDecoration: "underline" }}>Return to production</Link>
      </div>
      <article>
        <header className={`publication-detail-hero publication-detail-hero-${journal?.slug || "preview"}`}>
          <div className="section-shell publication-detail-hero-grid">
            <div className="publication-detail-hero-copy">
              <nav className="publication-breadcrumbs" aria-label="Breadcrumb"><span>Admin</span><span aria-hidden="true">/</span><span>Protected preview</span></nav>
              <p className="publication-detail-type">Draft scholarly article</p>
              <h1>{publication.title}</h1>
              {(publication.volume || publication.issue_number || publication.pages) && <p className="publication-detail-pages">{publication.volume ? `Vol. ${publication.volume}` : ""}{publication.issue_number ? `${publication.volume ? ", " : ""}No. ${publication.issue_number}` : ""}{publication.pages ? `${publication.volume || publication.issue_number ? " · " : ""}pp. ${publication.pages}` : ""}</p>}
              <p className="publication-detail-byline">{authors.length ? authors.map((author, index) => <span key={`${author?.slug}-${index}`}>{index > 0 && ", "}{author?.name}</span>) : publication.author_display}</p>
            </div>
            <aside className="publication-detail-folio" aria-label="Journal summary"><p>Prepared for</p><strong>{journal?.title || "Journal pending"}</strong>{(publication.volume || publication.issue_number) && <span>{publication.volume ? `Volume ${publication.volume}` : ""}{publication.issue_number ? `${publication.volume ? " · " : ""}Issue ${publication.issue_number}` : ""}</span>}</aside>
          </div>
        </header>
        <div className="section-shell publication-detail-layout">
          <div className="publication-detail-main">
            <section className="publication-abstract-panel article-prose"><p className="eyebrow">Abstract</p><p className="article-abstract">{publication.abstract || "Abstract not supplied."}</p></section>
            {record.final_pdf_file_id && <section className="publication-abstract-panel"><p className="eyebrow">Selected final PDF</p><a href={`/api/admin/files/${record.final_pdf_file_id}?stream=1`} target="_blank" rel="noreferrer">Open the exact private final PDF</a></section>}
          </div>
          <aside className="publication-detail-sidebar">
            <section className="article-rights-panel"><div className="publication-panel-heading">Publication record</div><div className="rights-row"><span>DOI</span><strong>{record.doi || "Not assigned"}</strong></div><div className="rights-row"><span>License</span><strong>{publication.license_name || "Not set"}</strong></div><div className="rights-row"><span>Copyright</span><strong>{publication.copyright_holder || "Not set"}</strong></div></section>
          </aside>
        </div>
        <section className="publication-about-section"><div className="section-shell"><header><p className="eyebrow">Recommended citation</p><h2>Final public record</h2></header><p>{publication.recommended_citation || "Citation has not been generated."}</p>{publication.keywords?.length ? <div className="publication-about-keywords"><h3>Keywords</h3><div>{publication.keywords.map((keyword: string) => <span key={keyword}>{keyword}</span>)}</div></div> : null}</div></section>
      </article>
    </main>
  );
}
