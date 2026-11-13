import { expect, test, type Page } from './fixtures.ts';
import { countStartedVoices, voiceCounts } from './started-voices.ts';

// Safari runs the timers of a hidden page at most once a second, even while
// it plays (#22), and Playwright cannot hide a page in WebKit. These tests
// slow the page's setInterval to once a second instead; the scheduler is its
// only user. Init scripts do not reach workers, so the worker's timer runs
// as it would. This guards that the groove does not depend on the page's
// timer, not WebKit's throttle itself: only a device shows that (`?debug`).

/** Voices to count after the play tap: a few seconds of the default groove. */
const VOICES = 40;

/** Plays with the page's timer slowed and returns the share of voices started late, after the play tap's own. */
async function lateShareWithSlowPageTimer(page: Page, path: string): Promise<number> {
  await page.addInitScript(() => {
    const { setInterval } = window;
    window.setInterval = ((handler: TimerHandler, timeout = 0, ...args: unknown[]) =>
      setInterval(handler, Math.max(timeout, 1000), ...args)) as typeof window.setInterval;
  });
  await countStartedVoices(page);
  await page.goto(path);
  await page.getByRole('button', { name: '▶ tap to play' }).click();
  // The play tap queues the first hits itself, on time whatever the timer.
  const first = await voiceCounts(page);
  // Counts voices rather than waiting a time, so a slow runner only takes longer.
  await expect
    .poll(async () => (await voiceCounts(page)).started, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(first.started + VOICES);
  const last = await voiceCounts(page);
  return (last.late - first.late) / (last.started - first.started);
}

test('with the page timer slowed as on a hidden Safari page, the worker timer keeps hits on time', async ({ page }) => {
  // Well under the control below, with room for a janky CI runner.
  expect(await lateShareWithSlowPageTimer(page, './')).toBeLessThanOrEqual(0.3);
});

test('without the worker timer, the slowed page timer starts most hits late', async ({ page }) => {
  // Shows the slowed timer bites, so the test above cannot pass by accident.
  expect(await lateShareWithSlowPageTimer(page, './?clock=interval')).toBeGreaterThanOrEqual(0.5);
});
