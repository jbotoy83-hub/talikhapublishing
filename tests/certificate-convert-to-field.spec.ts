import { test, expect } from '@playwright/test';

test.describe('Certificate editor — convert highlighted text to linked field', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/admin?view=certificates');
    await page.waitForSelector('.cert-ws', { timeout: 15000 });
    await page.waitForSelector('text=Saved', { timeout: 10000 });
  });

  test('popover shows Convert button when text is selected in inline editor', async ({ page }) => {
    const canvasBlock = page.locator('.cert-block').first();
    await canvasBlock.dblclick();
    await page.waitForSelector('.cert-inline-editor', { timeout: 5000 });

    const editor = page.locator('.cert-inline-editor');
    await editor.click();

    await page.evaluate(() => {
      const el = document.querySelector('.cert-inline-editor') as HTMLElement;
      if (!el) return;
      const range = document.createRange();
      const sel = window.getSelection();
      const textNode = el.querySelector('.cert-text-node') || el.childNodes[0];
      if (!textNode) return;
      range.setStart(textNode, 0);
      range.setEnd(textNode, Math.min(5, (textNode.textContent || '').length));
      sel?.removeAllRanges();
      sel?.addRange(range);
      el.dispatchEvent(new Event('selectstart', { bubbles: true }));
      document.dispatchEvent(new Event('selectionchange'));
    });

    await page.waitForTimeout(500);

    const convertBtn = page.locator('.cert-sel-btn--primary');
    await expect(convertBtn).toBeVisible({ timeout: 3000 });
    await expect(convertBtn).toContainText('Convert');
  });

  test('clicking Convert opens field picker panel', async ({ page }) => {
    const canvasBlock = page.locator('.cert-block').first();
    await canvasBlock.dblclick();
    await page.waitForSelector('.cert-inline-editor', { timeout: 5000 });

    const editor = page.locator('.cert-inline-editor');
    await editor.click();

    await page.evaluate(() => {
      const el = document.querySelector('.cert-inline-editor') as HTMLElement;
      if (!el) return;
      const range = document.createRange();
      const sel = window.getSelection();
      const textNode = el.querySelector('.cert-text-node') || el.childNodes[0];
      if (!textNode) return;
      range.setStart(textNode, 0);
      range.setEnd(textNode, Math.min(5, (textNode.textContent || '').length));
      sel?.removeAllRanges();
      sel?.addRange(range);
      el.dispatchEvent(new Event('selectstart', { bubbles: true }));
      document.dispatchEvent(new Event('selectionchange'));
    });

    await page.waitForTimeout(500);

    await page.locator('.cert-sel-btn--primary').click();
    await page.waitForTimeout(300);

    const panel = page.locator('.cert-sel-link-panel');
    await expect(panel).toBeVisible({ timeout: 3000 });
    await expect(panel.locator('.cert-sel-panel-title')).toContainText('Convert to field');
    await expect(panel.locator('.cert-sel-field-item').first()).toBeVisible();
  });

  test('AA uppercase button exists for author_name and work_title fields', async ({ page }) => {
    const aaButtons = page.locator('.cert-case-btn');
    await expect(aaButtons).toHaveCount(2);
  });

  test('Manuscript Title label is shown instead of Work title or Article Title', async ({ page }) => {
    await expect(page.locator('text=Manuscript Title').first()).toBeVisible();
    await expect(page.locator('text=Article Title')).toHaveCount(0);
  });
});
