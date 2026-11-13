import { expect, test, type Page } from '@playwright/test';

// The setup in the URL hash: a link opens with its groove, the hash follows
// every change without adding history, and the bare address brings back the
// last setup on the device.

// The laptop layout, so all six strips show.
test.use({ viewport: { width: 1280, height: 800 } });

/** A link to a `v1.` hash with these 21 bytes, built without the app's URL codec. */
function link(bytes: number[]): string {
  return `./#v1.${Buffer.from(bytes).toString('base64url')}`;
}

/** The bytes in the page's `v1.` hash. */
async function hashBytes(page: Page): Promise<number[]> {
  const hash = await page.evaluate(() => location.hash);
  return [...Buffer.from(hash.replace(/^#v1\./, ''), 'base64url')];
}

/** A byte as the screen shows it, 0–100. */
const shownAs = (byte: number) => Math.round((byte / 255) * 100);

// x, y, chaos, bd sd hh density, sound (10 bytes), drift, drive, bpm, swing:
// picked so the screen shows round numbers.
const KNOWN = link([51, 204, 153, 26, 77, 230, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 128, 179, 142, 63]);
const KNOWN_SHOWN = {
  readout: 'x 20 · y 80',
  strips: { bd: 10, sd: 30, hh: 90, chaos: 60, drift: 50, drive: 70 },
  bpm: '142 bpm',
};

const strip = (page: Page, label: string) => page.getByRole('slider', { name: label, exact: true });

/** What the play screen shows of the setup: the X/Y readout, the strips and the bpm. */
async function shown(page: Page) {
  const strips: Record<string, number> = {};
  for (const label of Object.keys(KNOWN_SHOWN.strips)) {
    strips[label] = Number(await strip(page, label).getAttribute('aria-valuenow'));
  }
  return {
    readout: await page.getByText(/^x \d+ · y \d+$/).textContent(),
    strips,
    bpm: await page.getByText(/^\d+ bpm$/).textContent(),
  };
}

test('a link opens with the setup it holds', async ({ page }) => {
  await page.goto(KNOWN);
  await expect.poll(() => shown(page)).toEqual(KNOWN_SHOWN);
});

test('a change reaches the hash within about a second, without adding history', async ({ page }) => {
  await page.goto('./');
  await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#v1\./);
  const entries = await page.evaluate(() => history.length);

  // A run of changes: the first is written at once, the last when the second is over.
  const chaos = strip(page, 'chaos');
  for (let i = 0; i < 5; i++) await chaos.press('PageUp');
  const value = Number(await chaos.getAttribute('aria-valuenow'));

  await expect.poll(async () => shownAs((await hashBytes(page))[2] ?? -1), { timeout: 2000 }).toBe(value);
  expect(await page.evaluate(() => history.length)).toBe(entries);
});

test('the bare address brings back the last setup; a link wins over it', async ({ page }) => {
  await page.goto('./');
  await strip(page, 'chaos').press('End');

  await page.goto('./');
  await expect(strip(page, 'chaos')).toHaveAttribute('aria-valuenow', '100');

  // From another page, so the link loads the app instead of changing the hash.
  await page.goto('about:blank');
  await page.goto(KNOWN);
  await expect.poll(() => shown(page)).toEqual(KNOWN_SHOWN);
});

test('a malformed hash loads the default setup without errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`));

  // A first visit shows the default setup; the device then remembers another one.
  await page.goto('./');
  const defaults = await shown(page);
  await strip(page, 'chaos').press('End');

  await page.goto('about:blank');
  await page.goto('./#v1.!!!');
  await expect.poll(() => shown(page)).toEqual(defaults);
  expect(problems).toEqual([]);
});

test('a link opened in the tab that plays replaces the setup and keeps playing', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
  await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#v1\./);

  // Only the hash changes, so the page stays.
  await page.goto(KNOWN);
  await expect.poll(() => shown(page)).toEqual(KNOWN_SHOWN);
  await expect(page.getByRole('button', { name: 'stop' })).toBeVisible();
});
