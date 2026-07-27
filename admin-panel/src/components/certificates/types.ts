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
  imageShape?: "rectangle" | "circle";
  linkedFieldBold?: boolean;
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
}

export type TextSegment = { t: "s"; v: string; style?: Partial<BlockStyle> } | { t: "f"; k: string; style?: Partial<BlockStyle> };

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
  assetBucket?: string | null;
  assetPath?: string | null;
  imageShape?: "rectangle" | "circle";
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
  fonts?: Array<{ family: string; weight: number; style: string; url: string }>;
}

export interface CertificateRecord {
  id: string;
  templateId: string;
  templateVersion: number;
  publicationId?: string;
  authorId?: string;
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
  { key: "author_name", label: "Author Name", type: "text", required: true, section: "author", placeholder: "First name, middle initial, surname" },
  { key: "author_academic_title", label: "Academic Title", type: "text", required: false, section: "author", placeholder: "LPT, PhD, MAEd" },
  { key: "author_role", label: "Role or Occupation", type: "text", required: false, section: "author", placeholder: "Faculty, Teacher, Assistant Professor" },
  { key: "author_affiliation", label: "Affiliation", type: "text", required: false, section: "author", placeholder: "University or organization" },
  { key: "work_title", label: "Manuscript Title", type: "text", required: true, section: "publication", placeholder: "The full title of the manuscript" },
  { key: "doi", label: "DOI", type: "doi", required: false, section: "publication", placeholder: "10.5281/zenodo.XXXXXXXX", validationRule: "doi" },
  { key: "publication_name", label: "Publication Name", type: "text", required: true, section: "publication", placeholder: "Journal or magazine name" },
  { key: "volume_number", label: "Volume", type: "text", required: false, section: "publication" },
  { key: "issue_number", label: "Issue", type: "text", required: false, section: "publication" },
  { key: "issue_date", label: "Issue Date", type: "text", required: false, section: "publication" },
  { key: "issn_online", label: "ISSN Online", type: "text", required: false, section: "publication" },
  { key: "issn_print", label: "ISSN Print", type: "text", required: false, section: "publication" },
  { key: "date_issued", label: "Date Issued", type: "date", required: true, section: "certificate" },
  { key: "certificate_number", label: "Certificate Number", type: "text", required: true, section: "certificate" },
  { key: "publisher_name", label: "Publisher", type: "text", required: true, section: "certificate" },
  { key: "issuing_city", label: "Issuing City", type: "text", required: false, section: "certificate" },
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
  fontFamily: "Helvetica",
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
  { label: "Helvetica", value: "Helvetica" },
  { label: "Times Roman", value: "Times-Roman" },
  { label: "Courier", value: "Courier" },
  { label: "Oswald", value: "Oswald" },
  { label: "Glacial Indifference", value: "Glacial Indifference" },
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
