import { expect, test, type Page } from '@playwright/test';
import { watchForProblems } from './page-problems.ts';
import { countStartedVoices, expectGrooveRunning } from './started-voices.ts';

// About is an app state with its own URL (design.md, About): it opens from
// the footer over the playing app, closes four ways back to the play screen
// with the setup hash kept, and /about/ is prerendered for direct visits.

test.use({ viewport: { width: 393, height: 659 } });

const aboutView = (page: Page) => page.getByRole('region', { name: 'about' });
const aboutLink = (page: Page) => page.getByRole('link', { name: 'about', exact: true });
const historyLength = (page: Page) => page.evaluate(() => history.length);

/** The setup's hash, once the app has written it to the address bar. */
async function setupHash(page: Page): Promise<string> {
  await expect.poll(() => page.evaluate(() => location.hash)).not.toBe('');
  return page.evaluate(() => location.hash);
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('/about/ shows the credits and links to the source at the deployed commit', async ({ page, request, baseURL }) => {
    const problems = watchForProblems(page);
    await page.goto('./about/');
    const view = aboutView(page);

    await expect(view.getByRole('heading', { level: 1, name: '# rimbalzello' })).toBeVisible();
    // caillou.ch twice: after "made by" and in the footer.
    for (const name of ['Grids', 'Émilie Gillet', 'Peaks', 'caillou.ch']) {
      await expect(view.getByRole('link', { name, exact: true }).first()).toBeVisible();
    }
    await expect(view.getByText('GPL-3.0-or-later')).toBeVisible();
    // Both lead to the play screen under the base; checked on the links, as
    // the preview server redirects / to the base and would hide a link to /.
    for (const name of ['back to play', 'close']) {
      await expect(view.getByRole('link', { name })).toHaveAttribute('href', new URL(baseURL!).pathname);
    }
    await expect(view.getByText('not affiliated with Mutable Instruments.', { exact: false })).toBeVisible();
    await expect(view.getByRole('link', { name: /^source at [0-9a-f]{7}$/ })).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/caillou\/rimbalzello\/tree\/[0-9a-f]{40}$/,
    );
    // The preview server answers any path with the app's page and a 200, so only the text tells.
    const notices = await view.getByRole('link', { name: 'third-party notices' }).getAttribute('href');
    const response = await request.get(notices ?? '');
    expect(await response.text(), 'third-party notices').toContain('Third-party notices for rimbalzello');

    // The static page comes styled.
    await expect(view.getByRole('heading', { level: 1 })).toHaveCSS('font-style', 'italic');
    expect(problems).toEqual([]);
  });
});

test.describe('opened from the play screen', () => {
  let hash: string;

  test.beforeEach(async ({ page }) => {
    await countStartedVoices(page);
    await page.goto('./');
    hash = await setupHash(page);
    await page.getByRole('button', { name: '▶ tap to play' }).click();
  });

  const closes: Record<string, (page: Page) => Promise<unknown>> = {
    '← back to play': (page) => aboutView(page).getByRole('link', { name: 'back to play' }).click(),
    '×': (page) => aboutView(page).getByRole('link', { name: 'close' }).click(),
    esc: (page) => page.keyboard.press('Escape'),
    'the browser back button': (page) => page.goBack(),
  };

  test('under about the play screen is inert, and keys play nothing', async ({ page }) => {
    await aboutLink(page).click();
    await expect(aboutView(page)).toBeVisible();
    await expect(page.locator('main')).toHaveJSProperty('inert', true);

    // Window listeners still hear keys under an inert play screen.
    for (const key of ['Space', 'KeyQ', 'Digit2', 'Period']) await page.keyboard.press(key);
    await page.keyboard.press('Escape');
    await expect(aboutView(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'stop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'mute bd' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(/^\d+ bpm$/)).toHaveText('128 bpm');
  });

  for (const [way, close] of Object.entries(closes)) {
    test(`about keeps the music playing; ${way} returns to the play screen`, async ({ page }) => {
      await aboutLink(page).click();
      const view = aboutView(page);
      await expect(view.getByRole('heading', { level: 1, name: '# rimbalzello' })).toBeVisible();
      await expect(page).toHaveURL(`./about/${hash}`);
      await expect(view.getByText('still playing')).toBeVisible();
      await expectGrooveRunning(page);
      const entries = await historyLength(page);

      await close(page);
      await expect(view).toBeHidden();
      await expect(page).toHaveURL(`./${hash}`);
      await expect(page.getByRole('button', { name: 'stop' })).toBeVisible();
      await expectGrooveRunning(page);
      // Closing steps back rather than piling up entries for the back button.
      expect(await historyLength(page)).toBe(entries);
    });
  }
});

test('a direct visit to /about/ shows about over the app; × lands on the play screen', async ({ page, baseURL }) => {
  const problems = watchForProblems(page);
  await page.goto('./about/');
  const view = aboutView(page);
  await expect(view.getByText('still playing')).toBeHidden();

  await view.getByRole('link', { name: 'close' }).click();
  await expect(view).toBeHidden();
  expect(new URL(page.url()).pathname).toBe(new URL(baseURL!).pathname);
  await expect(page.getByRole('button', { name: '▶ tap to play' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(problems).toEqual([]);
});

test('a change just before opening about is what back and a reload give', async ({ page }) => {
  await page.goto('./');
  await setupHash(page);
  const sd = page.getByRole('slider', { name: 'sd', exact: true });
  // Inside the hash's one-second write gap, so the play screen's entry keeps an older hash.
  for (let i = 0; i < 3; i++) await sd.press('PageUp');
  const value = await sd.getAttribute('aria-valuenow');
  await aboutLink(page).click();
  await expect(aboutView(page)).toBeVisible();
  const aboutHash = new URL(page.url()).hash;
  // The gap ends while about is open, which leaves the hash nothing to write.
  await page.waitForTimeout(1500);

  await page.goBack();
  await expect(aboutView(page)).toBeHidden();
  await expect(page).toHaveURL(`./${aboutHash}`);
  await page.reload();
  await expect(sd).toHaveAttribute('aria-valuenow', value!);
});

test('a held esc steps back to the play screen, not past it', async ({ page }) => {
  // A page before the app, where a second step back would land.
  await page.goto('./404.html');
  await page.goto('./');
  const hash = await setupHash(page);
  await aboutLink(page).click();
  await expect(aboutView(page)).toBeVisible();

  // Key repeat: a second esc before the first step back has landed.
  await page.evaluate(() => {
    for (let i = 0; i < 2; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  await expect(aboutView(page)).toBeHidden();
  await expect(page).toHaveURL(`./${hash}`);
  await expect(page.getByRole('heading', { name: '# rimbalzello' })).toBeVisible();
});
