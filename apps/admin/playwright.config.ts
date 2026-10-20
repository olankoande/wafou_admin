import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, retries: 0, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5174', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, trace: 'off', screenshot: 'only-on-failure' },
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:5174', reuseExistingServer: true, timeout: 60000 },
});
