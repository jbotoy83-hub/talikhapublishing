export type Journal = {
  id: string;
  slug: string;
  title: string;
  description: string;
  scope: string;
  issn: string;
  heroImage: string;
  accent: string;
};

export type Author = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  affiliation?: string;
  credentials?: string;
  orcid?: string;
  imageUrl?: string;
};

export type Publication = {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  keywords: string[];
  journal: Journal;
  authors: Author[];
  authorDisplay: string;
  publicationDate: string;
  publicationDatePrecision: "day" | "year";
  modifiedDate: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  pdfUrl?: string;
  recommendedCitation: string;
  licenseName: string;
  licenseUrl: string;
  copyrightHolder: string;
  featured: boolean;
  contentType: "research" | "creative" | "commentary";
  views: number;
  downloads: number;
};
