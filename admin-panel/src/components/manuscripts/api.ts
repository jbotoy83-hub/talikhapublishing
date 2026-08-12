import type {
  LinkedFieldBinding,
  ManuscriptDetail,
  ManuscriptEditorState,
  ManuscriptFieldValue,
  ManuscriptImportPayload,
  ManuscriptImportReport,
  ManuscriptManualConfirmations,
  ManuscriptPageSettings,
  ManuscriptSourceParagraph,
  ManuscriptSubmissionSummary,
} from "./types";

export class ManuscriptApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "ManuscriptApiError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string };
  if (!response.ok) throw new ManuscriptApiError(body.error || "The manuscript request failed.", response.status, body.code || "REQUEST_FAILED");
  return body as T;
}

function normalizeDetail(detail: ManuscriptDetail): ManuscriptDetail {
  const snapshot = detail?.draft?.sourceSnapshot;
  return {
    ...detail,
    draft: {
      ...detail.draft,
      sourceSnapshot: {
        text: typeof snapshot?.text === "string" ? snapshot.text : "",
        paragraphs: Array.isArray(snapshot?.paragraphs) ? snapshot.paragraphs : [],
      },
    },
  };
}

export const manuscriptApi = {
  eligible: async () => ({ submissions: (await requestJson<{ manuscripts: ManuscriptSubmissionSummary[] }>("/api/admin/manuscripts/eligible")).manuscripts }),
  open: async (submissionId: string) => normalizeDetail((await requestJson<{ manuscript: ManuscriptDetail }>("/api/admin/manuscripts", { method: "POST", body: JSON.stringify({ submissionId }) })).manuscript),
  detail: async (documentId: string) => normalizeDetail((await requestJson<{ manuscript: ManuscriptDetail }>(`/api/admin/manuscripts/${documentId}`)).manuscript),
  save: (documentId: string, input: {
    baseRevision: number;
    editorState: ManuscriptEditorState;
    contentText: string;
    pageSettings: ManuscriptPageSettings;
    fieldBindings: LinkedFieldBinding[];
    fieldSnapshot: Record<string, ManuscriptFieldValue>;
    importReport: ManuscriptImportReport | null;
    sourceSnapshot: { text: string; paragraphs: ManuscriptSourceParagraph[] };
    manualConfirmations: ManuscriptManualConfirmations;
  }) => requestJson<{ revision: number; updatedAt: string; contentHash: string }>(`/api/admin/manuscripts/${documentId}/draft`, { method: "PATCH", body: JSON.stringify(input) }),
  import: (documentId: string, baseRevision: number, payload: ManuscriptImportPayload) => requestJson<{ revision: number; updatedAt: string; contentHash: string; report: ManuscriptImportReport; versionId: string }>(`/api/admin/manuscripts/${documentId}/import`, { method: "POST", body: JSON.stringify({ baseRevision, payload }) }),
  fieldSync: (documentId: string, input: { action: "preview" | "apply"; baseRevision?: number; selectedKeys?: string[] }) => requestJson<Record<string, unknown>>(`/api/admin/manuscripts/${documentId}/field-sync`, { method: "POST", body: JSON.stringify(input) }),
  checkpoint: async (documentId: string, changeSummary: string) => {
    const response = await requestJson<{ detail: ManuscriptDetail }>(`/api/admin/manuscripts/${documentId}/versions`, { method: "POST", body: JSON.stringify({ action: "checkpoint", changeSummary }) });
    return { detail: normalizeDetail(response.detail) };
  },
  restore: async (documentId: string, versionId: string) => {
    const response = await requestJson<{ detail: ManuscriptDetail }>(`/api/admin/manuscripts/${documentId}/versions`, { method: "POST", body: JSON.stringify({ action: "restore", versionId }) });
    return { detail: normalizeDetail(response.detail) };
  },
  lease: async (documentId: string, action: "acquire" | "heartbeat" | "release" | "takeover") => normalizeDetail((await requestJson<{ manuscript: ManuscriptDetail }>(`/api/admin/manuscripts/${documentId}/lease`, { method: "POST", keepalive: action === "release", body: JSON.stringify({ action }) })).manuscript),
  finalize: (documentId: string, confirmations: ManuscriptManualConfirmations, changeSummary: string) => requestJson<{ versionId: string; docxFileId: string; pdfFileId: string; docxUrl: string; pdfUrl: string }>(`/api/admin/manuscripts/${documentId}/finalize`, { method: "POST", body: JSON.stringify({ confirmations, changeSummary }) }),
};

export async function downloadPreview(documentId: string, format: "docx" | "pdf", title: string) {
  const response = await fetch(`/api/admin/manuscripts/${documentId}/preview`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ManuscriptApiError(body.error || "The preview could not be generated.", response.status, "PREVIEW_FAILED");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "manuscript"}-preview.${format}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
