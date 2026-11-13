import { expect, test, type Locator, type Page } from '@playwright/test';

// The loop strip at the phone viewport, driven by a synthetic touch pointer.
// What the looper plays is read off the step display: the played step is
// highlighted, and while a loop is held the playhead step shows dimmed.
test.use({ viewport: { width: 393, height: 659 } });

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
});

const ZONES = ['1/4', '1/8', '1/16', '1/32'];

const zone = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function heldZones(page: Page): Promise<string[]> {
  const held: string[] = [];
  for (const name of ZONES) if ((await zone(page, name).getAttribute('aria-pressed')) === 'true') held.push(name);
  return held;
}

async function centre(target: Locator): Promise<{ clientX: number; clientY: number }> {
  const box = (await target.boundingBox())!;
  return { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
}

/**
 * A finger landing on a zone. Its moves and lift go to the element it landed
 * on, as a touch pointer's do.
 */
async function finger(page: Page, name: string) {
  const landed = zone(page, name);
  const touch = { pointerId: 31, pointerType: 'touch', isPrimary: true };
  await landed.dispatchEvent('pointerdown', { ...touch, ...(await centre(landed)) });
  return {
    slideTo: async (at: { clientX: number; clientY: number }) =>
      landed.dispatchEvent('pointermove', { ...touch, ...at }),
    lift: async () => landed.dispatchEvent('pointerup', { ...touch, ...(await centre(landed)) }),
  };
}

/** What the step display showed over a while of playing. */
interface Seen {
  /** The first of the played steps, when they form one run of steps (modulo 32). */
  start: number | undefined;
  /** How many different steps were played. */
  steps: number;
  /** Whether a playhead step showed apart from the played step. */
  playhead: boolean;
}

/** Watches the step display on every animation frame for `ms` milliseconds. */
async function watch(page: Page, ms = 700): Promise<Seen> {
  const frames = await page.evaluate(
    (ms) =>
      new Promise<{ played: number; playhead: number }[]>((resolve) => {
        const cells = [...document.querySelector('[aria-label="step display"] .step-line')!.children];
        const at = (name: string) => cells.findIndex((cell) => cell.classList.contains(name));
        const frames: { played: number; playhead: number }[] = [];
        const end = performance.now() + ms;
        requestAnimationFrame(function frame() {
          frames.push({ played: at('now'), playhead: at('playhead') });
          if (performance.now() < end) requestAnimationFrame(frame);
          else resolve(frames);
        });
      }),
    ms,
  );
  const played = new Set(frames.map((frame) => frame.played).filter((step) => step >= 0));
  const starts = [...played].filter((step) => !played.has((step + 31) % 32));
  return {
    start: starts.length === 1 ? starts[0] : undefined,
    steps: played.size,
    playhead: frames.some((frame) => frame.playhead >= 0),
  };
}

test('a held zone loops; sliding changes the size and keeps the start; sliding off releases', async ({ page }) => {
  // Playing straight: the played step runs on, and it is the playhead step.
  await expect.poll(() => watch(page)).toMatchObject({ playhead: false, start: expect.any(Number) });

  const touch = await finger(page, '1/8');
  await expect.poll(() => heldZones(page)).toEqual(['1/8']);
  await expect(zone(page, '1/8')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  // 1/8 is 4 steps from the step heard at the touch, while the playhead runs on.
  let looped: Seen | undefined;
  await expect
    .poll(async () => (looped = await watch(page)))
    .toEqual({ start: expect.any(Number), steps: 4, playhead: true });

  // Across 1/16 to 1/32: the held zone follows the finger, and 1/32 repeats the loop's first step.
  await touch.slideTo(await centre(zone(page, '1/16')));
  await expect.poll(() => heldZones(page)).toEqual(['1/16']);
  await touch.slideTo(await centre(zone(page, '1/32')));
  await expect.poll(() => heldZones(page)).toEqual(['1/32']);
  await expect.poll(() => watch(page)).toEqual({ start: looped!.start, steps: 1, playhead: true });

  // Off the strip, up over the step display: released, the pattern runs on from the playhead.
  const strip = (await page.getByRole('group', { name: 'loop', exact: true }).boundingBox())!;
  await touch.slideTo({ clientX: strip.x + strip.width / 2, clientY: strip.y - 20 });
  await expect.poll(() => heldZones(page)).toEqual([]);
  let released: Seen | undefined;
  await expect.poll(async () => (released = await watch(page))).toMatchObject({ playhead: false });
  expect(released!.steps).toBeGreaterThan(4);

  // Lifting off the strip after that changes nothing.
  await touch.lift();
  expect(await heldZones(page)).toEqual([]);
});

test('lifting the finger releases the loop', async ({ page }) => {
  const touch = await finger(page, '1/4');
  await expect.poll(() => heldZones(page)).toEqual(['1/4']);
  await touch.lift();
  await expect.poll(() => heldZones(page)).toEqual([]);
});

/** The step the step display highlights as played, or -1 while none is. */
const playedStep = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelector('[aria-label="step display"] .step-line')!.children].findIndex((cell) =>
      cell.classList.contains('now'),
    ),
  );

/** The pattern plays on with no loop: the played step runs on and is the playhead step. */
async function expectNoLoop(page: Page) {
  // After a play tap the step display shows nothing until step 0 reaches the
  // speakers, and a slow machine may still be starting the audio device:
  // watch only once a played step shows.
  await expect.poll(() => playedStep(page)).toBeGreaterThanOrEqual(0);
  let seen: Seen | undefined;
  await expect.poll(async () => (seen = await watch(page))).toMatchObject({ start: expect.any(Number) });
  expect(seen).toMatchObject({ playhead: false });
  expect(seen!.steps).toBeGreaterThan(4);
  expect(await heldZones(page)).toEqual([]);
}

test('pressing a zone while stopped does nothing, also once play starts under the finger and it slides', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'stop' }).click();
  const touch = await finger(page, '1/8');
  expect(await heldZones(page)).toEqual([]);

  await page.getByRole('button', { name: 'play' }).click();
  await expectNoLoop(page);
  await touch.slideTo(await centre(zone(page, '1/16')));
  await expectNoLoop(page);

  // The player must touch again.
  await touch.lift();
  await finger(page, '1/16');
  await expect.poll(() => heldZones(page)).toEqual(['1/16']);
});

test('a finger held through stop and play holds nothing until it lifts', async ({ page }) => {
  const touch = await finger(page, '1/8');
  await expect.poll(() => heldZones(page)).toEqual(['1/8']);
  await page.getByRole('button', { name: 'stop' }).click();
  expect(await heldZones(page)).toEqual([]);

  await page.getByRole('button', { name: 'play' }).click();
  await touch.slideTo(await centre(zone(page, '1/4')));
  await expectNoLoop(page);
});

test('a focused zone holds while space is down', async ({ page }) => {
  await zone(page, '1/16').focus();
  await page.keyboard.down('Space');
  await expect.poll(() => heldZones(page)).toEqual(['1/16']);
  await page.keyboard.up('Space');
  await expect.poll(() => heldZones(page)).toEqual([]);
});
