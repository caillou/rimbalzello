import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const ci = !!process.env.CI;

// Browser checks run against the built site on the preview server.
// CI builds once before this step; locally the server builds first.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: ci,
  reporter: ci ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: `${ci ? '' : 'pnpm build && '}pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !ci,
  },
});
