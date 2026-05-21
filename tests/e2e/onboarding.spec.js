// E2E-06: オンボーディング（初回訪問ガイド）
const { test, expect } = require('@playwright/test');

test.describe('E2E-06: オンボーディング', () => {
  test('E2E-06-01: 初回訪問時にオンボーディングが自動表示される', async ({ page, context }) => {
    // localStorage をクリア（クリーン環境を再現）
    await context.clearCookies();
    await page.goto('');
    // メインコンテンツが表示されてから localStorage を空にする
    await page.evaluate(() => localStorage.removeItem('takomaru-onboarding-seen'));
    await page.reload();

    await expect(page.locator('#onboarding')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#onboarding-title')).toContainText('タコまる書庫へようこそ');
    await expect(page.locator('#onboarding-step-counter')).toHaveText('1 / 4');
  });

  test('E2E-06-02: 「次へ」でステップが進む', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => localStorage.removeItem('takomaru-onboarding-seen'));
    await page.reload();
    await expect(page.locator('#onboarding')).toBeVisible({ timeout: 5000 });

    await page.locator('#onboarding-next').click();
    await expect(page.locator('#onboarding-step-counter')).toHaveText('2 / 4');
    await expect(page.locator('#onboarding-title')).toContainText('視点を切り替える');

    await page.locator('#onboarding-next').click();
    await expect(page.locator('#onboarding-step-counter')).toHaveText('3 / 4');

    await page.locator('#onboarding-next').click();
    await expect(page.locator('#onboarding-step-counter')).toHaveText('4 / 4');
    await expect(page.locator('#onboarding-next')).toHaveText(/閉じる/);
  });

  test('E2E-06-03: 「閉じる」でオンボーディング終了 + localStorage 記録', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => localStorage.removeItem('takomaru-onboarding-seen'));
    await page.reload();
    await expect(page.locator('#onboarding')).toBeVisible({ timeout: 5000 });

    // 最終ステップまで進めて閉じる
    for (let i = 0; i < 4; i++) {
      await page.locator('#onboarding-next').click();
    }
    await expect(page.locator('#onboarding')).toBeHidden();
    const stored = await page.evaluate(() => localStorage.getItem('takomaru-onboarding-seen'));
    expect(stored).toBe('1');
  });

  test('E2E-06-04: スキップボタンで即終了 + localStorage 記録', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => localStorage.removeItem('takomaru-onboarding-seen'));
    await page.reload();
    await expect(page.locator('#onboarding')).toBeVisible({ timeout: 5000 });

    await page.locator('#onboarding-skip').click();
    await expect(page.locator('#onboarding')).toBeHidden();
    const stored = await page.evaluate(() => localStorage.getItem('takomaru-onboarding-seen'));
    expect(stored).toBe('1');
  });

  test('E2E-06-05: 2回目以降の訪問では自動表示されない', async ({ page }) => {
    await page.goto('');
    // 既に表示済みフラグを立てておく
    await page.evaluate(() => localStorage.setItem('takomaru-onboarding-seen', '1'));
    await page.reload();
    // メインコンテンツ表示まで待つ
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
    // オンボーディングは表示されない
    await expect(page.locator('#onboarding')).toBeHidden();
  });

  test('E2E-06-06: フッタの「使い方ガイド」ボタンで再表示できる', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => localStorage.setItem('takomaru-onboarding-seen', '1'));
    await page.reload();
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#onboarding')).toBeHidden();

    // フッタを表示させてからクリック
    await page.locator('#onboarding-restart').scrollIntoViewIfNeeded();
    await page.locator('#onboarding-restart').click();
    await expect(page.locator('#onboarding')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#onboarding-step-counter')).toHaveText('1 / 4');
  });
});
