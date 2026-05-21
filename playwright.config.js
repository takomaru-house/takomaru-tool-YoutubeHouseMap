const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const BASE_ORIGIN = new URL(BASE_URL).origin;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['line'],
  ],
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    // オンボーディングのオーバーレイが他のテストの操作を妨げないよう、
    // 全テストで「表示済み」状態を初期セット。onboarding.spec.js では明示的にクリアして検証する。
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_ORIGIN,
          localStorage: [{ name: 'takomaru-onboarding-seen', value: '1' }],
        },
      ],
    },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'boundary-768',
      use: { browserName: 'chromium', viewport: { width: 768, height: 900 } },
    },
  ],
  webServer: {
    command: 'npx serve docs -p 8080',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
