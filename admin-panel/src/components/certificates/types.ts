export type CertificateStatus = "draft" | "ready" | "approved" | "issued" | "revoked";
export type WorkspaceMode = "builder" | "generator";
export type TextTransform = "none" | "uppercase" | "lowercase" | "titlecase";
export type OverflowBehavior = "keep" | "auto_fit" | "auto_height" | "manual";
export type BlockType = "text" | "image" | "qr" | "shape" | "line" | "seal" | "signature" | "logo";
export type PageType = "certificate" | "authorship" | "publication" | "recognition" | "social_media" | "citation";
export type RightTab = "data" | "fields" | "layers" | "page" | "validation" | "export";

export interface CertificateField {
  key: string;
  label: string;
  type: "text" | "date" | "doi" | "number" | "url";
  required: boolean;
  section: "author" | "publication" | "certificate";
  placeholder?: string;
  defaultValue?: string;
  validationRule?: string;
}

export interface LinkedFieldInstance {
  blockId: string;
  pageId: string;
  fieldKey: string;
  prefix?: string;
  suffix?: string;
  textTransform?: TextTransform;
}

export interface BlockStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  color: string;
  textAlign: "left" | "center" | "right" | "justify";
  lineHeight: number;
  letterSpacing: number;
  textDecoration: string;
  textTransform: TextTransform;
  backgroundColor: string;
  opacity: number;
  borderRadius: number;
  padding: number;
  objectFit?: "contain" | "cover" | "fill" | "none";
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: "none" | "solid" | "dashed" | "dotted";
  shadow?: string;
}

export type TextSegment = { t: "s"; v: string; style?: Partial<BlockStyle> } | { t: "f"; k: string };

export interface CertificateBlock {
  id: string;
  pageId: string;
  type: BlockType;
  content: string;
  segments?: TextSegment[];
  linkedFieldKey: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  style: BlockStyle;
  overflowBehavior: OverflowBehavior;
  locked: boolean;
  hidden: boolean;
  name: string;
  assetUrl?: string;
  prefix?: string;
  suffix?: string;
  minFontSize?: number;
  autoFitWarning?: string;
}

export interface CertificatePage {
  id: string;
  pageNumber: number;
  name: string;
  pageType: PageType;
  width: number;
  height: number;
  backgroundImageUrl?: string;
  backgroundPdfPage?: number;
  safeMargin: number;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  publication: string;
  version: number;
  status: CertificateStatus;
  pages: CertificatePage[];
  fields: CertificateField[];
  blocks: CertificateBlock[];
  createdAt: string;
  updatedAt: string;
  certificateNumberPrefix: string;
  certificateNumberSequence: number;
  certificateNumberYear: number;
}

export interface CertificateRecord {
  id: string;
  templateId: string;
  templateVersion: number;
  submissionId?: string;
  reference?: string;
  fieldValues: Record<string, string>;
  status: CertificateStatus;
  certificateNumber: string;
  issuedAt?: string;
  issuedBy?: string;
  createdAt: string;
  updatedAt: string;
  blocks?: CertificateBlock[];
  snapshot?: {
    templateName: string;
    fieldValues: Record<string, string>;
    certificateNumber: string;
    dateIssued: string;
    issuedBy: string;
  };
}

export interface ValidationCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "error";
  message: string;
  pageId?: string;
  blockId?: string;
}

export interface ValidationResult {
  checks: ValidationCheck[];
  errors: number;
  warnings: number;
  passed: number;
  canExport: boolean;
}

export const DEFAULT_FIELDS: CertificateField[] = [
  { key: "author_name", label: "Author Name", type: "text", required: true, section: "author", placeholder: "Full name with credentials" },
  { key: "position", label: "Position", type: "text", required: false, section: "author", placeholder: "Assistant Professor IV" },
  { key: "institution", label: "Institution", type: "text", required: false, section: "author", placeholder: "University or organization name" },
  { key: "location", label: "Address", type: "text", required: false, section: "author", placeholder: "City, Province, Country" },
  { key: "work_title", label: "Article Title", type: "text", required: true, section: "publication", placeholder: "The full title of the article" },
  { key: "doi", label: "DOI", type: "doi", required: false, section: "publication", placeholder: "10.5281/zenodo.XXXXXXXX", validationRule: "doi" },
  { key: "publication_name", label: "Publication Name", type: "text", required: true, section: "publication", placeholder: "Journal or magazine name" },
  { key: "volume", label: "Volume", type: "text", required: false, section: "publication" },
  { key: "issue", label: "Issue", type: "text", required: false, section: "publication" },
  { key: "pub_month", label: "Publication Month", type: "text", required: false, section: "publication", placeholder: "e.g. January 2026" },
  { key: "date_issued", label: "Date Issued", type: "date", required: true, section: "certificate" },
  { key: "certificate_number", label: "Certificate Number", type: "text", required: true, section: "certificate" },
];

export const DEFAULT_PAGE_NAMES: { name: string; type: PageType }[] = [
  { name: "Author Certificate", type: "certificate" },
  { name: "Citation Card", type: "citation" },
  { name: "Recognition Certificate", type: "recognition" },
  { name: "Publication Confirmation", type: "publication" },
  { name: "DOI Certificate", type: "certificate" },
  { name: "Social Media Announcement", type: "social_media" },
];

export const DEFAULT_BLOCK_STYLE: BlockStyle = {
  fontFamily: "Georgia, serif",
  fontSize: 14,
  fontWeight: 400,
  fontStyle: "normal",
  color: "#1c2821",
  textAlign: "left",
  lineHeight: 1.5,
  letterSpacing: 0,
  textDecoration: "none",
  textTransform: "none",
  backgroundColor: "transparent",
  opacity: 1,
  borderRadius: 0,
  padding: 4,
  objectFit: "contain",
  borderWidth: 0,
  borderColor: "#000000",
  borderStyle: "none",
  shadow: "none",
};

export const CERT_FONTS: { label: string; value: string }[] = [
  { label: "Glacial Indifference", value: "'Glacial Indifference', 'Helvetica Neue', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Lora", value: "Lora, serif" },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Raleway", value: "Raleway, sans-serif" },
  { label: "Open Sans", value: "'Open Sans', sans-serif" },
  { label: "Oswald", value: "Oswald, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

export const FONT_SIZE_PRESETS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48, 56, 64, 72, 84, 96, 108, 120, 144];

export const CANVAS_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "A4 Landscape", width: 842, height: 595 },
  { label: "A4 Portrait", width: 595, height: 842 },
  { label: "Letter Landscape", width: 792, height: 612 },
  { label: "Letter Portrait", width: 612, height: 792 },
  { label: "Legal Landscape", width: 1008, height: 612 },
  { label: "Square (1080×1080)", width: 1080, height: 1080 },
  { label: "Social (1200×630)", width: 1200, height: 630 },
  { label: "Story (1080×1920)", width: 1080, height: 1920 },
];

export const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
export const A4_PORTRAIT = { width: 595.28, height: 841.89 };

export const STORAGE_KEYS = {
  templates: "talikha-cert-templates-v2",
  records: "talikha-cert-records-v2",
  layout: (id: string) => `talikha-cert-layout-${id}-v2`,
  assets: "talikha-cert-assets-v2",
};
