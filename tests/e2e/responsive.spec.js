// E2E-03: レスポンシブ切替テスト（768px ブレークポイント）
const { test, expect } = require('@playwright/test');

test.describe('E2E-03: レスポンシブ切替', () => {
  test('E2E-03-01: 1280px ではD3マインドマップ（#pc-view）が表示される', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#pc-view')).toBeVisible();
    await expect(page.locator('#mindmap svg')).toBeVisible();
    await expect(page.locator('#mobile-view')).toBeHidden();
  });

  test('E2E-03-02: 767px ではアコーディオン（#mobile-view）が表示される', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 900 });
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#mobile-view')).toBeVisible();
    await expect(page.locator('#accordion .acc-category').first()).toBeVisible();
    await expect(page.locator('#pc-view')).toBeHidden();
  });

  test('E2E-03-03: 768px 境界で UI が正しく切り替わる（PC側に倒れる）', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/');
    // CSS @media (min-width: 768px) は 768px ちょうどでPCに切り替わる
    await expect(page.locator('#pc-view')).toBeVisible();
    await expect(page.locator('#mobile-view')).toBeHidden();
  });
});
