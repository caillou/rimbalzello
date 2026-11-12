import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { PATTERN_STEPS } from './pattern';
import { createScheduler } from './scheduler';
import { createSetupStore } from './setup-store';
import { createTransport, type TimedStep } from './transport';

/**
 * Plays on a fake audio clock with a silent kit. Read at play, the output
 * latency then rises by three steps; the scheduler reads it again at 1 s.
 */
function playingThroughLatencyRise() {
  vi.useFakeTimers();
  onTestFinished(() => void vi.useRealTimers());
  const context = { currentTime: 0, baseLatency: 0, outputLatency: 0 };
  const kit = { trigger() {}, cancelScheduled() {}, setMuted() {}, setDrift() {}, setDrive() {} };
  const store = createSetupStore({ storage: { getItem: () => null, setItem() {} } });
  const transport = createTransport({ setup: store.setup(), seed: 1 });
  const scheduler = createScheduler(context as unknown as BaseAudioContext, kit, transport, store);
  scheduler.play();
  context.outputLatency = (3 * 60) / store.setup().bpm / 8;

  let ms = 0;
  /** Frames every 5 ms up to `until` seconds: the clock moves, the timer wakes, the step display reads the step heard. */
  function frames(until: number): TimedStep[] {
    const shown: TimedStep[] = [];
    while (ms < until * 1000) {
      ms += 5;
      context.currentTime = ms / 1000;
      vi.advanceTimersByTime(25);
      const step = scheduler.heard();
      if (step) shown.push(step);
    }
    return shown;
  }
  return { scheduler, frames };
}

describe('heard step', () => {
  it('never goes back on the step display when the output latency rises', () => {
    const times = playingThroughLatencyRise().frames(1.6).map((step) => step.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('starts a loop held right after the rise on the step the display shows', () => {
    const { scheduler, frames } = playingThroughLatencyRise();
    const shown = frames(1.03).at(-1)!.played;
    scheduler.hold(4);
    // Once a loop pass has gone by, only the four steps from the one shown sound.
    const heard = frames(2.5).filter((step) => step.time > 2).map((step) => step.played);
    expect(new Set(heard)).toEqual(new Set([0, 1, 2, 3].map((n) => (shown + n) % PATTERN_STEPS)));
  });
});
