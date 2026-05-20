// E2E-01: 公開サイト基本動作
const { test, expect } = require('@playwright/test');

test.describe('E2E-01: 公開サイト基本動作', () => {
  test('E2E-01-01: ページが 3秒以内に読み込まれる', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(3000);
  });

  test('E2E-01-02: JSONロード成功後にコンテンツが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#error')).toBeHidden();
  });

  test('E2E-01-03: JSONロード失敗時にエラーUIが表示される', async ({ page }) => {
    await page.route('**/data/videos.json', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    );
    await page.goto('/');
    await expect(page.locator('#error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-message')).toContainText('データの読み込みに失敗');
  });

  test('E2E-01-04: 5秒タイムアウト時にエラーUIが表示される', async ({ page }) => {
    await page.route('**/data/videos.json', async (route) => {
      // 8秒遅延（クライアントの AbortController 5秒タイムアウトを超える）
      await new Promise((r) => setTimeout(r, 8000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/');
    await expect(page.locator('#error')).toBeVisible({ timeout: 10000 });
  });

  test('E2E-01-05: リロードボタンクリックでページが再読み込みされる', async ({ page }) => {
    let count = 0;
    await page.route('**/data/videos.json', async (route) => {
      count += 1;
      if (count === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      } else {
        await route.continue();
      }
    });
    await page.goto('/');
    await expect(page.locator('#error')).toBeVisible({ timeout: 5000 });
    await page.locator('#reload-btn').click();
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
  });

  test('E2E-01-06: フッターに免責事項が表示されている', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText('GoogleおよびYouTubeとは無関係');
    await expect(footer.locator('a', { hasText: 'YouTube利用規約' })).toBeVisible();
  });

  test('E2E-01-07: 最終更新日が表示される（FR-09）', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#last-updated')).toContainText('最終更新日');
  });
});
