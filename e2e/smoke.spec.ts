import { expect, test } from '@playwright/test';

// Catches a deploy that ships a broken bundle or a missing asset.
test('the app starts without errors or failed requests', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '# rimbalzello' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  expect(problems).toEqual([]);
});
