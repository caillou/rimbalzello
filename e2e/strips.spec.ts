import { expect, test, type Locator, type Page } from './fixtures.ts';

// Strips under a mouse (#26), on the laptop layout: a click on the track
// sets the value there and the drag that follows tracks the pointer; a press
// on the thumb grabs it, and one on the value drags relative, as a touch
// does. Touch is in phone-play-screen.spec.ts and tempo.spec.ts.
test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
});

const slider = (page: Page, name: string) => page.getByRole('slider', { name, exact: true });
const valueOf = async (strip: Locator) => Number(await strip.getAttribute('aria-valuenow'));

/**
 * Where to point at a strip, on whole px, since WebKit and Firefox drop the
 * fraction of a pointer's coordinates; and how close a value can land: a
 * pixel's worth of the shown range, plus rounding.
 */
async function geometry(strip: Locator) {
  const track = (await strip.locator('.strip-track').boundingBox())!;
  const thumb = (await strip.locator('.strip-thumb').boundingBox())!;
  const row = (await strip.boundingBox())!;
  const min = Number(await strip.getAttribute('aria-valuemin'));
  const max = Number(await strip.getAttribute('aria-valuemax'));
  return {
    y: Math.round(row.y + row.height / 2),
    /** `fraction` of the way along the track. */
    at: (fraction: number) => Math.round(track.x + fraction * track.width),
    thumbCentre: Math.round(thumb.x + thumb.width / 2),
    /** The shown value `fraction` of the way along the track. */
    shownAt: (fraction: number) => min + fraction * (max - min),
    /** The shown change for `px` dragged. */
    shownBy: (px: number) => (px / track.width) * (max - min),
    tolerance: 1 + (max - min) / track.width,
  };
}

test('a mouse click on the track sets the value there; the drag after it follows the pointer, past the end and back', async ({
  page,
}) => {
  const chaos = slider(page, 'chaos');
  const { y, at, shownAt, tolerance } = await geometry(chaos);

  for (const fraction of [0.25, 0.75]) {
    await page.mouse.click(at(fraction), y);
    expect(Math.abs((await valueOf(chaos)) - shownAt(fraction))).toBeLessThanOrEqual(tolerance);
  }

  await page.mouse.move(at(0.25), y);
  await page.mouse.down();
  expect(Math.abs((await valueOf(chaos)) - 25)).toBeLessThanOrEqual(tolerance);
  // To the window's edge: outside it, Firefox under Playwright reports the moves at 0 with no button down.
  await page.mouse.move(page.viewportSize()!.width - 1, y, { steps: 8 });
  await expect(chaos).toHaveAttribute('aria-valuenow', '100');
  await page.mouse.move(at(0.5), y, { steps: 8 });
  await page.mouse.up();
  expect(Math.abs((await valueOf(chaos)) - 50)).toBeLessThanOrEqual(tolerance);
});

test('a mouse click halfway along the swing track sets swing halfway through its range', async ({ page }) => {
  const swing = slider(page, 'swing');
  const { y, at } = await geometry(swing);
  await page.mouse.click(at(0.5), y);
  expect([62, 63]).toContain(await valueOf(swing));
});

test('a mouse press on the thumb grabs it without moving the value; a drag moves it by the distance', async ({
  page,
}) => {
  const chaos = slider(page, 'chaos');
  const { y, thumbCentre, shownBy, tolerance } = await geometry(chaos);
  const start = await valueOf(chaos);

  // Off the thumb's centre but on it: a jump would show here.
  const x = thumbCentre + 4;
  await page.mouse.move(x, y);
  await page.mouse.down();
  expect(await valueOf(chaos)).toBe(start);
  // Past the drag threshold, then 40 px further.
  await page.mouse.move(x + 6, y);
  expect(await valueOf(chaos)).toBe(start);
  await page.mouse.move(x + 46, y, { steps: 8 });
  await page.mouse.up();
  expect(Math.abs((await valueOf(chaos)) - (start + shownBy(40)))).toBeLessThanOrEqual(tolerance);
});

test('a mouse press on the value changes nothing; a drag from there moves it by the distance', async ({ page }) => {
  const chaos = slider(page, 'chaos');
  const { y, shownBy, tolerance } = await geometry(chaos);
  const start = await valueOf(chaos);
  const shown = (await chaos.locator('.strip-value').boundingBox())!;
  const x = Math.round(shown.x + shown.width / 2);

  await page.mouse.click(x, y);
  expect(await valueOf(chaos)).toBe(start);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 6, y);
  await page.mouse.move(x - 46, y, { steps: 8 });
  await page.mouse.up();
  expect(Math.abs((await valueOf(chaos)) - (start - shownBy(40)))).toBeLessThanOrEqual(tolerance);
});
