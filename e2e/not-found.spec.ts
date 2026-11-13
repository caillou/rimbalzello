import { expect, test } from '@playwright/test';
import { watchForProblems } from './page-problems.ts';

// GitHub Pages serves 404.html for unknown URLs. It must render on its own,
// without the app bundle, and lead the visitor back to the app.
test('the 404 page loads no app script and links back to the app', async ({ page, baseURL }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  const problems = watchForProblems(page);

  await page.goto('./404.html');
  await expect(page.getByRole('heading', { name: '# 404' })).toBeVisible();
  await expect(page.getByText('this stone sank.')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  expect(scripts).toEqual([]);
  expect(problems).toEqual([]);

  // The only control on the page: a full-size touch target.
  const back = page.getByRole('link', { name: 'back to rimbalzello' });
  expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  // Checked on the link itself: the preview server redirects / to the base,
  // which would hide a link to / that leads nowhere on GitHub Pages.
  await expect(back).toHaveAttribute('href', new URL(baseURL!).pathname);

  await back.click();
  await expect(page).toHaveURL((url) => url.pathname === new URL(baseURL!).pathname);
  await expect(page.getByRole('heading', { name: '# rimbalzello' })).toBeVisible();
});
