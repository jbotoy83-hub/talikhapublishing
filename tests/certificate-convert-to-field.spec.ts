import { expect, test, type Page, type Route } from "@playwright/test";
import { createDefaultTemplate, createTextBlock } from "../admin-panel/src/components/certificates/field-engine";
import type { CertificateRecord } from "../admin-panel/src/components/certificates/types";

const origin = "http://127.0.0.1:5173";
const templateId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const recordId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const submissionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function reply(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockCertificateApi(page: Page) {
  const template = createDefaultTemplate("Publication Certificate", "Talikha", 1);
  template.id = templateId;
  template.pages[0].id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const block = createTextBlock(template.pages[0].id, 110, 160, "Presented to Dr. Amihan Reyes");
  block.id = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  block.width = 420;
  block.height = 72;
  block.style.fontSize = 28;
  template.blocks = [block];
  const record: CertificateRecord = {
    id: recordId,
    templateId,
    templateVersion: 1,
    submissionId,
    reference: "TP-2026-0184",
    fieldValues: {
      author_name: "Dr. Amihan Reyes",
      author_academic_title: "PhD",
      author_role: "Associate Professor",
      author_affiliation: "Talikha State University",
      author_photo: "",
      work_title: "Community Memory and Coastal Resilience",
      doi: "10.0000/talikha.demo.184",
      publication_name: "InQuira",
      volume_number: "2",
      issue_number: "1",
      issue_date: "August 2026",
      issn_online: "0000-0000",
      issn_print: "",
      date_issued: "August 12, 2026",
      certificate_number: "TAL-2026-0001",
      publisher_name: "Talikha Publishing",
      issuing_city: "Butuan City",
    },
    fieldUrls: {},
    layoutOverrides: {},
    status: "draft",
    certificateNumber: "TAL-2026-0001",
    createdAt: "2026-08-12T08:00:00.000Z",
    updatedAt: "2026-08-12T08:00:00.000Z",
  };
  let saves = 0;

  const serverRecord = () => ({
    id: record.id,
    template_id: templateId,
    submission_id: submissionId,
    status: record.status,
    field_values: record.fieldValues,
    field_urls: record.fieldUrls,
    layout_overrides: record.layoutOverrides,
    certificate_number: record.certificateNumber,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/admin/workspace") return reply(route, { connected: false });
    if (pathname === "/api/admin/activity") return reply(route, { ok: true });
    if (pathname === "/api/admin/certificates" && request.method() === "GET") return reply(route, { templates: [{ id: templateId, name: template.name, version: 1, status: "draft", updatedAt: template.updatedAt }] });
    if (pathname === `/api/admin/certificates/${templateId}` && request.method() === "GET") return reply(route, { template });
    if (pathname === `/api/admin/certificates/${templateId}` && request.method() === "PUT") { saves += 1; return reply(route, { template }); }
    if (pathname === "/api/admin/certificates/records" && request.method() === "GET") return reply(route, { records: [] });
    if (pathname === "/api/admin/certificates/from-submission") return reply(route, { templateId, records: [serverRecord()] });
    if (pathname === `/api/admin/certificates/records/${recordId}` && request.method() === "PATCH") {
      const body = request.postDataJSON() as { fieldValues: Record<string, string>; layoutOverrides?: Record<string, unknown> };
      record.fieldValues = body.fieldValues;
      record.layoutOverrides = body.layoutOverrides || {};
      record.updatedAt = new Date().toISOString();
      saves += 1;
      return reply(route, { record: serverRecord() });
    }
    return reply(route, { ok: true });
  });
  return { get saves() { return saves; } };
}

async function selectInlineText(page: Page) {
  await page.locator(".cert-block").first().dispatchEvent("dblclick");
  await expect(page.locator(".cert-inline-editor")).toBeVisible();
  await page.locator(".cert-inline-editor").click();
  await page.evaluate(() => {
    const editor = document.querySelector(".cert-inline-editor") as HTMLElement | null;
    const node = editor?.querySelector(".cert-text-node")?.firstChild || editor?.firstChild;
    if (!editor || !node?.textContent) return;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, Math.min(9, node.textContent.length));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.dispatchEvent(new Event("selectstart", { bubbles: true }));
    document.dispatchEvent(new Event("selectionchange"));
  });
}

test.describe("Certificate editor regression coverage", () => {
  let certificateService: { readonly saves: number };

  test.beforeEach(async ({ page }) => {
    certificateService = await mockCertificateApi(page);
    await page.goto(`${origin}/admin?view=certificates&certificateSubmission=${submissionId}`);
    await expect(page.locator(".cert-ws")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".cert-saved-indicator")).toContainText("Saved", { timeout: 10_000 });
  });

  test("direct route and field conversion remain functional", async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`view=certificates.*certificateSubmission=${submissionId}`));
    await page.getByRole("button", { name: "Design" }).click();
    await expect(page.getByRole("button", { name: "Design" })).toHaveClass(/active/);
    await selectInlineText(page);
    await expect(page.locator(".cert-field-label").filter({ hasText: "Convert selection to field" })).toBeVisible();
    const field = page.locator(".cert-convert-field-item").filter({ hasText: "Author Name" });
    await expect(field).toBeVisible();
    await field.click();
    await expect(page.locator(".cert-chip")).toBeVisible();
  });

  test("linked publication data autosaves and export controls remain available", async ({ page }) => {
    await page.getByRole("button", { name: "Fill" }).click();
    const titleInput = page.locator(".cert-field-group").filter({ hasText: "Manuscript Title" }).locator("input");
    await titleInput.fill("Community Memory and Coastal Resilience — corrected");
    await expect(page.locator(".cert-saved-indicator")).toContainText("Saved", { timeout: 8_000 });
    await expect.poll(() => certificateService.saves, { timeout: 8_000 }).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Export", exact: true }).last().click();
    await expect(page.getByRole("button", { name: "Export All Pages as PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export Current Page as PDF" })).toBeEnabled();
  });

  test("author and manuscript uppercase controls retain their field-specific behavior", async ({ page }) => {
    await page.getByRole("button", { name: "Fill" }).click();
    const buttons = page.locator(".cert-case-btn");
    await expect(buttons).toHaveCount(2);
    await expect(page.locator(".cert-field-label").filter({ hasText: "Manuscript Title" })).toBeVisible();
    await expect(page.getByText("Article Title", { exact: true })).toHaveCount(0);
  });
});
