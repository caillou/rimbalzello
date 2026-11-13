import { expect, test, type Locator, type Page } from '@playwright/test';

// Tempo on a phone (design.md, Tempo): the `tempo` tab after `mix` and `fx`
// holds bpm, swing and tap tempo, and the bpm readout in the header opens it.
// On a touch screen, so the tab's controls are played by touch.
test.use({ viewport: { width: 393, height: 659 }, hasTouch: true });

const readout = (page: Page) => page.getByRole('button', { name: /^\d+ bpm$/ });
const tempo = (page: Page) => page.getByRole('group', { name: 'tempo' });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const button = (scope: Page | Locator, name: string) => scope.getByRole('button', { name, exact: true });

async function bpm(page: Page): Promise<number> {
  return Number((await readout(page).textContent())?.match(/\d+/)?.[0]);
}

async function swing(page: Page): Promise<number> {
  return Number((await tempo(page).getByText(/^\d+%$/).textContent())?.match(/\d+/)?.[0]);
}

/** A finger landing on a control or lifting off it, as a touch pointer. */
function finger(control: Locator, type: 'pointerdown' | 'pointerup') {
  return control.evaluate((element, type) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 41,
        pointerType: 'touch',
        isPrimary: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
  }, type);
}

test('the bpm readout opens the tempo tab, with bpm, swing and tap tempo, from mix and from fx', async ({ page }) => {
  await page.goto('./');
  for (const from of ['mix', 'fx']) {
    await tab(page, from).tap();
    await readout(page).tap();
    await expect(tab(page, 'tempo')).toHaveAttribute('aria-selected', 'true');
    for (const name of ['bpm down', 'bpm up', 'swing down', 'swing up', 'tap tempo']) {
      await expect(button(tempo(page), name)).toBeVisible();
    }
  }
});

for (const [where, name, input] of [
  ['in the header', 'tempo up', 'mouse'],
  ['in the tempo tab, by touch', 'bpm up', 'touch'],
] as const) {
  test(`holding + ${where} raises bpm step after step, stops on release and never passes 200`, async ({ page }) => {
    // Time stands still unless the test moves it, so the hold lasts exactly as long as asked.
    await page.clock.install({ time: 0 });
    await page.goto('./');
    await page.clock.pauseAt(1000);
    await tab(page, 'tempo').click();
    const plus = button(page, name);
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

test('swing stays at 50 % on − and at 75 % on +, by touch', async ({ page }) => {
  await page.goto('./');
  await tab(page, 'tempo').tap();
  const minus = button(tempo(page), 'swing down');
  const plus = button(tempo(page), 'swing up');

  for (let i = (await swing(page)) - 50; i > 0; i--) await minus.tap();
  await expect.poll(() => swing(page)).toBe(50);
  await minus.tap();
  expect(await swing(page)).toBe(50);

  for (let i = 0; i < 25; i++) await plus.tap();
  await expect.poll(() => swing(page)).toBe(75);
  await plus.tap();
  expect(await swing(page)).toBe(75);
});

test('tapping tap tempo faster than 200 bpm sets the tempo to 200', async ({ page }) => {
  await page.goto('./');
  await tab(page, 'tempo').tap();
  const tap = (await button(tempo(page), 'tap tempo').boundingBox())!;
  for (let i = 0; i < 4; i++) await page.touchscreen.tap(tap.x + tap.width / 2, tap.y + tap.height / 2);
  expect(await bpm(page)).toBe(200);
});
