// E2E-05: タブによるカテゴリ切替
const { test, expect } = require('@playwright/test');

test.describe('E2E-05: カテゴリタブ', () => {
  test('E2E-05-01: 初期表示で「施主目線」タブがアクティブ', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#category-tabs')).toBeVisible({ timeout: 5000 });
    const activeTab = page.locator('.tab-btn[aria-selected="true"]');
    await expect(activeTab).toHaveText(/施主目線/);
  });

  test('E2E-05-02: 「専門家目線」タブをクリックすると aria-selected が切替わる', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#category-tabs')).toBeVisible({ timeout: 5000 });
    const expertTab = page.locator('.tab-btn', { hasText: '専門家目線' });
    await expertTab.click();
    await expect(expertTab).toHaveAttribute('aria-selected', 'true');
    const ownerTab = page.locator('.tab-btn', { hasText: '施主目線' });
    await expect(ownerTab).toHaveAttribute('aria-selected', 'false');
  });

  test('E2E-05-03: タブ切替でモバイルアコーディオンの内容が再描画される', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto('');
    await expect(page.locator('#mobile-view')).toBeVisible({ timeout: 5000 });

    // 「施主目線」初期表示で GRP-B 水回り を開くと「キッチン」がある（サンプル動画あり）
    const grpHeaders = page.locator('.acc-grp-header:not([disabled])');
    const ownerGroupCount = await grpHeaders.count();
    expect(ownerGroupCount).toBeGreaterThan(0);

    // 「専門家目線」に切替
    await page.locator('.tab-btn', { hasText: '専門家目線' }).click();

    // アコーディオンが再描画され、専門家目線のグループが表示される
    // CAT-02 GRP-A 計画・間取り > 間取り にサンプル動画あり
    const newGrpHeaders = page.locator('.acc-grp-header:not([disabled])');
    await expect(newGrpHeaders.first()).toBeVisible();
  });
});
