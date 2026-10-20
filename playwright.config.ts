import { defineConfig, devices } from '@playwright/test';

// Smoke test of the built web app (dist/, from `npm run build:pages`), served the way GitHub Pages serves it.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/book-app/',
    ...devices['iPhone 13'],
    // iPhone 13 is WebKit's device; the test runs it in Chromium, which is what CI has.
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/e2e/serve.mjs',
    url: 'http://localhost:4173/book-app/',
    reuseExistingServer: !process.env.CI,
  },
});
