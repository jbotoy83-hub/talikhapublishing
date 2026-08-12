import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  ManuscriptDetail,
  ManuscriptEditorState,
  ManuscriptFieldValue,
  ManuscriptSubmissionSummary,
} from "../src/lib/manuscript-editor-contract";
import { defaultManuscriptPageSettings } from "../src/lib/manuscript-editor-contract";

const origin = "http://127.0.0.1:5173";
const submissionId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
const sourceFileId = "33333333-3333-4333-8333-333333333333";
const versionId = "44444444-4444-4444-8444-444444444444";

function textNode(text: string, style = "") {
  return { detail: 0, format: 0, mode: "normal", style, text, type: "text", version: 1 };
}

function initialEditorState(): ManuscriptEditorState {
  return {
    root: {
      children: [
        { children: [textNode("Community Memory and Coastal Resilience")], direction: null, format: "center", indent: 0, tag: "h1", type: "heading", version: 1 },
        { children: [textNode("This study documents community-led coastal adaptation practices.", "font-family:Tinos;font-size:12pt")], direction: null, format: "", indent: 0, textFormat: 0, textStyle: "", type: "manuscript-paragraph", version: 1, spacingBeforePt: 0, spacingAfterPt: 6, lineSpacing: 1.5, firstLineIndentPt: 36, leftIndentPt: 0, sourcePage: 1, confidence: 0.99 },
        { children: [textNode("Participants described local knowledge as essential to long-term resilience.", "font-family:Tinos;font-size:12pt")], direction: null, format: "", indent: 0, textFormat: 0, textStyle: "", type: "manuscript-paragraph", version: 1, spacingBeforePt: 0, spacingAfterPt: 6, lineSpacing: 1.5, firstLineIndentPt: 36, leftIndentPt: 0, sourcePage: 1, confidence: 0.98 },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  } as ManuscriptEditorState;
}

function summary(overrides: Partial<ManuscriptSubmissionSummary> = {}): ManuscriptSubmissionSummary {
  return {
    id: submissionId,
    reference: "TP-2026-0184",
    title: "Community Memory and Coastal Resilience",
    author: "Dr. Amihan Reyes",
    journal: "InQuira",
    stage: "production_preparation",
    stageLabel: "Production preparation",
    sourceFileId,
    sourceFileName: "community-memory.docx",
    sourceMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    documentId,
    documentStatus: "draft",
    importStatus: "ready",
    lastEditor: "Editorial Admin",
    lastSavedAt: "2026-08-12T08:30:00.000Z",
    ...overrides,
  };
}

function buildDetail(editable = true): ManuscriptDetail {
  const contentText = [
    "Community Memory and Coastal Resilience",
    "This study documents community-led coastal adaptation practices.",
    "Participants described local knowledge as essential to long-term resilience.",
  ].join("\n");
  const fields: ManuscriptFieldValue[] = [
    { key: "submission.title", label: "Submission title", group: "Submission", kind: "text", value: "Community Memory and Coastal Resilience", sourcePath: "submissions.title" },
    { key: "authors.1.name", label: "Author name", group: "Authors", kind: "text", value: "Dr. Amihan Reyes", sourcePath: "submission_authors[1].name", authorPosition: 1 },
    { key: "authors.1.academicTitle", label: "Academic title", group: "Authors", kind: "text", value: "PhD", sourcePath: "submission_authors[1].academic_title", authorPosition: 1 },
    { key: "authors.1.email", label: "Email address", group: "Authors", kind: "text", value: "amihan@example.test", sourcePath: "submission_authors[1].email", authorPosition: 1, private: true },
    { key: "authors.1.occupation", label: "Occupation / role", group: "Authors", kind: "text", value: "Associate Professor", sourcePath: "submission_authors[1].occupation", authorPosition: 1 },
    { key: "authors.1.affiliation", label: "Affiliation", group: "Authors", kind: "text", value: "Talikha State University", sourcePath: "submission_authors[1].affiliation", authorPosition: 1 },
    { key: "publication.doi", label: "DOI", group: "Publication", kind: "text", value: "10.0000/talikha.demo.184", sourcePath: "publication_records.doi" },
  ];
  const fieldSnapshot = Object.fromEntries(fields.map((field) => [field.key, field]));
  return {
    document: {
      id: documentId,
      submissionId,
      sourceFileId,
      sourceFileName: "community-memory.docx",
      sourceMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceSha256: "56f6a8a8c178d86a4f3b7fd43ed54f77c8814eafd2f940a6cf12d393418a3f31",
      status: "draft",
      schemaVersion: 1,
      currentRevision: 3,
      currentVersionId: versionId,
      importedAt: "2026-08-12T08:00:00.000Z",
      finalizedAt: null,
      createdAt: "2026-08-12T08:00:00.000Z",
      updatedAt: "2026-08-12T08:30:00.000Z",
    },
    submission: { ...summary(), abstract: "A study of community knowledge and coastal resilience.", category: "Research Article" },
    draft: {
      editorState: initialEditorState(),
      pageSettings: { ...defaultManuscriptPageSettings },
      fieldBindings: [],
      fieldSnapshot,
      importReport: {
        format: "docx",
        importedAt: "2026-08-12T08:00:00.000Z",
        sourceFileName: "community-memory.docx",
        sourceBytes: 18_240,
        sourcePages: 1,
        sourceParagraphs: 3,
        editorParagraphs: 3,
        sourceWords: 21,
        editorWords: 21,
        tables: 0,
        images: 0,
        footnotes: 0,
        pageBreaks: 0,
        normalizedTextCoverage: 1,
        unsupportedConstructs: [],
        lowConfidencePages: [],
        warnings: [],
        paragraphs: [
          { index: 0, text: "Community Memory and Coastal Resilience", page: 1, style: "Title", alignment: "center", confidence: 1 },
          { index: 1, text: "This study documents community-led coastal adaptation practices.", page: 1, style: "Normal", spacingAfterPt: 6, lineSpacing: 1.5, firstLineIndentPt: 36, confidence: 0.99 },
          { index: 2, text: "Participants described local knowledge as essential to long-term resilience.", page: 1, style: "Normal", spacingAfterPt: 6, lineSpacing: 1.5, firstLineIndentPt: 36, confidence: 0.98 },
        ],
      },
      sourceSnapshot: {
        text: contentText,
        paragraphs: [
          { index: 0, text: "Community Memory and Coastal Resilience", page: 1 },
          { index: 1, text: "This study documents community-led coastal adaptation practices.", page: 1 },
          { index: 2, text: "Participants described local knowledge as essential to long-term resilience.", page: 1 },
        ],
      },
      manualConfirmations: {},
      contentText,
      contentHash: "initial-content-hash",
      revision: 3,
      updatedAt: "2026-08-12T08:30:00.000Z",
      updatedByName: "Editorial Admin",
    },
    fields,
    versions: [{ id: versionId, versionNumber: 1, kind: "import", revision: 1, parentVersionId: null, changeSummary: "Original imported", docxFileId: null, pdfFileId: null, createdBy: "55555555-5555-4555-8555-555555555555", createdByName: "Editorial Admin", createdAt: "2026-08-12T08:00:00.000Z" }],
    lease: editable
      ? { editable: true, ownerId: "55555555-5555-4555-8555-555555555555", ownerName: "Editorial Admin", expiresAt: "2099-08-12T08:32:00.000Z", canForceTakeover: false }
      : { editable: false, ownerId: "66666666-6666-4666-8666-666666666666", ownerName: "Copy Editor Ana", expiresAt: "2099-08-12T08:32:00.000Z", canForceTakeover: true },
    permissions: { canEdit: true, canFinalize: true, published: false },
  };
}

async function sourceDocx() {
  return Packer.toBuffer(new Document({
    sections: [{ children: [
      new Paragraph({ heading: "Title", alignment: "center", children: [new TextRun({ text: "Community Memory and Coastal Resilience", bold: true })] }),
      new Paragraph({ spacing: { after: 120, line: 360 }, indent: { firstLine: 720 }, children: [new TextRun("This study documents community-led coastal adaptation practices.")] }),
      new Paragraph({ spacing: { after: 120, line: 360 }, indent: { firstLine: 720 }, children: [new TextRun("Participants described local knowledge as essential to long-term resilience.")] }),
    ] }],
  }));
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockManuscriptApi(page: Page, options: { editable?: boolean } = {}) {
  const detail = buildDetail(options.editable !== false);
  const docx = await sourceDocx();
  const requests = { saves: 0, finalized: 0, conflictNext: false };
  const second = summary({
    id: "77777777-7777-4777-8777-777777777777",
    reference: "TP-2026-0192",
    title: "Image-only Field Notes",
    author: "Maya Santos",
    journal: "Lumera",
    sourceFileName: "field-notes.pdf",
    sourceMimeType: "application/pdf",
    documentId: null,
    documentStatus: "not_started",
    importStatus: "unsupported",
    lastEditor: null,
    lastSavedAt: null,
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (pathname === "/api/admin/workspace") return json(route, { connected: false });
    if (pathname === "/api/admin/activity") return json(route, { ok: true });
    if (pathname === "/api/admin/manuscripts/eligible") return json(route, { manuscripts: [summary(), second] });
    if (pathname === "/api/admin/manuscripts" && request.method() === "POST") return json(route, { manuscript: detail }, 201);
    if (pathname === `/api/admin/files/${sourceFileId}`) return route.fulfill({ status: 200, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: docx });
    if (pathname === `/api/admin/manuscripts/${documentId}` && request.method() === "GET") return json(route, { manuscript: detail });
    if (pathname === `/api/admin/manuscripts/${documentId}/draft` && request.method() === "PATCH") {
      if (requests.conflictNext) {
        requests.conflictNext = false;
        return json(route, { error: "The manuscript changed on the server.", code: "EDIT_CONFLICT" }, 409);
      }
      const input = request.postDataJSON() as Record<string, unknown>;
      requests.saves += 1;
      const revision = detail.draft.revision + 1;
      const updatedAt = new Date().toISOString();
      Object.assign(detail.draft, input, { revision, updatedAt, contentHash: `saved-hash-${revision}` });
      Object.assign(detail.document, { currentRevision: revision, updatedAt });
      return json(route, { revision, updatedAt, contentHash: detail.draft.contentHash });
    }
    if (pathname === `/api/admin/manuscripts/${documentId}/field-sync`) {
      const input = request.postDataJSON() as { action: string };
      if (input.action === "preview") return json(route, { changes: [{ key: "authors.1.affiliation", label: "Affiliation", previous: "Old University", current: "Talikha State University" }] });
      return json(route, { revision: detail.draft.revision });
    }
    if (pathname === `/api/admin/manuscripts/${documentId}/versions`) return json(route, { detail });
    if (pathname === `/api/admin/manuscripts/${documentId}/lease`) {
      const input = request.postDataJSON() as { action: string };
      if (input.action === "acquire" || input.action === "takeover") detail.lease = { editable: true, ownerId: "55555555-5555-4555-8555-555555555555", ownerName: "Editorial Admin", expiresAt: "2099-08-12T08:32:00.000Z", canForceTakeover: false };
      return json(route, { manuscript: detail });
    }
    if (pathname === `/api/admin/manuscripts/${documentId}/preview`) return route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.from("preview") });
    if (pathname === `/api/admin/manuscripts/${documentId}/finalize`) {
      requests.finalized += 1;
      detail.versions = [{ id: "88888888-8888-4888-8888-888888888888", versionNumber: 2, kind: "final", revision: detail.draft.revision, parentVersionId: versionId, changeSummary: "Final DOCX and PDF attached", docxFileId: "99999999-9999-4999-8999-999999999999", pdfFileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", createdBy: "55555555-5555-4555-8555-555555555555", createdByName: "Editorial Admin", createdAt: new Date().toISOString() }, ...detail.versions];
      return json(route, { versionId: detail.versions[0].id, docxFileId: detail.versions[0].docxFileId, pdfFileId: detail.versions[0].pdfFileId, docxUrl: "/api/admin/files/99999999-9999-4999-8999-999999999999?download=1", pdfUrl: "/api/admin/files/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?download=1" });
    }
    return json(route, { ok: true });
  });
  return { detail, requests };
}

test.describe("Manuscript editor", () => {
  test("Editors hub preserves both editor entry points and searchable production queue", async ({ page }) => {
    await mockManuscriptApi(page);
    await page.goto(`${origin}/admin?view=manuscripts`);
    await expect(page.getByRole("heading", { name: "Editors" })).toBeVisible();
    await expect(page.getByText("Manuscript Editor", { exact: true })).toBeVisible();
    await expect(page.getByText("Certificate Editor", { exact: true })).toBeVisible();
    await expect(page.getByText("Community Memory and Coastal Resilience", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Search manuscript queue").fill("Lumera");
    await expect(page.getByText("Image-only Field Notes", { exact: true })).toBeVisible();
    await expect(page.getByText("Replacement required", { exact: true })).toBeVisible();
    await page.getByLabel("Search manuscript queue").fill("TP-2026-0184");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(new RegExp(`view=manuscripts.*submission=${submissionId}`));
    await expect(page.getByRole("heading", { name: "Community Memory and Coastal Resilience" }).first()).toBeVisible();
  });

  test("direct workspace edits, autosaves, compares, inserts fields, and finalizes both formats", async ({ page }) => {
    const { requests } = await mockManuscriptApi(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${origin}/admin?view=manuscripts&submission=${submissionId}`);
    await expect(page.locator(".me-workspace")).toBeVisible();
    await expect(page.locator(".me-paper")).toBeVisible();
    await expect(page.getByLabel("Manuscript document")).toHaveAttribute("contenteditable", "true");
    await expect(page.getByLabel("Font", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Font size")).toBeVisible();
    await expect(page.getByTitle("First-line indent 0.5 inch")).toBeVisible();

    const canvas = page.getByLabel("Manuscript document");
    await canvas.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Added editorial sentence.");
    await expect.poll(() => requests.saves, { timeout: 8_000 }).toBeGreaterThan(0);
    await expect(page.locator(".me-save-status")).toContainText("All changes saved");

    await page.reload();
    await expect(page.getByLabel("Manuscript document")).toContainText("Added editorial sentence.");
    await page.getByLabel("Manuscript document").click();
    await page.keyboard.press("Control+End");
    await page.getByTitle("Insert Author name").click();
    await expect(page.locator(".me-linked-field")).toContainText("Dr. Amihan Reyes");

    await page.getByRole("button", { name: "Page", exact: true }).click();
    await page.getByLabel("5 mm alignment grid").check();
    await expect(page.locator(".me-canvas-scroll")).toHaveClass(/show-grid/);

    await page.locator(".me-command-actions").getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Original vs. converted manuscript" })).toBeVisible();
    await expect(page.locator(".me-compare-workspace")).toBeVisible();
    await expect(page.locator(".me-source-docx-container")).toContainText("Community Memory and Coastal Resilience", { timeout: 12_000 });
    await expect(page.locator(".me-viewer-loading")).toHaveCount(0);
    const outputDir = path.join(process.cwd(), "output", "playwright");
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, "manuscript-editor-comparison.png"), fullPage: true });

    await page.getByRole("button", { name: "Return to editor" }).click();
    await page.getByRole("button", { name: "Finalize & attach", exact: true }).click();
    const finalButton = page.getByRole("button", { name: "Finalize & attach both files" });
    await expect(finalButton).toBeDisabled();
    const checks = page.locator(".me-finalize-checklist input[type=checkbox]");
    await expect(checks).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) await checks.nth(index).check();
    await expect(finalButton).toBeEnabled();
    await finalButton.click();
    await expect(page.getByText("Final manuscript attached", { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(requests.finalized).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test("revision conflicts pause autosave and can safely reload the server draft", async ({ page }) => {
    const { requests } = await mockManuscriptApi(page);
    requests.conflictNext = true;
    await page.goto(`${origin}/admin?view=manuscripts&submission=${submissionId}`);
    const canvas = page.getByLabel("Manuscript document");
    await canvas.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Conflicting local sentence.");
    await expect(page.locator(".me-recovery-banner")).toContainText("newer server revision", { timeout: 8_000 });
    await expect(page.getByRole("button", { name: "Reload server draft" })).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Reload server draft" }).click();
    await expect(page.locator(".me-recovery-banner")).toHaveCount(0);
    await expect(page.getByText("edit conflict is resolved", { exact: false })).toBeVisible();
    await expect(canvas).not.toContainText("Conflicting local sentence.");
  });

  test("phone layout supports review drawers and a basic correction", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { requests } = await mockManuscriptApi(page);
    await page.goto(`${origin}/admin?view=manuscripts&submission=${submissionId}`);
    await expect(page.getByRole("button", { name: "Outline" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tools" })).toBeVisible();
    await page.getByRole("button", { name: "Tools" }).click();
    await expect(page.locator(".me-right-panel")).toHaveClass(/is-mobile-open/);
    await page.locator(".me-right-panel .me-drawer-close").click();
    const canvas = page.getByLabel("Manuscript document");
    await canvas.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Mobile correction.");
    await expect.poll(() => requests.saves, { timeout: 8_000 }).toBeGreaterThan(0);
    const outputDir = path.join(process.cwd(), "output", "playwright");
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, "manuscript-editor-mobile.png"), fullPage: true });
  });

  test("another editor's lease makes the workspace read-only until takeover", async ({ page }) => {
    await mockManuscriptApi(page, { editable: false });
    await page.goto(`${origin}/admin?view=manuscripts&submission=${submissionId}`);
    await expect(page.locator(".me-readonly-banner")).toContainText("Copy Editor Ana currently holds the editing lease");
    await expect(page.getByLabel("Manuscript document")).toHaveAttribute("contenteditable", "false");
    await page.getByRole("button", { name: "Create checkpoint & take over" }).click();
    await expect(page.getByText("Editing lease acquired", { exact: false }).or(page.getByText("editing lease was transferred", { exact: false }))).toBeVisible();
    await expect(page.getByLabel("Manuscript document")).toHaveAttribute("contenteditable", "true");
  });
});
