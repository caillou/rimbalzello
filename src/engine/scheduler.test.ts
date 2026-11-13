import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { PATTERN_STEPS } from './pattern';
import { createScheduler } from './scheduler';
import { createSetupStore } from './setup-store';
import { createTransport, type TimedStep } from './transport';

/** The part of an AudioContext the scheduler reads, driven by the test. */
interface FakeContext {
  state: AudioContextState;
  currentTime: number;
  baseLatency: number;
  outputLatency: number;
}

/** A frame of the step display: the context clock then, and the step heard. */
interface Frame {
  now: number;
  step: TimedStep;
}

/** Taps play on a fake audio clock at its current time, with a silent kit. */
function playOnFakeClock(context: FakeContext) {
  vi.useFakeTimers();
  onTestFinished(() => void vi.useRealTimers());
  const kit = { trigger() {}, cancelScheduled() {}, setMuted() {}, setDrift() {}, setDrive() {} };
  const store = createSetupStore();
  const transport = createTransport({ setup: store.setup(), seed: 1 });
  const scheduler = createScheduler(context as unknown as BaseAudioContext, kit, transport, store);
  scheduler.play();

  const playedAt = context.currentTime;
  let ms = 0;
  /**
   * Frames every 5 ms up to `until` seconds after play: the clock moves, the
   * timer wakes, the step display reads the step heard.
   */
  function frames(until: number): Frame[] {
    const shown: Frame[] = [];
    while (ms < until * 1000) {
      ms += 5;
      context.currentTime = playedAt + ms / 1000;
      vi.advanceTimersByTime(25);
      const step = scheduler.heard();
      if (step) shown.push({ now: context.currentTime, step });
    }
    return shown;
  }
  return { scheduler, frames, playedAt, stepLength: 60 / store.setup().bpm / 8 };
}

/**
 * Plays on a context that has run a while, as any play after the first.
 * Read at play, the output latency then rises by three steps; the scheduler
 * reads it again a second later.
 */
function playingThroughLatencyRise() {
  const context: FakeContext = { state: 'running', currentTime: 2, baseLatency: 0, outputLatency: 0 };
  const playing = playOnFakeClock(context);
  context.outputLatency = 3 * playing.stepLength;
  return playing;
}

describe('heard step', () => {
  it('never goes back on the step display when the output latency rises', () => {
    const times = playingThroughLatencyRise()
      .frames(1.6)
      .map(({ step }) => step.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('starts a loop held right after the rise on the step the display shows', () => {
    const { scheduler, frames, playedAt } = playingThroughLatencyRise();
    const shown = frames(1.03).at(-1)!.step.played;
    scheduler.hold(4);
    // Once a loop pass has gone by, only the four steps from the one shown sound.
    const heard = frames(2.5)
      .filter(({ step }) => step.time > playedAt + 2)
      .map(({ step }) => step.played);
    expect(new Set(heard)).toEqual(new Set([0, 1, 2, 3].map((n) => (shown + n) % PATTERN_STEPS)));
  });

  it('follows the speakers within half a second when play comes before the context runs, not after a second', () => {
    // The play tap starts the context, which reports no output latency until it runs.
    const context: FakeContext = { state: 'suspended', currentTime: 0, baseLatency: 0, outputLatency: 0 };
    const { scheduler, frames, stepLength } = playOnFakeClock(context);
    // A slow audio device: the timer wakes and the display reads for a while before the clock moves.
    for (let wake = 0; wake < 8; wake++) {
      vi.advanceTimersByTime(25);
      expect(scheduler.heard()).toBeUndefined();
    }
    context.state = 'running';
    const latency = 3 * stepLength;
    context.outputLatency = latency;

    const shown = frames(1.6).filter(({ now }) => now >= 0.5);
    expect(shown.length).toBeGreaterThan(0);
    for (const { now, step } of shown) {
      // Not ahead of the speakers, and not held behind them: a step lasts
      // at most 1.12 step lengths at the default swing.
      expect(step.time).toBeLessThanOrEqual(now - latency);
      expect(now - latency - step.time).toBeLessThan(1.5 * stepLength);
    }
  });
});
