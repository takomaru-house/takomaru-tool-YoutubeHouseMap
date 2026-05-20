// E2E-02: 動画カード動作
// モバイルビューポート（アコーディオン）で動画カードを表示してテスト
const { test, expect } = require('@playwright/test');

const openFirstAccordion = async (page) => {
  // モバイル幅に固定
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('');
  await expect(page.locator('#mobile-view')).toBeVisible({ timeout: 5000 });
  // 3階層: カテゴリ → グループ → ジャンル を順に展開
  await page.locator('.acc-cat-header').first().click();
  await page.locator('.acc-grp-header').first().click();
  await page.locator('.acc-genre-header').first().click();
};

test.describe('E2E-02: 動画カード', () => {
  test('E2E-02-01: 動画カードクリックで別タブが開く（target=_blank）', async ({ page, context }) => {
    await openFirstAccordion(page);
    const card = page.locator('.video-card').first();
    await expect(card).toBeVisible();
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      card.click(),
    ]);
    // Pixel 5 など mobile UA では m.youtube.com にリダイレクトされるため両方許容
    expect(popup.url()).toMatch(/^https:\/\/(?:www|m)\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/);
    await popup.close();
  });

  test('E2E-02-02: 動画カードの href が youtube.com/watch?v=... 形式', async ({ page }) => {
    await openFirstAccordion(page);
    const href = await page.locator('.video-card').first().getAttribute('href');
    expect(href).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}$/);
  });

  test('E2E-02-03: サムネ 404 で onerror により fallback no-thumbnail.svg に切替わる', async ({ page }) => {
    // YouTube が架空 ID に空のplaceholder画像を 200 で返すケースがあるため、テストでは 404 を強制
    await page.route('**/img.youtube.com/**', (route) => route.fulfill({ status: 404 }));
    await openFirstAccordion(page);
    await page.waitForTimeout(1500); // onerror → fallback ロードを待つ
    const fallback = page.locator('img[src$="no-thumbnail.svg"]');
    await expect(fallback.first()).toBeVisible();
  });

  test('E2E-02-04: trending タグ付き動画に 🔥 バッジが表示される', async ({ page }) => {
    await openFirstAccordion(page);
    const trending = page.locator('.badge-trending').first();
    await expect(trending).toBeVisible();
    await expect(trending).toContainText('🔥');
  });

  test('E2E-02-05: manual タグ付き動画に ⭐ バッジが表示される', async ({ page }) => {
    await openFirstAccordion(page);
    const manual = page.locator('.badge-manual').first();
    await expect(manual).toBeVisible();
    await expect(manual).toContainText('⭐');
  });

  test('E2E-02-06: 長文タイトルは CSS line-clamp で 2行省略される', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto('');
    await expect(page.locator('#mobile-view')).toBeVisible({ timeout: 5000 });

    // 全カテゴリ展開
    const catHeaders = page.locator('.acc-cat-header');
    const catCount = await catHeaders.count();
    for (let i = 0; i < catCount; i++) {
      await catHeaders.nth(i).click();
    }
    // 全グループ展開
    const grpHeaders = page.locator('.acc-grp-header');
    const grpCount = await grpHeaders.count();
    for (let i = 0; i < grpCount; i++) {
      await grpHeaders.nth(i).click();
    }
    // 「キッチン」ジャンルを探して展開
    const gnrHeaders = page.locator('.acc-genre-header');
    const count = await gnrHeaders.count();
    let opened = false;
    for (let i = 0; i < count; i++) {
      const labelText = await gnrHeaders.nth(i).textContent();
      if (labelText && labelText.includes('キッチン')) {
        await gnrHeaders.nth(i).click();
        opened = true;
        break;
      }
    }
    expect(opened).toBe(true);
    const longTitleEl = page.locator('.video-title').first();
    const lineClamp = await longTitleEl.evaluate(
      (el) => getComputedStyle(el).webkitLineClamp
    );
    expect(lineClamp).toBe('2');
  });
});
