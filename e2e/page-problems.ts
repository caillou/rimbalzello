import type { Page } from '@playwright/test';

/**
 * Collects what a visitor would see as breakage: console errors, uncaught
 * errors, failed requests and responses with status 400 and up. Call it
 * before navigating, and check the list once the page has settled (after
 * `document.fonts.ready`, so missing fonts count too).
 */
export function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
  });
  return problems;
}
