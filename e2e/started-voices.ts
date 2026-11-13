import { expect, type Page } from '@playwright/test';

// A headless browser plays to no speaker, so playback shows as drum voices
// being started on the AudioContext. The page counts them, and the late ones
// among them: started for a time the context clock has already passed, so
// they sound at once rather than on their step.

declare global {
  interface Window {
    startedVoices: number;
    lateVoices: number;
  }
}

/** Makes the page count the drum voices it starts. Call it before navigating. */
export async function countStartedVoices(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.startedVoices = 0;
    window.lateVoices = 0;
    // Buffer sources define their own start; oscillators inherit it.
    for (const prototype of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
      if (!Object.hasOwn(prototype, 'start')) continue;
      const { start } = prototype;
      prototype.start = function (this: AudioScheduledSourceNode, ...args: unknown[]) {
        window.startedVoices++;
        if (Number(args[0] ?? 0) < this.context.currentTime) window.lateVoices++;
        Reflect.apply(start, this, args);
      };
    }
  });
}

export const startedVoices = (page: Page) => page.evaluate(() => window.startedVoices);

/** The voices started so far, and how many of them late. */
export const voiceCounts = (page: Page) =>
  page.evaluate(() => ({ started: window.startedVoices, late: window.lateVoices }));

/**
 * Passes once voices keep starting. A tap on play queues the first window of
 * hits by itself, so only growth past the count so far shows the groove running.
 */
export async function expectGrooveRunning(page: Page): Promise<void> {
  const before = await startedVoices(page);
  expect(before, 'voices queued so far').toBeGreaterThan(0);
  await expect.poll(() => startedVoices(page)).toBeGreaterThan(before);
}
