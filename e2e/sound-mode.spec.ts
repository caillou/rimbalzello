import { expect, test, type Page } from '@playwright/test';
import { expectLayoutRules } from './layout-rules.ts';
import { readout } from './pad-readout.ts';

// Sound mode at the phone viewport: `→ sound` swaps the strips for drum tabs
// over the active drum's sliders (design.md, `designs/v2-03-phone-sound.png`).
test.use({ viewport: { width: 393, height: 659 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
  await page.getByRole('button', { name: '→ sound' }).click();
});

/** Each drum's sound sliders, in order (PRD stories 29–31). */
const SLIDERS = {
  bd: ['freq', 'punch', 'tone', 'decay', 'level'],
  sd: ['freq', 'tone', 'snappy', 'decay', 'level'],
  hh: ['level'],
};

/** Where bd decay and sd decay sit in the v1 URL format (PRD, "URL format"). */
const BD_DECAY = 9;
const SD_DECAY = 14;

const tab = (page: Page, drum: string) => page.getByRole('tab', { name: drum, exact: true });
const slider = (page: Page, name: string) => page.getByRole('slider', { name, exact: true });

/**
 * The setup the store remembers on the device, as the bytes of the v1 URL
 * format the store writes it in.
 */
function setupBytes(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const stored = localStorage.getItem('rimbalzello.setup') ?? '';
    const base64 = stored.replace(/^v1\./, '').replaceAll('-', '+').replaceAll('_', '/');
    return Array.from(atob(base64), (char) => char.charCodeAt(0));
  });
}

/** A byte as the sliders show it, 0–100. */
const shown = (byte: number | undefined) => String(Math.round(((byte ?? NaN) / 255) * 100));

test('sound mode keeps the layout rules at the phone viewport on each drum tab', async ({ page }) => {
  await page.evaluate(() => document.fonts.ready);
  for (const [drum, names] of Object.entries(SLIDERS)) {
    await tab(page, drum).click();
    await expect(tab(page, drum)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').getByRole('slider')).toHaveCount(names.length);
    for (const name of names) await expect(slider(page, name)).toBeVisible();
    await expectLayoutRules(page);
  }
});

test("bd decay changes the setup's bd decay, and each drum keeps its values across tabs", async ({ page }) => {
  await expect(tab(page, 'bd')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('bass drum', { exact: true })).toBeVisible();
  const before = await setupBytes(page);
  const others = (bytes: number[], index: number) => bytes.filter((_, i) => i !== index);

  await slider(page, 'decay').press('End');
  await expect(slider(page, 'decay')).toHaveAttribute('aria-valuenow', '100');
  const bdChanged = await setupBytes(page);
  expect(bdChanged[BD_DECAY]).toBe(255);
  expect(others(bdChanged, BD_DECAY), 'only bd decay changes').toEqual(others(before, BD_DECAY));

  // The sd tab shows sd's own decay and changes only that.
  await tab(page, 'sd').click();
  await expect(page.getByText('snare drum', { exact: true })).toBeVisible();
  await expect(slider(page, 'decay')).toHaveAttribute('aria-valuenow', shown(before[SD_DECAY]));
  await slider(page, 'decay').press('Home');
  await expect(slider(page, 'decay')).toHaveAttribute('aria-valuenow', '0');
  const sdChanged = await setupBytes(page);
  expect(sdChanged[SD_DECAY]).toBe(0);
  expect(others(sdChanged, SD_DECAY), 'only sd decay changes').toEqual(others(bdChanged, SD_DECAY));

  // Back and forth, each drum shows the value it was left at.
  await tab(page, 'hh').click();
  await tab(page, 'bd').click();
  await expect(slider(page, 'decay')).toHaveAttribute('aria-valuenow', '100');
  await tab(page, 'sd').click();
  await expect(slider(page, 'decay')).toHaveAttribute('aria-valuenow', '0');
});

test("a drag held across a tab switch leaves the new drum's slider alone", async ({ page }) => {
  // One thumb drags bd decay and holds; the other taps the sd tab; the first thumb moves on.
  const decay = slider(page, 'decay');
  const finger = (type: string, dx: number) =>
    decay.evaluate(
      (element, { type, dx }) => {
        const rect = element.getBoundingClientRect();
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 31,
            pointerType: 'touch',
            isPrimary: true,
            clientX: rect.left + rect.width / 2 + dx,
            clientY: rect.top + rect.height / 2,
          }),
        );
      },
      { type, dx },
    );

  const bdBefore = await decay.getAttribute('aria-valuenow');
  await finger('pointerdown', 0);
  await finger('pointermove', 10);
  await finger('pointermove', 30);
  await expect(decay).not.toHaveAttribute('aria-valuenow', bdBefore ?? '');

  await tab(page, 'sd').click();
  await expect(page.getByText('snare drum', { exact: true })).toBeVisible();
  const before = await setupBytes(page);
  await expect(decay).toHaveAttribute('aria-valuenow', shown(before[SD_DECAY]));

  await finger('pointermove', 31);
  await finger('pointerup', 31);
  await expect(decay).toHaveAttribute('aria-valuenow', shown(before[SD_DECAY]));
  expect(await setupBytes(page), 'the setup does not change').toEqual(before);
});

test('the pad and the mutes still respond in sound mode; ← play brings the strips back', async ({ page }) => {
  // `→ sound` grows the pad, and the pad learns its new size on the next frame;
  // no finger lands sooner, so the tap waits for it.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const pad = page.locator('[data-control="pad"]');
  const box = (await pad.boundingBox())!;
  // On a whole pixel: WebKit and Firefox drop the fraction of a pointer's coordinates.
  await page.mouse.click(Math.round(box.x + box.width * 0.8), Math.round(box.y + box.height * 0.2));
  await expect.poll(() => readout(page)).toEqual({ x: 80, y: 80 });

  const mute = page.getByRole('button', { name: 'mute sd', exact: true });
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '← play' }).click();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(slider(page, 'chaos')).toBeVisible();
  await expect(page.getByRole('button', { name: '→ sound' })).toBeVisible();
});

test('the bpm readout in sound mode switches to the tempo panel; ← play brings the strips back', async ({ page }) => {
  await page.getByRole('button', { name: /^\d+ bpm$/ }).click();
  await expect(page.getByRole('region', { name: 'tempo' })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);

  await page.getByRole('button', { name: '← play' }).click();
  await expect(page.getByRole('region', { name: 'tempo' })).toHaveCount(0);
  await expect(slider(page, 'chaos')).toBeVisible();
  await expect(page.getByRole('button', { name: '→ sound' })).toBeVisible();
});
