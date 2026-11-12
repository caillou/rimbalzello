import { expect, test } from '@playwright/test';
import { watchForProblems } from './page-problems.ts';

// Catches a deploy that ships a broken bundle or a missing asset.
test('the app starts without errors or failed requests', async ({ page }) => {
  const problems = watchForProblems(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '# rimbalzello' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  expect(problems).toEqual([]);
});
