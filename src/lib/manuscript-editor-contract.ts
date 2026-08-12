export type ManuscriptJson = null | boolean | number | string | ManuscriptJson[] | { [key: string]: ManuscriptJson };

export type ManuscriptEditorState = {
  root: {
    children: ManuscriptJson[];
    direction: "ltr" | "rtl" | null;
    format: string;
    indent: number;
    type: "root";
    version: number;
  };
};

export type ManuscriptPageSettings = {
  size: "A4";
  orientation: "portrait" | "landscape";
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  headerText: string;
  footerText: string;
  pageNumbers: boolean;
  showGrid: boolean;
  showRuler: boolean;
};

export type ManuscriptFieldKind = "text" | "image";

export type ManuscriptFieldValue = {
  key: string;
  label: string;
  group: "Submission" | "Authors" | "Publication";
  kind: ManuscriptFieldKind;
  value: string;
  sourcePath: string;
  authorPosition?: number;
  fileId?: string | null;
  private?: boolean;
};

export type LinkedFieldBinding = ManuscriptFieldValue & {
  lastAppliedValue: string;
  overridden: boolean;
  frozen: boolean;
};

export type ManuscriptSourceParagraph = {
  index: number;
  text: string;
  page?: number;
  style?: string;
  alignment?: "left" | "center" | "right" | "justify";
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  lineSpacing?: number;
  firstLineIndentPt?: number;
  leftIndentPt?: number;
  confidence?: number;
};

export type ManuscriptImportWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  page?: number;
};

export type ManuscriptImportReport = {
  format: "docx" | "pdf";
  importedAt: string;
  sourceFileName: string;
  sourceBytes: number;
  sourcePages: number;
  sourceParagraphs: number;
  editorParagraphs: number;
  sourceWords: number;
  editorWords: number;
  tables: number;
  images: number;
  footnotes: number;
  pageBreaks: number;
  normalizedTextCoverage: number;
  unsupportedConstructs: string[];
  lowConfidencePages: number[];
  warnings: ManuscriptImportWarning[];
  paragraphs: ManuscriptSourceParagraph[];
};

export type ComparisonFinding = {
  id: string;
  kind: "missing" | "extra" | "changed";
  sourceIndex?: number;
  editorIndex?: number;
  sourceText?: string;
  editorText?: string;
};

export const manuscriptVerificationKeys = [
  "title",
  "authors",
  "paragraphs",
  "tables",
  "figures",
  "footnotes",
  "flaggedPages",
] as const;

export type ManuscriptVerificationKey = (typeof manuscriptVerificationKeys)[number];
export type ManuscriptManualConfirmations = Partial<Record<ManuscriptVerificationKey, boolean>>;

export type ManuscriptLease = {
  editable: boolean;
  ownerId: string | null;
  ownerName: string | null;
  expiresAt: string | null;
  canForceTakeover: boolean;
};

export type ManuscriptVersion = {
  id: string;
  versionNumber: number;
  kind: "import" | "checkpoint" | "restore" | "final";
  revision: number;
  parentVersionId: string | null;
  changeSummary: string;
  docxFileId: string | null;
  pdfFileId: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type ManuscriptDraft = {
  editorState: ManuscriptEditorState;
  pageSettings: ManuscriptPageSettings;
  fieldBindings: LinkedFieldBinding[];
  fieldSnapshot: Record<string, ManuscriptFieldValue>;
  importReport: ManuscriptImportReport | null;
  sourceSnapshot: { text: string; paragraphs: ManuscriptSourceParagraph[] };
  manualConfirmations: ManuscriptManualConfirmations;
  contentText: string;
  contentHash: string;
  revision: number;
  updatedAt: string;
  updatedByName: string | null;
};

export type ManuscriptDocument = {
  id: string;
  submissionId: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceMimeType: string;
  sourceSha256: string | null;
  status: "draft" | "finalized";
  schemaVersion: number;
  currentRevision: number;
  currentVersionId: string | null;
  importedAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ManuscriptSubmissionSummary = {
  id: string;
  reference: string;
  title: string;
  author: string;
  journal: string;
  stage: string;
  stageLabel: string;
  sourceFileId: string | null;
  sourceFileName: string | null;
  sourceMimeType: string | null;
  documentId: string | null;
  documentStatus: "not_started" | "draft" | "finalized" | "read_only";
  importStatus: "not_started" | "ready" | "warning" | "unsupported";
  lastEditor: string | null;
  lastSavedAt: string | null;
};

export type ManuscriptDetail = {
  document: ManuscriptDocument;
  submission: ManuscriptSubmissionSummary & {
    abstract: string;
    category: string;
  };
  draft: ManuscriptDraft;
  fields: ManuscriptFieldValue[];
  versions: ManuscriptVersion[];
  lease: ManuscriptLease;
  permissions: {
    canEdit: boolean;
    canFinalize: boolean;
    published: boolean;
  };
};

export type ManuscriptImportPayload = {
  editorState: ManuscriptEditorState;
  contentText: string;
  sourceSnapshot: { text: string; paragraphs: ManuscriptSourceParagraph[] };
  report: ManuscriptImportReport;
};

export const defaultManuscriptPageSettings: ManuscriptPageSettings = {
  size: "A4",
  orientation: "portrait",
  marginTopMm: 25.4,
  marginRightMm: 25.4,
  marginBottomMm: 25.4,
  marginLeftMm: 25.4,
  headerText: "",
  footerText: "",
  pageNumbers: true,
  showGrid: false,
  showRuler: true,
};

export const blankManuscriptEditorState: ManuscriptEditorState = {
  root: {
    children: [],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};

export function normalizeManuscriptText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function manuscriptWordCount(value: string) {
  const normalized = normalizeManuscriptText(value);
  return normalized ? normalized.split(/\s+/).length : 0;
}

export function manuscriptParagraphs(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function manuscriptPlainTextFromState(editorState: ManuscriptEditorState) {
  const render = (value: ManuscriptJson): string => {
    if (value == null || typeof value === "boolean" || typeof value === "number") return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(render).join("");
    if (value.type === "text" || value.type === "linked-field" || value.type === "footnote") return typeof value.text === "string" ? value.text : "";
    if (value.type === "linebreak") return "\n";
    if (value.type === "tab") return "\t";
    if (value.type === "page-break") return "\n";
    const children = Array.isArray(value.children) ? value.children.map(render) : [];
    if (value.type === "tablecell") return children.join("\n");
    if (value.type === "tablerow") return children.join("\t");
    if (value.type === "table") return children.join("\n");
    if (["paragraph", "manuscript-paragraph", "heading", "quote", "listitem"].includes(String(value.type))) return children.join("");
    if (value.type === "list") return children.join("\n");
    return children.join("");
  };
  return editorState.root.children.map(render).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
