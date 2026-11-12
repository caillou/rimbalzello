import { expect, type Page } from '@playwright/test';

// A headless browser plays to no speaker, so playback shows as drum voices
// being started on the AudioContext. The page counts them.

declare global {
  interface Window {
    startedVoices: number;
  }
}

/** Makes the page count the drum voices it starts. Call it before navigating. */
export async function countStartedVoices(page: Page): Promise<void> {
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
}

export const startedVoices = (page: Page) => page.evaluate(() => window.startedVoices);

/**
 * Passes once voices keep starting. A tap on play queues the first window of
 * hits by itself, so only growth past the count so far shows the groove running.
 */
export async function expectGrooveRunning(page: Page): Promise<void> {
  const before = await startedVoices(page);
  expect(before, 'voices queued so far').toBeGreaterThan(0);
  await expect.poll(() => startedVoices(page)).toBeGreaterThan(before);
}
