import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectLayoutRules } from './layout-rules.ts';

// The wide layouts (design.md, "Tablets" and "Laptops"): the tablet layout
// in portrait (`designs/v2-07-tablet.png`), the laptop layout on laptops and
// on tablets in landscape, and the rotate hint on phones in landscape.

const DRUMS = ['bd', 'sd', 'hh'] as const;
/** How many sound sliders each drum has (PRD stories 29–31). */
const SOUND_SLIDERS = { bd: 5, sd: 5, hh: 1 };

const readout = (page: Page) => page.getByRole('button', { name: /^\d+ bpm$/ });
const tab = (page: Page, drum: string) => page.getByRole('tab', { name: drum, exact: true });

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`no box for ${locator.toString()}`);
  return { ...found, right: found.x + found.width, bottom: found.y + found.height };
}

async function start(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
  await page.evaluate(() => document.fonts.ready);
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1106, height: 820 },
]) {
  test.describe(`laptop layout at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('pad on the left, everything else on the right, within the layout rules; tap tempo too', async ({
      page,
    }) => {
      await start(page);
      const pad = await box(page.locator('[data-control="pad"]'));
      for (const part of [
        page.getByRole('group', { name: 'step display' }),
        page.getByRole('slider', { name: 'chaos' }),
        page.getByRole('group', { name: 'loop' }),
        page.getByRole('region', { name: 'hh' }),
      ]) {
        expect((await box(part)).x, `${part.toString()} right of the pad`).toBeGreaterThanOrEqual(pad.right);
      }
      await expectLayoutRules(page);

      // The tempo panel only adds tap tempo: the strips stay.
      await readout(page).click();
      await expect(page.getByRole('button', { name: 'tap tempo' })).toBeInViewport();
      await expect(page.getByRole('slider', { name: 'chaos' })).toBeInViewport();
      await expectLayoutRules(page);

      await readout(page).click();
      await expect(page.getByRole('button', { name: 'tap tempo' })).toHaveCount(0);
    });
  });
}

// Laptop windows too short for the three sound sections side by side: a
// 1366×768 screen under a taskbar, a 1080p laptop at 150 % scaling. They
// keep the laptop layout, with the sound folded into the drum tabs.
for (const viewport of [
  { width: 1366, height: 657 },
  { width: 1280, height: 600 },
  { width: 1280, height: 580 },
]) {
  test.describe(`laptop layout at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('folds the sound into the drum tabs, within the layout rules on each tab; tap tempo too', async ({
      page,
    }) => {
      await start(page);
      const pad = await box(page.locator('[data-control="pad"]'));
      for (const part of [
        page.getByRole('group', { name: 'step display' }),
        page.getByRole('slider', { name: 'chaos' }),
        page.getByRole('group', { name: 'loop' }),
        page.getByRole('tablist', { name: 'sound' }),
      ]) {
        expect((await box(part)).x, `${part.toString()} right of the pad`).toBeGreaterThanOrEqual(pad.right);
      }

      for (const drum of DRUMS) {
        await tab(page, drum).click();
        await expect(page.getByRole('tabpanel').getByRole('slider')).toHaveCount(SOUND_SLIDERS[drum]);
        await expectLayoutRules(page);
        expect((await box(page.locator('[data-control="pad"]'))).height, 'the pad keeps its size').toBe(pad.height);
      }

      await readout(page).click();
      await expect(page.getByRole('button', { name: 'tap tempo' })).toBeInViewport();
      await expect(page.getByRole('slider', { name: 'chaos' })).toBeInViewport();
      await expectLayoutRules(page);
    });
  });
}

test.describe('a laptop window made shorter', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('folds the sound sections into the drum tabs, and unfolds them when it grows back', async ({ page }) => {
    await start(page);
    const hh = page.getByRole('region', { name: 'hh', exact: true });
    await expect(hh).toBeInViewport();

    await page.setViewportSize({ width: 1280, height: 600 });
    await expect(page.getByRole('tablist', { name: 'sound' })).toBeInViewport();
    await expect(hh).toHaveCount(0);
    await expectLayoutRules(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(hh).toBeInViewport();
  });
});

test.describe('laptop layout at 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('all three sound sections and swing show without opening a panel or tab', async ({ page }) => {
    await start(page);
    await expect(page.getByRole('tab')).toHaveCount(0);
    for (const drum of DRUMS) {
      const section = page.getByRole('region', { name: drum, exact: true });
      await expect(section.getByRole('slider')).toHaveCount(SOUND_SLIDERS[drum]);
      for (const slider of await section.getByRole('slider').all()) await expect(slider).toBeInViewport();
    }

    const swing = page.getByText(/^\d+%$/);
    await expect(swing).toHaveText('56%');
    await page.getByRole('button', { name: 'swing up', exact: true }).click();
    await expect(swing).toHaveText('57%');
  });

  test('the outermost map node marks sit on the pad edges', async ({ page }) => {
    await page.goto('./');
    const pad = await box(page.locator('[data-control="pad"]'));
    const centres = await page
      .locator('[data-control="pad"] .map-node')
      .evaluateAll((marks) =>
        marks.map((mark) => {
          const { left, top, width, height } = mark.getBoundingClientRect();
          return { x: left + width / 2, y: top + height / 2 };
        }),
      );
    expect(centres).toHaveLength(25);

    const xs = centres.map((centre) => centre.x);
    const ys = centres.map((centre) => centre.y);
    expect(Math.min(...xs)).toBeCloseTo(pad.x, 0);
    expect(Math.max(...xs)).toBeCloseTo(pad.right, 0);
    expect(Math.min(...ys)).toBeCloseTo(pad.y, 0);
    expect(Math.max(...ys)).toBeCloseTo(pad.bottom, 0);
  });
});

test.describe('tablet layout at 820×1106', () => {
  test.use({ viewport: { width: 820, height: 1106 } });

  test('pad on top; step display and strips on the left, loop strip and drum tabs on the right', async ({
    page,
  }) => {
    await start(page);
    const pad = await box(page.locator('[data-control="pad"]'));
    const steps = await box(page.getByRole('group', { name: 'step display' }));
    const strips = await box(page.getByRole('slider', { name: 'drive' }));
    const loop = await box(page.getByRole('group', { name: 'loop' }));
    const tabs = await box(page.getByRole('tablist', { name: 'sound' }));

    for (const below of [steps, loop]) expect(below.y).toBeGreaterThanOrEqual(pad.bottom);
    expect(loop.x).toBeGreaterThanOrEqual(steps.right);
    expect(tabs.x).toBeGreaterThanOrEqual(strips.right);
    expect(tabs.y).toBeGreaterThanOrEqual(loop.bottom);
    await expect(page.getByRole('button', { name: '→ sound' })).toHaveCount(0);
  });

  test('keeps the layout rules on each drum tab and with the tempo panel open', async ({ page }) => {
    await start(page);
    const padHeight = (await box(page.locator('[data-control="pad"]'))).height;
    for (const drum of DRUMS) {
      await tab(page, drum).click();
      await expect(page.getByRole('tabpanel').getByRole('slider')).toHaveCount(SOUND_SLIDERS[drum]);
      await expectLayoutRules(page);
      expect((await box(page.locator('[data-control="pad"]'))).height, 'the pad keeps its size').toBe(padHeight);
    }

    await readout(page).click();
    const panel = page.getByRole('region', { name: 'tempo' });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('slider', { name: 'chaos' })).toHaveCount(0);
    await expectLayoutRules(page);

    // With the strips gone, the drum tabs alone set their row's height.
    const panelPadHeight = (await box(page.locator('[data-control="pad"]'))).height;
    for (const drum of DRUMS) {
      await tab(page, drum).click();
      expect((await box(page.locator('[data-control="pad"]'))).height, 'the pad keeps its size').toBe(panelPadHeight);
    }

    await page.getByRole('button', { name: '← play' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('slider', { name: 'chaos' })).toBeVisible();
  });
});

test.describe('a phone in landscape', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true });

  test('shows the rotate hint with no play control reachable; a wide, tall-enough viewport shows the laptop layout', async ({
    page,
  }) => {
    await page.goto('./');
    const hint = page.getByRole('status').filter({ hasText: 'turn the phone upright' });
    await expect(hint).toBeVisible();
    await expect(page.getByRole('button', { name: '▶ tap to play' })).toBeHidden();

    // Neither a tap where the pad would be, nor the Tab key, nor space reaches the play screen.
    await page.mouse.click(333, 187);
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('main'))).toBe(false);
    }
    await page.keyboard.press('Space');

    // An iPad in landscape: the laptop layout, still waiting for its first tap.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(hint).toHaveCount(0);
    await expect(page.getByRole('button', { name: '▶ tap to play' })).toBeVisible();
    const pad = await box(page.locator('[data-control="pad"]'));
    expect((await box(page.getByRole('group', { name: 'step display' }))).x).toBeGreaterThanOrEqual(pad.right);
    await expectLayoutRules(page);
  });
});
