// E2E-04: アクセシビリティ自動チェック（axe-playwright）
const { test, expect } = require('@playwright/test');
const { injectAxe, getViolations } = require('axe-playwright');

test.describe('E2E-04: アクセシビリティ', () => {
  test('E2E-04-01: サムネイルに alt 属性が設定されている', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto('');
    await expect(page.locator('#mobile-view')).toBeVisible();
    // アコーディオン展開で動画カード描画
    await page.locator('.acc-cat-header').first().click();
    await page.locator('.acc-grp-header').first().click();
    await page.locator('.acc-genre-header').first().click();
    const imgs = page.locator('.video-card img');
    const count = await imgs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const alt = await imgs.nth(i).getAttribute('alt');
      expect(alt).toBeTruthy();
      expect(alt).toMatch(/サムネイル/);
    }
  });

  test('E2E-04-02: Tabキーで動画カードを順に移動できる', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto('');
    await page.locator('.acc-cat-header').first().click();
    await page.locator('.acc-grp-header').first().click();
    await page.locator('.acc-genre-header').first().click();
    const firstCard = page.locator('.video-card').first();
    await firstCard.focus();
    await expect(firstCard).toBeFocused();
    await page.keyboard.press('Tab');
    const secondCard = page.locator('.video-card').nth(1);
    await expect(secondCard).toBeFocused();
  });

  test('E2E-04-03: axe-playwright によるアクセシビリティ違反が 0 件', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
    await injectAxe(page);
    const violations = await getViolations(page, null, {
      // 開発中サンプルでは未デプロイOGP等を厳格化しすぎないように特定ルールを除外可能
      detailedReport: false,
    });
    if (violations.length > 0) {
      // 失敗時にviolationを stdout に出してデバッグ支援
      // eslint-disable-next-line no-console
      console.error('axe violations:', JSON.stringify(violations, null, 2));
    }
    expect(violations).toHaveLength(0);
  });
});
