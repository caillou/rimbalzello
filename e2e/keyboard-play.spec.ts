import { expect, test, type Page } from './fixtures.ts';
import { expectLayoutRules } from './layout-rules.ts';
import { readout } from './pad-readout.ts';
import { countStartedVoices, expectGrooveRunning } from './started-voices.ts';

// Keyboard play on a laptop (design.md, Keyboard): the keys drive the
// instrument, and `?`, `h` or `// help` show their keycaps next to the controls.

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await countStartedVoices(page);
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
});

const ZONES = ['1/4', '1/8', '1/16', '1/32'];

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const bpm = (page: Page) => page.getByText(/^\d+ bpm$/);
const strip = (page: Page, label: string) => page.getByRole('slider', { name: label, exact: true });
const returnButton = (page: Page) => button(page, '↺ return on bar');

async function heldZones(page: Page): Promise<string[]> {
  const held: string[] = [];
  for (const name of ZONES) if ((await button(page, name).getAttribute('aria-pressed')) === 'true') held.push(name);
  return held;
}

/** The centre of a control, on a whole pixel: WebKit and Firefox drop the fraction of a pointer's coordinates. */
async function centre(page: Page, name: string) {
  const box = (await button(page, name).boundingBox())!;
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

/** A tap on the pad at a fraction of its width and height from the top left, on a whole pixel. */
async function tapPad(page: Page, fx: number, fy: number) {
  const box = (await page.locator('[data-control="pad"]').boundingBox())!;
  await page.mouse.click(Math.round(box.x + box.width * fx), Math.round(box.y + box.height * fy));
}

/** Waits for a step early in the bar, so the bar line is more than a second away. */
async function earlyInBar(page: Page) {
  await page.waitForFunction(() => {
    const line = document.querySelector('[aria-label="step display"] .step-line');
    const step = line ? [...line.children].findIndex((cell) => cell.classList.contains('now')) : -1;
    return step >= 1 && step <= 8;
  });
}

test('space starts and stops', async ({ page }) => {
  await page.keyboard.press('Space');
  await expect(button(page, 'stop')).toBeVisible();
  await expectGrooveRunning(page);

  await page.keyboard.press('Space');
  await expect(button(page, 'play')).toBeVisible();
});

test('holding . raises the tempo with key repeat, and , lowers it', async ({ page }) => {
  await expect(bpm(page)).toHaveText('128 bpm');
  // The first keydown, then four repeats.
  for (let i = 0; i < 5; i++) await page.keyboard.down('Period');
  await page.keyboard.up('Period');
  await expect(bpm(page)).toHaveText('133 bpm');

  await page.keyboard.press('Comma');
  await expect(bpm(page)).toHaveText('132 bpm');
});

test('q w e mute bd sd hh', async ({ page }) => {
  for (const [key, drum] of [
    ['KeyQ', 'bass drum'],
    ['KeyW', 'snare drum'],
    ['KeyE', 'hi-hat'],
  ]) {
    await page.keyboard.press(key!);
    await expect(button(page, `mute ${drum}`)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press(key!);
    await expect(button(page, `mute ${drum}`)).toHaveAttribute('aria-pressed', 'false');
  }
});

test('holding 2 while playing loops 1/8 and letting go ends it; a key let go while cmd is down does not stick', async ({
  page,
}) => {
  await page.keyboard.press('Space');
  await page.keyboard.down('Digit2');
  await expect.poll(() => heldZones(page)).toEqual(['1/8']);
  await page.keyboard.up('Digit2');
  await expect.poll(() => heldZones(page)).toEqual([]);

  // macOS sends no keyup for a key let go while cmd is down: letting go of cmd lets go of it.
  await page.keyboard.down('Digit3');
  await expect.poll(() => heldZones(page)).toEqual(['1/16']);
  await page.keyboard.down('Meta');
  await page.keyboard.up('Meta');
  await expect.poll(() => heldZones(page)).toEqual([]);
  await page.keyboard.up('Digit3');
});

test('a finger lifting off the loop strip leaves the loop a key holds', async ({ page }) => {
  await page.keyboard.press('Space');
  await page.keyboard.down('Digit1');
  await expect.poll(() => heldZones(page)).toEqual(['1/4']);

  // The finger engaged last, so it wins while down.
  const at = await centre(page, '1/16');
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await expect.poll(() => heldZones(page)).toEqual(['1/16']);
  await page.mouse.up();
  await expect.poll(() => heldZones(page)).toEqual(['1/4']);

  await page.keyboard.up('Digit1');
  await expect.poll(() => heldZones(page)).toEqual([]);
});

test('a loop key pressed while stopped, or held through a stop, holds nothing until pressed again', async ({
  page,
}) => {
  /** With play started under the loop key: a new loop key loops, and letting go of it does not fall back to the older one. */
  async function newKeyLoopsAlone() {
    await page.keyboard.down('Digit3');
    await expect.poll(() => heldZones(page)).toEqual(['1/16']);
    await page.keyboard.up('Digit3');
    await expect.poll(() => heldZones(page)).toEqual([]);
  }

  await page.keyboard.down('Digit2');
  await page.keyboard.press('Space');
  await expect(button(page, 'stop')).toBeVisible();
  await newKeyLoopsAlone();
  await page.keyboard.up('Digit2');

  await page.keyboard.down('Digit2');
  await expect.poll(() => heldZones(page)).toEqual(['1/8']);
  await page.keyboard.press('Space');
  await expect.poll(() => heldZones(page)).toEqual([]);
  await page.keyboard.press('Space');
  await newKeyLoopsAlone();
  await page.keyboard.up('Digit2');
});

test('a, then a pad change, then r brings the pad back at the next bar', async ({ page }) => {
  await page.keyboard.press('Space');
  const anchored = await readout(page);
  await page.keyboard.press('KeyA');

  await tapPad(page, 0.8, 0.2);
  await expect.poll(() => readout(page)).toEqual({ x: 80, y: 80 });

  await earlyInBar(page);
  await page.keyboard.press('KeyR');
  await expect(returnButton(page)).toHaveAccessibleDescription('pending');
  expect(await readout(page), 'pending until the bar line').toEqual({ x: 80, y: 80 });
  await expect(returnButton(page)).not.toHaveAccessibleDescription('pending');
  await expect.poll(() => readout(page)).toEqual(anchored);
});

test('three arrow presses are one pad move: z brings back the position from before them', async ({ page }) => {
  const firstLaunchHint = page.getByText('two-finger tap undo');
  await expect(firstLaunchHint).toBeVisible();
  const before = await readout(page);
  for (const arrow of ['ArrowRight', 'ArrowRight', 'ArrowUp']) await page.keyboard.press(arrow);
  // The pad draws once per frame: read it after the next one.
  await page.evaluate(() => new Promise((drawn) => requestAnimationFrame(() => requestAnimationFrame(drawn))));
  const after = await readout(page);
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);
  // The run ends on its own once no arrow has been down for a moment; that first pad move takes the hint away.
  await expect(firstLaunchHint).toBeHidden();

  await page.keyboard.press('KeyZ');
  await expect.poll(() => readout(page)).toEqual(before);
  // And again: redo.
  await page.keyboard.press('KeyZ');
  await expect.poll(() => readout(page)).toEqual(after);
});

test('a focused button takes space and a focused strip the arrows; after a click, keys play again', async ({ page }) => {
  await page.keyboard.press('Space');
  const mute = (drum: string) => button(page, `mute ${drum}`);
  const chaos = strip(page, 'chaos');
  const drive = strip(page, 'drive');

  // Reached from the keyboard: the control takes the key, the instrument does not.
  await mute('bass drum').focus();
  await page.keyboard.press('Space');
  await expect(mute('bass drum')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'stop')).toBeVisible();

  // A click leaves no focus behind, on the control clicked or on the one
  // reached from the keyboard before: space plays.
  await mute('snare drum').click();
  await expect(mute('snare drum')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(button(page, 'play')).toBeVisible();
  await expect(mute('bass drum')).toHaveAttribute('aria-pressed', 'true');
  await expect(mute('snare drum')).toHaveAttribute('aria-pressed', 'true');

  // The same for a strip and the arrows.
  const position = await readout(page);
  await chaos.focus();
  const value = Number(await chaos.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowRight');
  await expect(chaos).toHaveAttribute('aria-valuenow', String(value + 1));
  expect(await readout(page)).toEqual(position);

  const driven = await drive.getAttribute('aria-valuenow');
  // On its label: a click on the track would set the value there.
  await drive.getByText('drive', { exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readout(page)).x).toBeGreaterThan(position.x);
  await expect(chaos).toHaveAttribute('aria-valuenow', String(value + 1));
  await expect(drive).toHaveAttribute('aria-valuenow', driven!);
});

test.describe('keycap hints', () => {
  /** The pad's corner: `nudge ←↑↓→  shift fine`. */
  const corner = (page: Page) => page.getByText(/^nudge/);
  const spaceKey = (page: Page) => button(page, 'play').locator('kbd');
  const help = (page: Page) => button(page, 'help');

  test('? shows them, a reload keeps them, h hides them; // help toggles them too', async ({ page }) => {
    // Hidden by default; the footer's `?` shows where to find them.
    await expect(corner(page)).toBeHidden();
    await expect(spaceKey(page)).toBeHidden();
    await expect(help(page).locator('kbd')).toHaveText('?');
    await expect(help(page).locator('kbd')).toBeVisible();

    await page.keyboard.press('Shift+Slash');
    await expect(corner(page)).toBeVisible();
    await expect(spaceKey(page)).toHaveText('space');
    await expect(spaceKey(page)).toBeVisible();
    await expect(help(page)).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(corner(page)).toBeVisible();

    await page.keyboard.press('KeyH');
    await expect(corner(page)).toBeHidden();
    await expect(help(page)).toHaveAttribute('aria-pressed', 'false');

    await help(page).click();
    await expect(corner(page)).toBeVisible();
    await expect(help(page)).toHaveAttribute('aria-pressed', 'true');
    await help(page).click();
    await expect(corner(page)).toBeHidden();
  });

  for (const [where, options] of [
    ['a window too narrow for two columns', { viewport: { width: 393, height: 750 } }],
    ['a touch screen', { viewport: { width: 820, height: 1106 }, hasTouch: true }],
  ] as const) {
    test.describe(`on ${where}`, () => {
      test.use(options);

      test('// help opens the help box, and ? shows no keycaps', async ({ page }) => {
        await page.keyboard.press('Shift+Slash');
        await expect(spaceKey(page)).toBeHidden();
        await expect(corner(page)).toBeHidden();
        await expect(help(page).locator('kbd')).toBeHidden();

        await help(page).click();
        await expect(page.getByRole('note', { name: 'gestures and controls' })).toBeVisible();
        await expect(help(page)).toHaveAttribute('aria-pressed', 'true');
      });
    });
  }

  /** Every keycap shown on a button lies inside it, on its line; the keycaps outside, by key and button. */
  async function keycapsOutsideTheirButton(page: Page): Promise<string[]> {
    return page.evaluate(() =>
      [...document.querySelectorAll('main button kbd')].flatMap((keycap) => {
        const key = keycap.getBoundingClientRect();
        const control = keycap.closest('button')!;
        const box = control.getBoundingClientRect();
        if (key.width === 0) return [];
        const inside =
          key.left >= box.left - 0.5 &&
          key.right <= box.right + 0.5 &&
          key.top >= box.top - 0.5 &&
          key.bottom <= box.bottom + 0.5;
        return inside ? [] : [`${keycap.textContent} on ${control.getAttribute('aria-label') ?? control.textContent}`];
      }),
    );
  }

  // 700, 727 and 744 px: the narrowest tablet layouts, where the mute labels
  // have the least room, with or without their keycaps, beside the step line
  // and its beat gaps: the step text drops to 13 or 14 px there. 1024×768:
  // the narrowest laptop column, with the drums' full names before their
  // keycaps. 2560×1440: the laptop layout zoomed by 1.8, where the keycaps
  // grow with the labels they sit beside.
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 2560, height: 1440 },
    { width: 1024, height: 768 },
    { width: 820, height: 1106 },
    { width: 744, height: 1133 },
    { width: 727, height: 900 },
    { width: 700, height: 900 },
  ]) {
    test.describe(`at ${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport });

      test('the layout rules hold with the hints hidden, and each keycap sits inside its button with them shown, a loop held and a return pending', async ({
        page,
      }) => {
        await expectLayoutRules(page);
        await page.keyboard.press('KeyH');
        await page.keyboard.press('Space');
        await expect(corner(page)).toBeVisible();
        await page.keyboard.down('Digit2');
        await page.keyboard.press('KeyR');
        await expect.poll(() => heldZones(page)).toEqual(['1/8']);
        // `hh` on the tablet, written out on the laptop.
        const hh = page.getByRole('button', { name: /^mute (hh|hi-hat)$/ });
        await expect(hh.locator('kbd')).toBeVisible();
        expect(await keycapsOutsideTheirButton(page)).toEqual([]);
        await expectLayoutRules(page);
        await page.keyboard.up('Digit2');
      });
    });
  }
});
