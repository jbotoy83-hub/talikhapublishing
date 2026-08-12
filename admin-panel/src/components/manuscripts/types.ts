export type {
  ComparisonFinding,
  LinkedFieldBinding,
  ManuscriptDetail,
  ManuscriptDocument,
  ManuscriptDraft,
  ManuscriptEditorState,
  ManuscriptFieldValue,
  ManuscriptImportPayload,
  ManuscriptImportReport,
  ManuscriptImportWarning,
  ManuscriptJson,
  ManuscriptLease,
  ManuscriptManualConfirmations,
  ManuscriptPageSettings,
  ManuscriptSourceParagraph,
  ManuscriptSubmissionSummary,
  ManuscriptVerificationKey,
  ManuscriptVersion,
} from "../../../../src/lib/manuscript-editor-contract";

export {
  blankManuscriptEditorState,
  defaultManuscriptPageSettings,
  manuscriptParagraphs,
  manuscriptPlainTextFromState,
  manuscriptVerificationKeys,
  manuscriptWordCount,
  normalizeManuscriptText,
} from "../../../../src/lib/manuscript-editor-contract";

export type ManuscriptSaveState = "saved" | "saving" | "unsaved" | "offline" | "conflict" | "read_only";
export type ManuscriptPanel = "fields" | "page" | "compare" | "history";
export type ComparisonMode = "original" | "converted" | "side_by_side" | "differences";

export type EditorMetrics = {
  words: number;
  characters: number;
  paragraphs: number;
  selectedWords: number;
};

export type ImportWorkerRequest = {
  bytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
};

export type ImportWorkerResponse =
  | { ok: true; payload: import("../../../../src/lib/manuscript-editor-contract").ManuscriptImportPayload }
  | { ok: false; code: string; message: string };
