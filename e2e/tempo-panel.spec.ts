import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectLayoutRules } from './layout-rules.ts';

// The tempo panel at the phone viewport (design.md, `designs/v2-04-phone-tempo.png`).
test.use({ viewport: { width: 393, height: 659 } });

const readout = (page: Page) => page.getByRole('button', { name: /^\d+ bpm$/ });
const panel = (page: Page) => page.getByRole('region', { name: 'tempo' });
const button = (scope: Page | Locator, name: string) => scope.getByRole('button', { name, exact: true });

async function bpm(page: Page): Promise<number> {
  return Number((await readout(page).textContent())?.match(/\d+/)?.[0]);
}

async function swing(page: Page): Promise<number> {
  return Number((await panel(page).getByText(/^\d+%$/).textContent())?.match(/\d+/)?.[0]);
}

test('the bpm readout opens the tempo panel in place of the strips; the readout or ← play closes it', async ({
  page,
}) => {
  await page.goto('/');
  const strips = page.getByRole('slider', { name: 'bd', exact: true });
  const firstBarItem = page.locator('.bottom-bar button').first();
  await expect(firstBarItem).toHaveText('→ sound');

  await readout(page).click();
  await expect(panel(page)).toBeVisible();
  await expect(strips).toHaveCount(0);
  await expect(firstBarItem).toHaveText('← play');

  await readout(page).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(strips).toBeVisible();

  await readout(page).click();
  await button(page, '← play').click();
  await expect(panel(page)).toHaveCount(0);
  await expect(strips).toBeVisible();
  await expect(firstBarItem).toHaveText('→ sound');
});

for (const [where, name] of [
  ['in the header', 'tempo up'],
  ['in the tempo panel', 'bpm up'],
] as const) {
  test(`holding + ${where} raises bpm step after step, stops on release and never passes 200`, async ({ page }) => {
    // Time stands still unless the test moves it, so the hold lasts exactly as long as asked.
    await page.clock.install({ time: 0 });
    await page.goto('/');
    await page.clock.pauseAt(1000);
    await readout(page).click();
    const plus = button(page, name);
    const start = await bpm(page);

    // A click is one step, however it is pressed.
    await plus.click();
    expect(await bpm(page)).toBe(start + 1);

    // Held well past the repeat delay (about 400 ms), it keeps stepping.
    await plus.hover();
    await page.mouse.down();
    await page.clock.runFor(2000);
    const held = await bpm(page);
    expect(held).toBeGreaterThan(start + 2);

    await page.mouse.up();
    await page.clock.runFor(2000);
    expect(await bpm(page)).toBe(held);

    // Held long enough to climb far past the top, it stops at 200.
    await page.mouse.down();
    await page.clock.runFor(60_000);
    await page.mouse.up();
    expect(await bpm(page)).toBe(200);
  });
}

test('swing stays at 50 % on − and at 75 % on +', async ({ page }) => {
  await page.goto('/');
  await readout(page).click();
  const minus = button(panel(page), 'swing down');
  const plus = button(panel(page), 'swing up');

  for (let i = (await swing(page)) - 50; i > 0; i--) await minus.click();
  await expect.poll(() => swing(page)).toBe(50);
  await minus.click();
  expect(await swing(page)).toBe(50);

  for (let i = 0; i < 25; i++) await plus.click();
  await expect.poll(() => swing(page)).toBe(75);
  await plus.click();
  expect(await swing(page)).toBe(75);
});

test('tapping faster than 200 bpm sets the tempo to 200', async ({ page }) => {
  await page.goto('/');
  await readout(page).click();
  const tap = (await button(panel(page), 'tap tempo').boundingBox())!;
  await page.mouse.move(tap.x + tap.width / 2, tap.y + tap.height / 2);
  for (let i = 0; i < 4; i++) {
    await page.mouse.down();
    await page.mouse.up();
  }
  expect(await bpm(page)).toBe(200);
});

test('the play screen keeps the layout rules with the tempo panel open', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
  await readout(page).click();
  await expect(panel(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expectLayoutRules(page);
});
