import { expect, test, type Locator, type Page } from '@playwright/test';
import { readout } from './pad-readout.ts';

// Set anchor and return on bar, on the phone play screen with all six strips.

test.use({ viewport: { width: 393, height: 750 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '▶ tap to play' }).click();
});

const strip = (page: Page, label: string) => page.getByRole('slider', { name: label, exact: true });
const valueOf = async (slider: Locator) => Number(await slider.getAttribute('aria-valuenow'));
const muteButton = (page: Page, drum: string) => page.getByRole('button', { name: `mute ${drum}`, exact: true });
const returnButton = (page: Page) => page.getByRole('button', { name: '↺ return on bar' });

/**
 * A tap on the pad at a fraction of its width and height from the top left,
 * on a whole pixel: WebKit and Firefox drop the fraction of a pointer's
 * coordinates and Chromium keeps it, which on a short pad moves the readout.
 */
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

/**
 * The step display's highlighted step and a strip's value, sampled every
 * frame while the return button reports a return pending; ten seconds at most.
 */
async function whilePending(page: Page, slider: Locator) {
  return slider.evaluate(
    (slider, button) =>
      new Promise<{ step: number; value: number }[]>((resolve) => {
        const line = document.querySelector('[aria-label="step display"] .step-line');
        const samples: { step: number; value: number }[] = [];
        const sample = () => {
          if (button.getAttribute('aria-description') !== 'pending' || samples.length > 600) return resolve(samples);
          samples.push({
            step: line ? [...line.children].findIndex((cell) => cell.classList.contains('now')) : -1,
            value: Number(slider.getAttribute('aria-valuenow')),
          });
          requestAnimationFrame(sample);
        };
        sample();
      }),
    await returnButton(page).elementHandle(),
  );
}

test('return brings back the anchored strip and position at the next bar, and leaves tempo and mutes', async ({ page }) => {
  const drive = strip(page, 'drive');

  // The groove to come back to.
  await drive.press('End');
  await tapPad(page, 0.2, 0.8);
  await expect.poll(() => readout(page)).toEqual({ x: 20, y: 20 });
  await page.getByRole('button', { name: 'set anchor' }).click();

  // Noodling: the strip, the pad, the tempo and a mute.
  await drive.press('Home');
  await tapPad(page, 0.8, 0.2);
  await expect.poll(() => readout(page)).toEqual({ x: 80, y: 80 });
  await page.getByRole('button', { name: 'tempo up' }).click();
  await muteButton(page, 'sd').click();
  const bpm = page.getByText(/^\d+ bpm$/);
  await expect(bpm).toHaveText('129 bpm');

  await earlyInBar(page);
  await returnButton(page).click();
  await expect(returnButton(page)).toHaveAccessibleDescription('pending');

  // Pending until the bar line, with the noodled drive.
  const pending = await whilePending(page, drive);
  expect(pending.map((now) => now.value)).toEqual(pending.map(() => 0));
  const steps = pending.map((now) => now.step);
  expect(steps, 'no bar line crossed while pending').toEqual([...steps].sort((a, b) => a - b));
  // It clears as the bar line is queued, a lookahead plus the output latency before it is heard.
  expect(steps.at(-1), 'pending into the end of the bar').toBeGreaterThanOrEqual(20);

  // Landed: the anchored strip and position, the noodled tempo and mutes.
  await expect(returnButton(page)).not.toHaveAccessibleDescription('pending');
  expect(await valueOf(drive)).toBe(100);
  await expect.poll(() => readout(page)).toEqual({ x: 20, y: 20 });
  await expect(bpm).toHaveText('129 bpm');
  await expect(muteButton(page, 'sd')).toHaveAttribute('aria-pressed', 'true');
});

test('on a fresh load, return brings back the loaded setup', async ({ page }) => {
  const chaos = strip(page, 'chaos');
  const loaded = { chaos: await valueOf(chaos), at: await readout(page) };

  await chaos.press('End');
  await tapPad(page, 0.9, 0.1);
  await expect.poll(() => readout(page)).toEqual({ x: 90, y: 90 });
  await returnButton(page).click();

  await expect(chaos).toHaveAttribute('aria-valuenow', String(loaded.chaos));
  await expect.poll(() => readout(page)).toEqual(loaded.at);
});

test('stop lands a pending return at once, and while stopped return lands at once', async ({ page }) => {
  const chaos = strip(page, 'chaos');
  const loaded = await valueOf(chaos);

  // With no return pending, stop keeps the setup.
  await chaos.press('End');
  await page.getByRole('button', { name: 'stop' }).click();
  await expect(chaos).toHaveAttribute('aria-valuenow', '100');
  await page.getByRole('button', { name: 'play' }).click();

  await chaos.press('End');
  await earlyInBar(page);
  await returnButton(page).click();
  await expect(returnButton(page)).toHaveAccessibleDescription('pending');
  await page.getByRole('button', { name: 'stop' }).click();
  await expect(chaos).toHaveAttribute('aria-valuenow', String(loaded));
  await expect(returnButton(page)).not.toHaveAccessibleDescription('pending');

  await chaos.press('End');
  await returnButton(page).click();
  await expect(chaos).toHaveAttribute('aria-valuenow', String(loaded));
  await expect(returnButton(page)).not.toHaveAccessibleDescription('pending');
});
