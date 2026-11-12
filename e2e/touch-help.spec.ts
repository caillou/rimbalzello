import { expect, test, type Page } from '@playwright/test';
import { expectLayoutRules } from './layout-rules.ts';

// Help on a touch screen at the phone viewport (`designs/v2-06-phone-help.png`),
// and the first-launch hint inside the pad. Every test starts on a fresh profile.
test.use({ viewport: { width: 393, height: 659 }, hasTouch: true });

const FIRST_LAUNCH_HINT = 'tap · drag · two-finger tap undo · double-tap+slide fine';

const pad = (page: Page) => page.locator('[data-control="pad"]');

/** The X/Y readout as numbers, 0–100. */
async function readout(page: Page): Promise<{ x: number; y: number }> {
  const text = await page.getByText(/^x \d+ · y \d+$/).textContent();
  const [, x, y] = /^x (\d+) · y (\d+)$/.exec(text ?? '') ?? [];
  return { x: Number(x), y: Number(y) };
}

/** Taps the pad at this point on the page and waits for the readout to land there. */
async function tapPad(page: Page, x: number, y: number) {
  const box = (await pad(page).boundingBox())!;
  await page.touchscreen.tap(x, y);
  const expected = { x: ((x - box.x) / box.width) * 100, y: (1 - (y - box.y) / box.height) * 100 };
  await expect
    .poll(async () => {
      const shown = await readout(page);
      return Math.max(Math.abs(shown.x - expected.x), Math.abs(shown.y - expected.y));
    }, 'the readout lands on the tap')
    .toBeLessThanOrEqual(1);
}

test('// help opens a box over the pad, the pad plays under it, and // help closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '▶ tap to play' }).tap();

  const help = page.getByRole('button', { name: 'help', exact: true });
  const box = page.getByRole('note', { name: 'gestures and controls' });
  await expect(help).toHaveAttribute('aria-pressed', 'false');
  await expect(box).toBeHidden();

  await help.tap();
  await expect(help).toHaveAttribute('aria-pressed', 'true');
  await expect(box).toBeVisible();
  await expect(box).toContainText('two-finger tap: undo');
  await expect(help).toHaveCSS('color', 'rgb(255, 255, 255)');

  // A tap on the box lands on the pad below it; so does one above it.
  const over = (await box.boundingBox())!;
  await tapPad(page, over.x + over.width * 0.25, over.y + over.height / 2);
  const around = (await pad(page).boundingBox())!;
  await tapPad(page, around.x + around.width * 0.75, around.y + 12);
  await expect(box).toBeVisible();

  await page.evaluate(() => document.fonts.ready);
  await expectLayoutRules(page);

  await help.tap();
  await expect(help).toHaveAttribute('aria-pressed', 'false');
  await expect(box).toBeHidden();
});

test('the first-launch hint shows until the first pad tap and stays gone after a reload', async ({ page }) => {
  await page.goto('/');
  const hint = page.getByText(FIRST_LAUNCH_HINT);
  await expect(hint).toBeVisible();

  // Tap to play is not a pad move.
  await page.getByRole('button', { name: '▶ tap to play' }).tap();
  await expect(hint).toBeVisible();

  const box = (await pad(page).boundingBox())!;
  await tapPad(page, box.x + box.width * 0.7, box.y + box.height * 0.6);
  await expect(hint).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: '▶ tap to play' })).toBeVisible();
  await expect(hint).toBeHidden();
});
