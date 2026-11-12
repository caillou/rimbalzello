import { expect, test, type Page } from '@playwright/test';

// A headless browser plays to no speaker, so playback shows as drum voices
// being started on the AudioContext. The page counts them.

declare global {
  interface Window {
    startedVoices: number;
  }
}

const startedVoices = (page: Page) => page.evaluate(() => window.startedVoices);

/**
 * Passes once voices keep starting after a tap. The tap itself queues the
 * first window of hits, so only growth past that shows the groove running.
 */
async function expectGrooveRunning(page: Page) {
  const afterTap = await startedVoices(page);
  expect(afterTap, 'voices queued by the tap').toBeGreaterThan(0);
  await expect.poll(() => startedVoices(page)).toBeGreaterThan(afterTap);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.startedVoices = 0;
    // Buffer sources define their own start; oscillators inherit it.
    for (const prototype of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
      if (!Object.hasOwn(prototype, 'start')) continue;
      const { start } = prototype;
      prototype.start = function (this: AudioScheduledSourceNode, ...args: unknown[]) {
        window.startedVoices++;
        Reflect.apply(start, this, args);
      };
    }
  });
  await page.goto('/');
});

test('one tap on the overlay starts the groove and the overlay goes away', async ({ page }) => {
  const overlay = page.getByRole('button', { name: '▶ tap to play' });
  await overlay.click();

  await expect(overlay).toBeHidden();
  await expect(page.getByRole('button', { name: 'stop' })).toBeVisible();
  await expectGrooveRunning(page);
});

test('stop silences the groove and play starts it again', async ({ page }) => {
  await page.getByRole('button', { name: '▶ tap to play' }).click();
  await expectGrooveRunning(page);

  await page.getByRole('button', { name: 'stop' }).click();
  const atStop = await startedVoices(page);
  // Longer than the lookahead plus several steps at 128 bpm.
  await page.waitForTimeout(400);
  expect(await startedVoices(page)).toBe(atStop);

  await page.getByRole('button', { name: 'play' }).click();
  await expectGrooveRunning(page);
});
