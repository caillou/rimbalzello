import { expect, test, type Locator, type Page } from './fixtures.ts';

// The step display draws an accented hit as a bold `x` and a plain hit at
// the normal weight. Each setup comes from a link and the groove stays
// stopped, so the display shows it without chaos. The weights follow the
// screen's resolution (design.md, Font): WebKit's Desktop Safari runs at 2×,
// so the tests compare the two weights and never expect a number.

test.use({ viewport: { width: 1280, height: 800 } });

/** A link to a `v1.` hash with these 22 bytes, built without the app's URL codec. */
function link(bytes: number[]): string {
  return `./#v1.${Buffer.from(bytes).toString('base64url')}`;
}

/** Bytes 6–21 of the default setup: sound, drift, drive, bpm and swing. */
const SOUND_AND_TEMPO = [128, 156, 117, 148, 179, 128, 128, 140, 117, 143, 0, 112, 56, 102, 128, 56];

/** A setup at x, y with this bd density: no chaos, sd and hh at their defaults. */
const setupLink = (x: number, y: number, bd: number) => link([x, y, 0, bd, 128, 199, ...SOUND_AND_TEMPO]);

/** The cell of one bd step, 0–31. */
const bdStep = (page: Page, step: number) => page.locator('[data-drum="bd"] .step-line > span').nth(step);

const weightOf = (cell: Locator) => cell.evaluate((element) => Number(getComputedStyle(element).fontWeight));

/** Whether an upright IBM Plex Mono face of this weight has loaded. */
const faceLoaded = (page: Page, weight: number) =>
  page.evaluate(
    (weight) =>
      [...document.fonts].some(
        (face) =>
          face.family.includes('IBM Plex Mono') &&
          face.style === 'normal' &&
          face.weight === String(weight) &&
          face.status === 'loaded',
      ),
    weight,
  );

test('an accented hit is drawn bolder than a plain one', async ({ page }) => {
  // The default x 87, y 148 and bd density 161: bd reads
  // `X.......x.....x.X...x.x.........`, accents (X) at steps 0 and 16,
  // plain hits at 8, 14, 20 and 22.
  await page.goto(setupLink(87, 148, 161));
  const accent = bdStep(page, 16);
  const plain = bdStep(page, 14);
  await expect(accent).toHaveText('x');
  await expect(plain).toHaveText('x');

  const normal = await weightOf(plain);
  await expect.poll(() => weightOf(accent)).toBeGreaterThan(normal);

  // The bold comes from a downloaded face, not one the browser fakes. The
  // headings use the same face, so this guards against a dropped
  // @fontsource import rather than the accent's rule.
  const bold = await weightOf(accent);
  await expect.poll(() => faceLoaded(page, bold)).toBe(true);
});

test('a hit turns bold when it becomes an accent, and back', async ({ page }) => {
  // x 0, y 0, bd density 255: bd step 0 is a plain hit, step 2 a rest.
  await page.goto(setupLink(0, 0, 255));
  const first = bdStep(page, 0);
  await expect(first).toHaveText('x');
  await expect(bdStep(page, 2)).toHaveText('·');
  const plain = await weightOf(first);

  // A link opened in the same tab changes only the hash; its setup replaces
  // the current one. At x 128, y 128 step 0 is still a hit, now an accent,
  // and step 2 turns into a hit, which shows the display has redrawn.
  await page.goto(setupLink(128, 128, 255));
  await expect(bdStep(page, 2)).toHaveText('x');
  await expect(first).toHaveText('x');
  await expect.poll(() => weightOf(first)).toBeGreaterThan(plain);

  // Back to the first link: step 0 is a plain hit again and loses the bold.
  await page.goto(setupLink(0, 0, 255));
  await expect(bdStep(page, 2)).toHaveText('·');
  await expect(first).toHaveText('x');
  await expect.poll(() => weightOf(first)).toBe(plain);
});

test('the steps fall into four beats of 8, with a gap before steps 8, 16 and 24', async ({ page }) => {
  await page.goto('./');
  // Measured in the app's own font, not a fallback.
  await page.evaluate(() => document.fonts.ready);
  const lefts = await page
    .locator('[data-drum="bd"] .step-line > span')
    .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().left));
  expect(lefts).toHaveLength(32);
  const distances = lefts.slice(1).map((left, i) => left - lefts[i]!);
  // distances[i] runs from step i to step i + 1: step 7 → 8 is distances[7].
  const step = distances[0]!;
  for (const [i, distance] of distances.entries()) {
    if (i % 8 === 7) expect(distance, `steps ${i} → ${i + 1}`).toBeGreaterThan(step + 1);
    else expect(distance, `steps ${i} → ${i + 1}`).toBeCloseTo(step, 1);
  }
});
