import { expect, test, type Locator, type Page } from './fixtures.ts';
import { expectLayoutRules } from './layout-rules.ts';
import { readout } from './pad-readout.ts';

// The phone and compact layouts: the strips folded into `mix`, `fx` and
// `tempo` tabs (design.md; `designs/v2-01-phone.png`,
// `designs/v2-02-phone-compact.png`). On a touch screen, so `// help` opens
// the help box.
test.use({ hasTouch: true });

/**
 * The shortest the pad gets above the compact layout. A copy of
 * `tunables.layouts.padMinHeight`, which sets the breakpoints: change
 * both together. (The spec cannot import tunables: its extensionless imports
 * do not resolve under the e2e tsconfig.)
 */
const PAD_MIN_HEIGHT = 200;

const pad = (page: Page) => page.locator('[data-control="pad"]');
const stepDisplay = (page: Page) => page.getByRole('group', { name: 'step display' });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

async function box(locator: Locator) {
  const { x, y, width, height } = (await locator.boundingBox())!;
  return { left: x, top: y, right: x + width, bottom: y + height, width, height };
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
    const strips = page.getByRole('tabpanel').getByRole('slider');
    async function expectStrips(names: string[]) {
      await expect(strips).toHaveCount(names.length);
      for (const [i, name] of names.entries()) await expect(strips.nth(i)).toHaveAccessibleName(name);
    }

    await expect(tab(page, 'mix')).toHaveAttribute('aria-selected', 'true');
    await expectStrips(['bd', 'sd', 'hh']);

    await tab(page, 'fx').click();
    await expect(tab(page, 'mix')).toHaveAttribute('aria-selected', 'false');
    await expectStrips(['chaos', 'drift', 'drive']);

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
