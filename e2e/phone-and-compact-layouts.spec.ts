import { expect, test, type Locator, type Page } from './fixtures.ts';
import { expectLayoutRules } from './layout-rules.ts';
import { readout } from './pad-readout.ts';

// The phone and compact layouts: the strips folded into `mix`, `fx` and
// `tempo` tabs (design.md; `designs/v2-01-phone.png`,
// `designs/v2-02-phone-compact.png`), and a tall phone-width window, which
// stacks the groups instead. On a touch screen, so `// help` opens the help
// box.
test.use({ hasTouch: true });

/**
 * The shortest the pad gets above the compact layout. A copy of
 * `tunables.layouts.padMinHeight`, which sets the breakpoints: change
 * both together. (The spec cannot import tunables: its extensionless imports
 * do not resolve under the e2e tsconfig.)
 */
const PAD_MIN_HEIGHT = 200;

/**
 * The pad's height ÷ width below which the phone layout keeps its tabs. A
 * copy of `tunables.layouts.stackedPadMinShape`: change both together.
 */
const STACKED_PAD_MIN_SHAPE = 1;

const pad = (page: Page) => page.locator('[data-control="pad"]');
const stepDisplay = (page: Page) => page.getByRole('group', { name: 'step display' });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

async function box(locator: Locator) {
  const { x, y, width, height } = (await locator.boundingBox())!;
  return { left: x, top: y, right: x + width, bottom: y + height, width, height };
}

/** The sliders' accessible names in a region, top to bottom. */
async function expectSliders(region: Locator, names: string[]) {
  const sliders = region.getByRole('slider');
  await expect(sliders).toHaveCount(names.length);
  for (const [i, name] of names.entries()) await expect(sliders.nth(i)).toHaveAccessibleName(name);
}

/** The pad keeps its minimum, and the loop strip, bottom bar and footer show whole without scrolling. */
async function expectFits(page: Page) {
  expect((await box(pad(page))).height, 'pad height').toBeGreaterThanOrEqual(PAD_MIN_HEIGHT);
  await expect(page.getByRole('group', { name: 'loop' })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.bottom-bar')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('link', { name: '// source' })).toBeInViewport({ ratio: 1 });
}

const VIEWPORTS = [
  // Safari on current iPhones, short and tall: the phone layout.
  { width: 393, height: 659 },
  { width: 393, height: 750 },
  // A 360 px Android phone, the narrowest phone layout: the mute labels keep
  // 44 px beside the 32 steps.
  { width: 360, height: 680 },
  // A shorter phone, and an SE in Safari: the compact layout.
  { width: 393, height: 600 },
  { width: 375, height: 553 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('the layout rules hold on each tab, in sound mode and with help open, with room for the pad', async ({
      page,
    }) => {
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready);
      // `▶ tap to play` leaves the mute labels free, in the pad too.
      await expectLayoutRules(page);
      await page.getByRole('button', { name: '▶ tap to play' }).click();

      // Every tab holds three rows, so the pad keeps its size whichever is open.
      const padHeight = (await box(pad(page))).height;
      for (const name of ['mix', 'fx', 'tempo']) {
        await tab(page, name).click();
        await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
        await expectLayoutRules(page);
        await expectFits(page);
        expect((await box(pad(page))).height, `pad height on ${name}`).toBe(padHeight);
      }

      await page.getByRole('button', { name: '→ sound' }).click();
      for (const drum of ['bd', 'sd', 'hh']) {
        await tab(page, drum).click();
        await expect(tab(page, drum)).toHaveAttribute('aria-selected', 'true');
        await expectLayoutRules(page);
        await expectFits(page);
      }

      await page.getByRole('button', { name: '← play' }).click();
      await page.getByRole('button', { name: 'help', exact: true }).click();
      const help = page.getByRole('note', { name: 'gestures and controls' });
      await expect(help).toBeVisible();
      await expectLayoutRules(page);
      await expectFits(page);

      // The whole help box shows on the pad, clear of the step display.
      const [helpBox, padBox, steps] = [await box(help), await box(pad(page)), await box(stepDisplay(page))];
      expect(helpBox.top, 'help box top').toBeGreaterThanOrEqual(padBox.top);
      expect(helpBox.bottom, 'help box bottom').toBeLessThanOrEqual(Math.min(padBox.bottom, steps.top));
    });
  });
}

test.describe('at 393×659', () => {
  test.use({ viewport: { width: 393, height: 659 } });

  test('the strips fold into mix and fx tabs, with the step display under the pad', async ({ page }) => {
    await page.goto('./');
    await expect(tab(page, 'mix')).toHaveAttribute('aria-selected', 'true');
    await expectSliders(page.getByRole('tabpanel'), ['bd', 'sd', 'hh']);

    await tab(page, 'fx').click();
    await expect(tab(page, 'mix')).toHaveAttribute('aria-selected', 'false');
    await expectSliders(page.getByRole('tabpanel'), ['chaos', 'drift', 'drive']);

    expect((await box(stepDisplay(page))).top).toBeGreaterThanOrEqual((await box(pad(page))).bottom);
  });
});

test.describe('at 375×553', () => {
  test.use({ viewport: { width: 375, height: 553 } });

  test('the step display sits in the pad: its labels mute, and a touch between them lands on the pad', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '▶ tap to play' }).click();
    const padBox = await box(pad(page));
    const steps = await box(stepDisplay(page));
    expect(steps.top).toBeGreaterThan(padBox.top);
    expect(steps.bottom).toBeLessThanOrEqual(padBox.bottom);
    // Its lines show whole, not cut off by the pad's edge.
    const hh = await box(page.getByRole('button', { name: 'mute hh', exact: true }));
    expect(hh.bottom, 'hh line bottom').toBeLessThanOrEqual(padBox.bottom);

    const before = await readout(page);
    const mute = page.getByRole('button', { name: 'mute sd', exact: true });
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    expect(await readout(page), 'a mute leaves the position').toEqual(before);

    // On the step lines, right of the labels, on a whole pixel: WebKit and
    // Firefox drop the fraction of a pointer's coordinates.
    const x = Math.round(padBox.left + padBox.width * 0.75);
    const y = Math.round(steps.top + steps.height / 2);
    await page.mouse.click(x, y);
    const expected = { x: ((x - padBox.left) / padBox.width) * 100, y: (1 - (y - padBox.top) / padBox.height) * 100 };
    await expect
      .poll(async () => {
        const shown = await readout(page);
        return Math.max(Math.abs(shown.x - expected.x), Math.abs(shown.y - expected.y));
      }, 'the readout lands on the touch')
      .toBeLessThanOrEqual(1);
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
  });

  test('the X/Y readout keeps above the step display', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '▶ tap to play' }).click();
    const padBox = await box(pad(page));
    const steps = await box(stepDisplay(page));
    const readoutText = page.getByText(/^x \d+ · y \d+$/);

    // Just above the step display, where the readout below the position
    // would fall on it; then on it, between the labels. Far enough apart
    // not to make a double-tap.
    const touches = [
      { x: 0.4, y: steps.top - 8 },
      { x: 0.75, y: steps.top + steps.height / 2 },
    ];
    for (const touch of touches) {
      const before = await readoutText.textContent();
      await page.mouse.click(Math.round(padBox.left + padBox.width * touch.x), Math.round(touch.y));
      await expect(readoutText).not.toHaveText(before ?? '');
      const bottom = (await box(readoutText)).bottom;
      expect(bottom, `readout bottom, touch at ${Math.round(touch.y - steps.top)} px`).toBeLessThanOrEqual(steps.top);
    }
  });
});

test('from an SE in Safari up to a tall phone, the pad never gets shorter than its minimum', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('./');
  const heights: Record<number, number> = {};
  for (let height = 553; height <= 800; height++) {
    await page.setViewportSize({ width: 375, height });
    // The layout follows the play screen's size on the next frame.
    heights[height] = await pad(page).evaluate(
      (element) =>
        new Promise<number>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done(element.getBoundingClientRect().height))),
        ),
    );
  }
  const short = Object.entries(heights).filter(([, padHeight]) => padHeight < PAD_MIN_HEIGHT);
  expect(short, 'viewport heights and their pads under the minimum').toEqual([]);
});

// Tall enough for the pad to stay square under every group: the owner's
// desktop window, and a phone-width one just past the threshold.
for (const viewport of [
  { width: 550, height: 1800 },
  { width: 393, height: 1200 },
]) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('a tall window stacks mix, fx and tempo, and in sound mode the three drums, with no tabs, the pad at least square and the same size in both modes', async ({
      page,
    }) => {
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: '▶ tap to play' }).click();
      const region = (name: string) => page.getByRole('region', { name, exact: true });

      await expect(page.getByRole('tablist')).toHaveCount(0);
      await expectSliders(region('mix'), ['bd', 'sd', 'hh']);
      await expectSliders(region('fx'), ['chaos', 'drift', 'drive']);
      await expectSliders(region('tempo'), ['bpm', 'swing']);
      await expect(region('tempo').getByRole('button', { name: 'tap tempo' })).toBeVisible();
      // Tempo is on screen, so the readout opens nothing.
      await expect(page.getByRole('button', { name: /\d+ bpm$/ })).toHaveCount(0);
      await expectLayoutRules(page);
      await expectFits(page);
      const padBox = await box(pad(page));
      expect(padBox.height, 'pad height').toBeGreaterThanOrEqual(STACKED_PAD_MIN_SHAPE * padBox.width - 0.5);

      await page.getByRole('button', { name: '→ sound' }).click();
      await expect(page.getByRole('tablist')).toHaveCount(0);
      await expect(region('bass drum').getByRole('slider')).toHaveCount(5);
      await expect(region('snare drum').getByRole('slider')).toHaveCount(5);
      await expect(region('hi-hat').getByRole('slider')).toHaveCount(2);
      await expectLayoutRules(page);
      await expectFits(page);
      expect((await box(pad(page))).height, 'pad height in sound mode').toBe(padBox.height);

      // Shorter than the threshold, the tabs come back.
      await page.getByRole('button', { name: '← play' }).click();
      await page.setViewportSize({ width: viewport.width, height: 700 });
      await expect(tab(page, 'mix')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('region', { name: 'mix', exact: true })).toHaveCount(0);
      await expectLayoutRules(page);
      await expectFits(page);
    });
  });
}

test('at 375 wide the groups stack from the height where the pad is square, never flatter', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1115 });
  await page.goto('./');
  const shown: { height: number; tabs: boolean; padWidth: number; padHeight: number }[] = [];
  // Brackets the threshold: 760 px of rows + 1 × (375 − 32) px of pad = 1103.
  for (let height = 1090; height <= 1115; height++) {
    await page.setViewportSize({ width: 375, height });
    // The layout follows the play screen's size on the next frame.
    const state = await pad(page).evaluate(
      (element) =>
        new Promise<{ tabs: boolean; padWidth: number; padHeight: number }>((done) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const rect = element.getBoundingClientRect();
              done({
                tabs: document.querySelector('[role="tablist"]') !== null,
                padWidth: rect.width,
                padHeight: rect.height,
              });
            }),
          ),
        ),
    );
    shown.push({ height, ...state });
  }

  const first = shown.findIndex((state) => !state.tabs);
  expect(first, 'the first height that stacks').toBeGreaterThan(0);
  const tabbed = shown.filter((state, i) => state.tabs !== i < first).map(({ height }) => height);
  expect(tabbed, 'heights on the wrong side of the threshold').toEqual([]);
  const flat = shown
    .filter((state) => !state.tabs && state.padHeight < STACKED_PAD_MIN_SHAPE * state.padWidth - 0.5)
    .map(({ height }) => height);
  expect(flat, 'stacked heights with the pad flatter than square').toEqual([]);
  const { padWidth, padHeight } = shown[first]!;
  // Square within a pixel where it first stacks: STACKED_ROWS and
  // PAD_SIDE_MARGINS (layout.ts) match the stylesheets, neither too low nor
  // too high.
  const off = Math.abs(padHeight - STACKED_PAD_MIN_SHAPE * padWidth);
  expect(off, 'pad off square where it first stacks').toBeLessThanOrEqual(1);
});
