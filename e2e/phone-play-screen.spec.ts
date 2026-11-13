import { finger } from './finger.ts';
import { expect, test, type Locator, type Page } from './fixtures.ts';
import { expectLayoutRules } from './layout-rules.ts';
import { readout } from './pad-readout.ts';

// The play screen in the phone layout: Safari on a tall current iPhone
// (design.md: about 660–750 px of height). The tabs and the compact layout
// of shorter phones are in phone-and-compact-layouts.spec.ts.
test.use({ viewport: { width: 393, height: 750 } });

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
});

const muteButton = (page: Page, drum: string) => page.getByRole('button', { name: `mute ${drum}`, exact: true });
const strip = (page: Page, label: string) => page.getByRole('slider', { name: label, exact: true });
const valueOf = async (slider: Locator) => Number(await slider.getAttribute('aria-valuenow'));

test('the play screen keeps the layout rules at the phone viewport', async ({ page }) => {
  await page.evaluate(() => document.fonts.ready);
  await expectLayoutRules(page);

  // The step display at its widest: every step a hit on every line, every drum muted.
  for (const drum of ['bd', 'sd', 'hh']) {
    await strip(page, drum).press('End');
    await muteButton(page, drum).click();
  }
  await expect(strip(page, 'hh')).toHaveAttribute('aria-valuenow', '100');
  await expectLayoutRules(page);
});

test('a drum label in the step display toggles its mute; strip labels do not', async ({ page }) => {
  const bd = muteButton(page, 'bd');
  await expect(bd).toHaveAttribute('aria-pressed', 'false');

  await bd.click();
  await expect(bd).toHaveAttribute('aria-pressed', 'true');
  await expect(bd).toHaveCSS('text-decoration-line', 'line-through');

  await bd.click();
  await expect(bd).toHaveAttribute('aria-pressed', 'false');
  await expect(bd).not.toHaveCSS('text-decoration-line', 'line-through');

  const bdStrip = strip(page, 'bd');
  const before = await valueOf(bdStrip);
  await bdStrip.getByText('bd', { exact: true }).click();
  for (const drum of ['bd', 'sd', 'hh']) await expect(muteButton(page, drum)).toHaveAttribute('aria-pressed', 'false');
  expect(await valueOf(bdStrip)).toBe(before);
});

test('touched, a strip moves by the drag, wherever it starts; a tap does not change it', async ({ page }) => {
  await page.getByRole('tab', { name: 'fx', exact: true }).click();
  const chaos = strip(page, 'chaos');
  const start = await valueOf(chaos);

  // A tap on the track, far from the thumb, leaves the value alone.
  for (const at of [0.25, 0.75]) {
    await finger(chaos, 'pointerdown', { at });
    await finger(chaos, 'pointerup', { at });
    expect(await valueOf(chaos)).toBe(start);
  }

  async function drag(at: number, by: number) {
    await finger(chaos, 'pointerdown', { at });
    for (let step = 1; step <= 8; step++) await finger(chaos, 'pointermove', { at, dx: (by * step) / 8 });
    await finger(chaos, 'pointerup', { at, dx: by });
  }

  // Started far left of the thumb, a drag to the right still raises the value from where it was.
  await drag(0.05, 60);
  const raised = await valueOf(chaos);
  expect(raised).toBeGreaterThan(start + 10);

  // The same drag back, started at the far right, lands where the value began.
  await drag(0.95, -60);
  expect(Math.abs((await valueOf(chaos)) - start)).toBeLessThanOrEqual(1);
});

test('a tap on the pad moves the position there; a two-finger tap undoes it', async ({ page }) => {
  const before = await readout(page);
  const pad = page.locator('[data-control="pad"]');
  const box = (await pad.boundingBox())!;

  // Near the top right: higher x, and higher y, which is up the pad.
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.2);
  await expect.poll(() => readout(page)).toEqual({ x: 80, y: 80 });

  // Two fingers land and lift together, far from the last tap.
  await pad.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const pointer = (type: string, pointerId: number, fx: number, fy: number) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId,
          pointerType: 'touch',
          isPrimary: pointerId === 21,
          clientX: rect.left + rect.width * fx,
          clientY: rect.top + rect.height * fy,
        }),
      );
    pointer('pointerdown', 21, 0.1, 0.8);
    pointer('pointerdown', 22, 0.3, 0.8);
    pointer('pointerup', 21, 0.1, 0.8);
    pointer('pointerup', 22, 0.3, 0.8);
  });
  await expect.poll(() => readout(page)).toEqual(before);
});

test('every control is reachable by Tab and shows a focus ring', async ({ page, browserName }) => {
  // Safari tabs to links only with "Press Tab to highlight each item" on;
  // Option-Tab highlights each item either way.
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';

  const names = await page
    .locator('main')
    .locator('button, a[href], [role="slider"]')
    .evaluateAll((elements) =>
      elements.map((element, i) => {
        element.setAttribute('data-tab-check', String(i));
        return element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '';
      }),
    );

  const reached = new Set<number>();
  // Twice round, wherever the Tab order starts after the play tap.
  for (let i = 0; i < 2 * names.length && reached.size < names.length; i++) {
    await page.keyboard.press(tab);
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      const index = element?.getAttribute('data-tab-check');
      if (!element || index == null) return null;
      const { outlineStyle, outlineWidth } = getComputedStyle(element);
      return { index: Number(index), ring: outlineStyle !== 'none' && parseFloat(outlineWidth) > 0 };
    });
    if (!focused) continue;
    expect(focused.ring, `focus ring on ${names[focused.index]}`).toBe(true);
    reached.add(focused.index);
  }
  expect(names.filter((_, i) => !reached.has(i)), 'controls Tab never reaches').toEqual([]);
});

test('while playing, the step display highlights the step being heard', async ({ page }) => {
  const highlighted = () =>
    page.evaluate(() => {
      const line = document.querySelector('[aria-label="step display"] .step-line');
      return line ? [...line.children].findIndex((cell) => cell.classList.contains('now')) : -1;
    });
  await expect.poll(highlighted).toBeGreaterThanOrEqual(0);
  const first = await highlighted();
  await expect.poll(highlighted).not.toBe(first);

  await page.getByRole('button', { name: 'stop' }).click();
  await expect.poll(highlighted).toBe(-1);
});
