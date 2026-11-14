import { DRUM_NAMES, DRUMS, type Drum } from './drums.ts';
import { expect, test, type Locator, type Page } from './fixtures.ts';
import { CONTROLS, expectLayoutRules } from './layout-rules.ts';

// The wide layouts (design.md, "Tablets" and "Laptops"): the tablet layout
// in portrait (`designs/v2-07-tablet.png`), the laptop layout on laptops and
// on tablets in landscape, and the rotate hint on phones in landscape. Both
// show tempo (bpm, swing and tap tempo) as a group of its own, without tabs.

/** How many sound sliders each drum has (PRD stories 29–31). */
const SOUND_SLIDERS = { bd: 5, sd: 5, hh: 2 };

const tab = (page: Page, drum: Drum) => page.getByRole('tab', { name: DRUM_NAMES[drum], exact: true });
const tempo = (page: Page) => page.getByRole('group', { name: 'tempo' });

/** Tempo's controls show, each whole, without opening anything. */
async function expectTempoShown(page: Page) {
  for (const name of ['bpm', 'swing']) {
    await expect(tempo(page).getByRole('slider', { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
  await expect(tempo(page).getByRole('button', { name: 'tap tempo', exact: true })).toBeInViewport({ ratio: 1 });
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`no box for ${locator.toString()}`);
  return { ...found, right: found.x + found.width, bottom: found.y + found.height };
}

/**
 * The step display, the strips, tempo, the loop strip and `sound` (the
 * sound sections, or the drum tabs when folded) right of the pad. Returns the pad's box.
 */
async function expectRightOfPad(page: Page, sound: Locator) {
  const pad = await box(page.locator('[data-control="pad"]'));
  for (const part of [
    page.getByRole('group', { name: 'step display' }),
    page.getByRole('slider', { name: 'chaos' }),
    tempo(page),
    page.getByRole('group', { name: 'loop' }),
    sound,
  ]) {
    expect((await box(part)).x, `${part.toString()} right of the pad`).toBeGreaterThanOrEqual(pad.right);
  }
  return pad;
}

async function start(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
  await page.evaluate(() => document.fonts.ready);
}

// 1024×768, an iPad in landscape, has the narrowest right column (520 px).
// 1440×900 and 1920×1080 zoom the layout, by 1.125 and 1.35. 1024×700 is the
// smallest window the laptop zoom's fit cap assumes the layout fits in
// (tunables.layouts.laptopZoom: fitWidth × soundSectionsMinHeight).
for (const viewport of [
  { width: 1024, height: 700 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1106, height: 820 },
  { width: 1024, height: 768 },
]) {
  test.describe(`laptop layout at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('pad on the left, everything else on the right, tempo too, within the layout rules', async ({ page }) => {
      await start(page);
      await expectRightOfPad(page, page.getByRole('region', { name: DRUM_NAMES.hh }));
      await expectTempoShown(page);
      await expectLayoutRules(page);
    });
  });
}

// Laptop windows too short for the three sound sections side by side: a
// 1366×768 screen under a taskbar, a 1080p laptop at 150 % scaling, and
// small windows with the narrowest right column (520 px). They keep the
// laptop layout, with the sound folded into the drum tabs.
for (const viewport of [
  { width: 1366, height: 657 },
  { width: 1280, height: 600 },
  { width: 1280, height: 580 },
  { width: 800, height: 600 },
  { width: 700, height: 600 },
]) {
  test.describe(`laptop layout at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('folds the sound into the drum tabs, within the layout rules on each tab, tempo still shown', async ({
      page,
    }) => {
      await start(page);
      const pad = await expectRightOfPad(page, page.getByRole('tablist', { name: 'sound' }));
      await expectTempoShown(page);

      for (const drum of DRUMS) {
        await tab(page, drum).click();
        await expect(page.getByRole('tabpanel').getByRole('slider')).toHaveCount(SOUND_SLIDERS[drum]);
        await expectLayoutRules(page);
        expect((await box(page.locator('[data-control="pad"]'))).height, 'the pad keeps its size').toBe(pad.height);
      }
    });
  });
}

test.describe('a laptop window made shorter', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('folds the sound sections into the drum tabs, and unfolds them when it grows back', async ({ page }) => {
    await start(page);
    const hh = page.getByRole('region', { name: DRUM_NAMES.hh, exact: true });
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

  test('all three sound sections and swing show without opening a tab', async ({ page }) => {
    await start(page);
    await expect(page.getByRole('tab')).toHaveCount(0);
    for (const drum of DRUMS) {
      const section = page.getByRole('region', { name: DRUM_NAMES[drum], exact: true });
      await expect(section.getByRole('slider')).toHaveCount(SOUND_SLIDERS[drum]);
      for (const slider of await section.getByRole('slider').all()) await expect(slider).toBeInViewport();
    }

    // Grabbed by its thumb with the mouse, the swing strip stays at 56 %,
    // then moves from there by the distance dragged.
    const swing = tempo(page).getByRole('slider', { name: 'swing', exact: true });
    await expect(swing).toContainText('56%');
    const row = await box(swing);
    const track = await box(swing.locator('.strip-track'));
    const thumb = await box(swing.locator('.strip-thumb'));
    const y = Math.round(row.y + row.height / 2);
    // Off the thumb's centre but on it, on a whole px: a jump would show here.
    const x = Math.round(thumb.x + thumb.width / 2) + 4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(swing).toHaveAttribute('aria-valuenow', '56');
    // Past the drag threshold, then 40 px further.
    await page.mouse.move(x + 6, y);
    await page.mouse.move(x + 46, y, { steps: 8 });
    await page.mouse.up();
    const range = 75 - 50;
    expect(Math.abs(Number(await swing.getAttribute('aria-valuenow')) - (56 + (40 / track.width) * range))).toBeLessThanOrEqual(
      1 + range / track.width,
    );
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

// A window larger than 1280×800 zooms the laptop layout: every size in it
// grows by the smaller of width ÷ 1280 and height ÷ 800, from 1 up to 2
// (tunables.layouts.laptopZoom). Hairlines stay 1 px.

const chaos = (page: Page) => page.getByRole('slider', { name: 'chaos', exact: true });
/** The chaos strip's label: 15 px unzoomed. */
const chaosLabel = (page: Page) => chaos(page).getByText('chaos', { exact: true });

/**
 * What the zoom tests compare: the boxes of every control the layout
 * rules check, the step display, the keycaps, the help box and the footer,
 * and the font size of every text shown on the play screen.
 */
async function sizes(page: Page) {
  return page.evaluate((boxed) => {
    const shown = (element: Element) => {
      const { width, height } = element.getBoundingClientRect();
      return width > 0 && height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const name = (element: Element) =>
      `${element.tagName.toLowerCase()} "${element.getAttribute('aria-label') ?? element.textContent?.replace(/\s+/g, ' ').trim()}"`;
    const boxes = [...document.querySelectorAll(boxed)].filter(shown).map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { name: name(element), x, y, width, height };
    });
    const texts = [...document.querySelectorAll('main *')]
      .filter(
        (element) =>
          shown(element) && [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
      )
      .map((element) => ({ name: name(element), fontSize: parseFloat(getComputedStyle(element).fontSize) }));
    return { boxes, texts };
  }, `${CONTROLS}, [aria-label="step display"], .keycap, .help-box, .footer`);
}

type Sizes = Awaited<ReturnType<typeof sizes>>;

/** The play screen before the first tap, its fonts in and its pad drawn. */
async function load(page: Page) {
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  // The pad writes its readout on its first frame; until then `sizes` misses that text.
  await expect(page.getByText(/^x \d+ · y \d+$/)).toBeVisible();
}

/** Every text whose font size is not `factor` times what it was: none if the layout zoomed by `factor`. */
function textsNotZoomed(unzoomed: Sizes, zoomed: Sizes, factor: number): string[] {
  if (zoomed.texts.length !== unzoomed.texts.length) return ['other texts shown'];
  return unzoomed.texts.flatMap((before, i) => {
    const after = zoomed.texts[i]!;
    return Math.abs(after.fontSize - factor * before.fontSize) > 0.1
      ? [`${before.name} font size ${before.fontSize} → ${after.fontSize}`]
      : [];
  });
}

/**
 * Every box and font size that is not twice what it was: none if the layout
 * doubled. A box may be 3 px off. Borders stay 1 px, so a bordered box sized
 * by its content, `tap tempo` or the help box, comes out 2 px short of
 * double, and what follows it 2 px off. The help box's `→` is not in the
 * self-hosted font, and the fallback's line box need not double.
 */
function notDoubled(unzoomed: Sizes, zoomed: Sizes): string[] {
  if (zoomed.boxes.length !== unzoomed.boxes.length) return ['other parts shown'];
  const tenth = (value: number) => Math.round(value * 10) / 10;
  const off: string[] = [];
  unzoomed.boxes.forEach((before, i) => {
    const after = zoomed.boxes[i]!;
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      if (Math.abs(after[key] - 2 * before[key]) > 3) {
        off.push(`${before.name} ${key} ${tenth(before[key])} → ${tenth(after[key])}`);
      }
    }
  });
  return [...off, ...textsNotZoomed(unzoomed, zoomed, 2)];
}

// Twice 1280×800 zooms by exactly 2, so every position, size and font size
// doubles. A px size the stylesheets missed shows as a part that does not.
// The help box shows on a touch screen, the keycaps without one.
for (const touch of [false, true]) {
  test.describe(`a laptop window resized from 1280×800 to 2560×1600${touch ? ', on a touch screen' : ''}`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, hasTouch: touch });

    test(`zooms by 2: every control, ${touch ? 'the help box' : 'the footer keycap'}, gap and text twice the size`, async ({
      page,
    }) => {
      await load(page);
      if (touch) {
        await page.getByRole('button', { name: 'help', exact: true }).click();
        await expect(page.getByRole('note', { name: 'gestures and controls' })).toBeVisible();
      }
      const unzoomed = await sizes(page);
      await page.setViewportSize({ width: 2560, height: 1600 });
      await expect.poll(async () => notDoubled(unzoomed, await sizes(page))).toEqual([]);
    });
  });
}

// 1600×1200: width ÷ 1280 is 1.25, height ÷ 800 is 1.5, so the width sets the zoom.
test.describe('a laptop window resized from 1280×800 to 1600×1200', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('zooms by the width, 1.25: every text 1.25 times the size, within the layout rules', async ({ page }) => {
    await load(page);
    const unzoomed = await sizes(page);
    await page.setViewportSize({ width: 1600, height: 1200 });
    await expect.poll(async () => textsNotZoomed(unzoomed, await sizes(page), 1.25)).toEqual([]);
    await expectLayoutRules(page);
  });
});

// 1920×1080: height ÷ 800 is 1.35, width ÷ 1280 is 1.5, so the height sets the zoom.
test.describe('a laptop window resized from 1280×800 to 1920×1080', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('zooms by the height, 1.35, with the strip track, its thumb and the pad position on whole px, the thumb centred', async ({
    page,
  }) => {
    await load(page);
    const parts = async () => ({
      track: await box(chaos(page).locator('.strip-track')),
      thumb: await box(chaos(page).locator('.strip-thumb')),
      position: await box(page.locator('[data-control="pad"] .pad-position')),
    });
    const unzoomed = { sizes: await sizes(page), parts: await parts() };
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(async () => textsNotZoomed(unzoomed.sizes, await sizes(page), 1.35)).toEqual([]);

    // Whole px, and within half a px of 1.35 times the size at 1280×800 for
    // each length rounded in it: the track is one, the position two halves,
    // the thumb the track and an overhang on either side.
    const zoomed = await parts();
    const expectRounded = (after: number, before: number, roundings: number) => {
      expect(Number.isInteger(after), `${after} px is whole`).toBe(true);
      expect(Math.abs(after - 1.35 * before)).toBeLessThanOrEqual(roundings / 2);
    };
    expectRounded(zoomed.track.height, unzoomed.parts.track.height, 1);
    expectRounded(zoomed.position.width, unzoomed.parts.position.width, 2);
    expect(zoomed.position.height).toBe(zoomed.position.width);
    expectRounded(zoomed.thumb.width, unzoomed.parts.thumb.width, 3);
    expect(zoomed.thumb.height).toBe(zoomed.thumb.width);
    expect(zoomed.thumb.y + zoomed.thumb.height / 2).toBeCloseTo(zoomed.track.y + zoomed.track.height / 2, 1);

    // Zoomed, a mouse click a quarter of the way along the track still sets a quarter.
    await page.mouse.click(Math.round(zoomed.track.x + 0.25 * zoomed.track.width), Math.round(zoomed.track.y));
    expect(Math.abs(Number(await chaos(page).getAttribute('aria-valuenow')) - 25)).toBeLessThanOrEqual(
      1 + 100 / zoomed.track.width,
    );
  });
});

test.describe('a laptop window at 2800×1760', () => {
  test.use({ viewport: { width: 2800, height: 1760 } });

  test('zooms by 2 at most, within the layout rules', async ({ page }) => {
    await start(page);
    await expect(chaosLabel(page)).toHaveCSS('font-size', '30px');
    expect((await box(chaos(page))).height).toBe(88);
    await expectLayoutRules(page);
  });
});

// Short and wide: the height keeps the zoom at 1, so the right column stays
// at its widest, 680 px, and the pad takes the extra width.
for (const viewport of [
  { width: 2560, height: 800 },
  { width: 1920, height: 720 },
]) {
  test.describe(`a laptop window at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('does not zoom: the pad takes the extra width, within the layout rules', async ({ page }) => {
      await start(page);
      await expect(chaosLabel(page)).toHaveCSS('font-size', '15px');
      expect((await box(chaos(page))).height).toBe(44);
      expect((await box(page.getByRole('group', { name: 'step display' }))).width).toBe(680);
      expect((await box(page.locator('[data-control="pad"]'))).width).toBeGreaterThan(viewport.width / 2);
      await expectLayoutRules(page);
    });
  });
}

test.describe('a laptop window made larger, then smaller again', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('zooms with it, within the layout rules, and back', async ({ page }) => {
    await start(page);
    await expect(chaosLabel(page)).toHaveCSS('font-size', '15px');

    // 2560×1440 zooms by 1.8: 15 px × 1.8.
    await page.setViewportSize({ width: 2560, height: 1440 });
    await expect(chaosLabel(page)).toHaveCSS('font-size', '27px');
    await expectLayoutRules(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(chaosLabel(page)).toHaveCSS('font-size', '15px');
  });
});

// Browser zoom on a laptop window: Playwright can't press Cmd +, so each row
// sets the viewport to the page's size in CSS px at that zoom and pins the
// outer window (e2e/fixtures.ts). The layout's zoom comes from the outer
// window less its toolbar, and is capped by the play screen ÷ 1024×700
// (tunables.layouts.laptopZoom). On screen the label is its CSS size times
// the browser zoom.
for (const row of [
  // 110 % in a 1760×1180 window, 80 px of toolbar: 1100 ÷ 800 = 1.375, 22.7 px
  // on screen, where the play screen alone gives 1.25, 20.6 px.
  { zoom: '110 %', viewport: { width: 1600, height: 1000 }, outer: { width: 1760, height: 1180 }, label: 20.625 },
  // 125 % in a 1920×1130 window: the window wants 1.3125, the play screen
  // holds 840 ÷ 700 = 1.2, 22.5 px on screen, where the play screen alone
  // gives 1.05, 19.7 px.
  { zoom: '125 %', viewport: { width: 1536, height: 840 }, outer: { width: 1920, height: 1130 }, label: 18 },
]) {
  test.describe(`a ${row.outer.width}×${row.outer.height} laptop window at ${row.zoom} browser zoom`, () => {
    test.use({ viewport: row.viewport, browserWindow: row.outer });

    test('Cmd + makes the layout larger, as far as the page holds it, within the layout rules', async ({ page }) => {
      await start(page);
      await expect
        .poll(async () => parseFloat(await chaosLabel(page).evaluate((label) => getComputedStyle(label).fontSize)))
        .toBeCloseTo(row.label, 1);
      await expectRightOfPad(page, page.getByRole('region', { name: DRUM_NAMES.hh }));
      await expectTempoShown(page);
      await expectLayoutRules(page);
    });
  });
}

test.describe('a portrait monitor at 1440×2560', () => {
  test.use({ viewport: { width: 1440, height: 2560 } });

  test('keeps the tablet layout, unzoomed', async ({ page }) => {
    await start(page);
    await expect(page.getByRole('tablist', { name: 'sound' })).toBeVisible();
    await expect(chaosLabel(page)).toHaveCSS('font-size', '15px');
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
    const sound = await box(page.getByRole('tabpanel'));

    for (const below of [steps, loop]) expect(below.y).toBeGreaterThanOrEqual(pad.bottom);
    expect(loop.x).toBeGreaterThanOrEqual(steps.right);
    expect(tabs.x).toBeGreaterThanOrEqual(strips.right);
    expect(tabs.y).toBeGreaterThanOrEqual(loop.bottom);
    expect((await box(tempo(page))).y, 'tempo under the strips and the sound').toBeGreaterThanOrEqual(
      Math.max(strips.bottom, sound.bottom),
    );
    await expectTempoShown(page);
    await expect(page.getByRole('button', { name: '→ sound' })).toHaveCount(0);
  });

  test('keeps the layout rules and the pad size on each drum tab', async ({ page }) => {
    await start(page);
    const padHeight = (await box(page.locator('[data-control="pad"]'))).height;
    for (const drum of DRUMS) {
      await tab(page, drum).click();
      await expect(page.getByRole('tabpanel').getByRole('slider')).toHaveCount(SOUND_SLIDERS[drum]);
      await expectLayoutRules(page);
      expect((await box(page.locator('[data-control="pad"]'))).height, 'the pad keeps its size').toBe(padHeight);
    }
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
