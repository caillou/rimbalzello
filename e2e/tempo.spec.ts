import { expect, test, type Locator, type Page } from '@playwright/test';

// Tempo on a phone (design.md, Tempo): the `tempo` tab after `mix` and `fx`
// holds the bpm and swing strips and tap tempo, and the bpm readout in the
// header opens it. On a touch screen, so the tab's controls are played by touch.
test.use({ viewport: { width: 393, height: 659 }, hasTouch: true });

const readout = (page: Page) => page.getByRole('button', { name: /^\d+ bpm$/ });
const tempo = (page: Page) => page.getByRole('group', { name: 'tempo' });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const strip = (page: Page, name: string) => tempo(page).getByRole('slider', { name, exact: true });
const button = (scope: Page | Locator, name: string) => scope.getByRole('button', { name, exact: true });

async function bpm(page: Page): Promise<number> {
  return Number((await readout(page).textContent())?.match(/\d+/)?.[0]);
}

/**
 * A finger on a control, as a touch pointer: landing, moving or lifting
 * `dx` px right of the control's centre (left when negative).
 */
function finger(control: Locator, type: 'pointerdown' | 'pointermove' | 'pointerup', dx = 0) {
  return control.evaluate(
    (element, { type, dx }) => {
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 41,
          pointerType: 'touch',
          isPrimary: true,
          clientX: rect.left + rect.width / 2 + dx,
          clientY: rect.top + rect.height / 2,
        }),
      );
    },
    { type, dx },
  );
}

test('the bpm readout opens the tempo tab, with bpm, swing and tap tempo, from mix and from fx', async ({ page }) => {
  await page.goto('./');
  for (const from of ['mix', 'fx']) {
    await tab(page, from).tap();
    await readout(page).tap();
    await expect(tab(page, 'tempo')).toHaveAttribute('aria-selected', 'true');
    for (const name of ['bpm', 'swing']) await expect(strip(page, name)).toBeVisible();
    await expect(button(tempo(page), 'tap tempo')).toBeVisible();
  }
});

for (const input of ['mouse', 'touch'] as const) {
  test(`holding + in the header by ${input} raises bpm step after step, stops on release and never passes 200`, async ({
    page,
  }) => {
    // Time stands still unless the test moves it, so the hold lasts exactly as long as asked.
    await page.clock.install({ time: 0 });
    await page.goto('./');
    await page.clock.pauseAt(1000);
    const plus = button(page, 'tempo up');
    const start = await bpm(page);

    // A tap is one step, however it is pressed.
    await (input === 'touch' ? plus.tap() : plus.click());
    expect(await bpm(page)).toBe(start + 1);

    async function hold() {
      if (input === 'touch') return finger(plus, 'pointerdown');
      await plus.hover();
      await page.mouse.down();
    }
    const release = () => (input === 'touch' ? finger(plus, 'pointerup') : page.mouse.up());

    // Held well past the repeat delay (about 400 ms), it keeps stepping.
    await hold();
    await page.clock.runFor(2000);
    const held = await bpm(page);
    expect(held).toBeGreaterThan(start + 2);

    await release();
    await page.clock.runFor(2000);
    expect(await bpm(page)).toBe(held);

    // Held long enough to climb far past the top, it stops at 200.
    await hold();
    await page.clock.runFor(60_000);
    await release();
    expect(await bpm(page)).toBe(200);
  });
}

for (const { name, min, max, unit } of [
  { name: 'bpm', min: 60, max: 200, unit: '' },
  { name: 'swing', min: 50, max: 75, unit: '%' },
]) {
  test(`dragging the ${name} strip changes it by the drag, never past ${min}–${max}${unit}`, async ({ page }) => {
    await page.goto('./');
    await tab(page, 'tempo').tap();
    const control = strip(page, name);
    const value = async () => Number(await control.getAttribute('aria-valuenow'));
    /** The strip shows the value itself, not 0–100, and the header readout follows bpm. */
    async function expectShown(shown: number) {
      await expect(control).toHaveAttribute('aria-valuenow', String(shown));
      await expect(control.getByText(`${shown}${unit}`, { exact: true })).toBeVisible();
      if (name === 'bpm') expect(await bpm(page)).toBe(shown);
    }
    const start = await value();
    await expectShown(start);

    // Landing near the left end leaves the value where it was.
    const width = (await control.boundingBox())!.width;
    await finger(control, 'pointerdown', -width / 2 + 80);
    await finger(control, 'pointerup', -width / 2 + 80);
    await expectShown(start);

    // A drag to the right raises it from there; far past the end it stops at the top.
    await finger(control, 'pointerdown');
    await finger(control, 'pointermove', 20);
    await finger(control, 'pointermove', 60);
    const raised = await value();
    expect(raised).toBeGreaterThan(start);
    await expectShown(raised);
    await finger(control, 'pointermove', 2000);
    await expectShown(max);

    // Far to the left it stops at the bottom, and turned back it rises at once.
    await finger(control, 'pointermove', -2000);
    await expectShown(min);
    await finger(control, 'pointermove', -1990);
    await finger(control, 'pointerup', -1990);
    expect(await value()).toBeGreaterThan(min);
  });
}

test('tapping tap tempo faster than 200 bpm sets the tempo to 200', async ({ page }) => {
  await page.goto('./');
  await tab(page, 'tempo').tap();
  const tap = (await button(tempo(page), 'tap tempo').boundingBox())!;
  for (let i = 0; i < 4; i++) await page.touchscreen.tap(tap.x + tap.width / 2, tap.y + tap.height / 2);
  expect(await bpm(page)).toBe(200);
});
