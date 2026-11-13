import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PW_PORT) || 4173;
// The path the site is served under, as vite.config.ts reads it: tests
// navigate relative to it ('./', './about/').
const base = process.env.BASE_PATH || '/';
const siteUrl = `http://localhost:${port}${base}`;
const ci = !!process.env.CI;

// Browser checks run against the built site on the preview server.
// CI builds once before this step; locally the server builds first.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: ci,
  reporter: ci ? [['github'], ['list']] : 'list',
  use: {
    baseURL: siteUrl,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: `${ci ? '' : 'pnpm build && '}pnpm preview --port ${port} --strictPort`,
    url: siteUrl,
    reuseExistingServer: !ci,
  },
});
