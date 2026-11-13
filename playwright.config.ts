import { defineConfig, devices } from '@playwright/test';
import type { SilenceOptions } from './e2e/fixtures.ts';

const port = Number(process.env.PW_PORT) || 4173;
// The path the site is served under, as vite.config.ts reads it: tests
// navigate relative to it ('./', './about/').
const base = process.env.BASE_PATH || '/';
const siteUrl = `http://localhost:${port}${base}`;
const ci = !!process.env.CI;

// Browser checks run against the built site on the preview server.
// CI builds once before this step; locally the server builds first.
// Every browser runs silent: each AudioContext still runs and advances, but
// nothing reaches the speakers.
export default defineConfig<SilenceOptions>({
  testDir: 'e2e',
  forbidOnly: ci,
  reporter: ci ? [['github'], ['list']] : 'list',
  use: {
    baseURL: siteUrl,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Headless runs already get --mute-audio from Playwright; the flag
        // here mutes headed, UI and debug runs.
        launchOptions: { args: ['--mute-audio'] },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // WebKit has no mute flag or pref; see e2e/fixtures.ts. CI's runner
        // has no speakers and keeps testing the unpatched output.
        silenceOutput: !ci,
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Turns the volume to 0 while the output stream stays open, so the
        // clock, outputLatency and the CI null sink are unchanged. If Firefox
        // ever renames the pref, it plays aloud again with no error.
        launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0' } },
      },
    },
  ],
  webServer: {
    command: `${ci ? '' : 'pnpm build && '}pnpm preview --port ${port} --strictPort`,
    url: siteUrl,
    reuseExistingServer: !ci,
  },
});
