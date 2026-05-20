// Sprint 0 スモークテスト：Playwright 環境と 3 プロジェクト構成を検証。
// Sprint 1 以降で本格的な E2E テスト（responsive / public-site / video-card / accessibility）を追加する。
const { test, expect } = require('@playwright/test');

test('Sprint 0 smoke: index.html が読み込まれフッター免責が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/注文住宅YouTube動画マップ/);
  await expect(page.locator('footer')).toContainText('Googleおよび');
});
