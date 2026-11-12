// The tracer's transport: what to play at time t. Pure and clock-injected:
// every time is passed in, in seconds on whatever clock the caller runs, so
// nothing here touches Web Audio or timers. The scheduler drives it from the
// AudioContext clock. The real transport (tempo changes, swing, chaos,
// looper, return) replaces these internals behind the same calls.

import { grooveHits } from './groove';
import { PATTERN_STEPS } from './pattern';
import { DRUMS, type Drum } from './setup';
import { tunables } from './tunables';

/** One drum to play: when (clock seconds) and how hard (0–1). */
export interface TimedHit {
  drum: Drum;
  /** The step (0–31) the hit belongs to. */
  step: number;
  time: number;
  velocity: number;
}

export interface Transport {
  readonly playing: boolean;
  /** Starts the bar from step 0, with step 0 sounding at `time`. */
  start(time: number): void;
  stop(): void;
  /**
   * The hits due before `until`, in time order. Each hit is returned once:
   * the next call continues after the last step already returned.
   */
  hitsBefore(until: number): TimedHit[];
}

/** Length of one step in seconds: a beat is 8 steps. */
function stepDuration(bpm: number): number {
  return 60 / bpm / 8;
}

export function createTransport(bpm: number): Transport {
  const step = stepDuration(bpm);
  const { velocity } = tunables;
  let playing = false;
  // Clock time of step 0, and the playhead: the next step to hand out, counted from the start without wrapping.
  let origin = 0;
  let next = 0;

  return {
    get playing() {
      return playing;
    },
    start(time) {
      playing = true;
      origin = time;
      next = 0;
    },
    stop() {
      playing = false;
    },
    hitsBefore(until) {
      const hits: TimedHit[] = [];
      if (!playing) return hits;
      // Times are computed from the origin, not summed, so they never drift.
      for (let time = origin + next * step; time < until; time = origin + ++next * step) {
        const stepInBar = next % PATTERN_STEPS;
        const atStep = grooveHits(stepInBar);
        for (const drum of DRUMS) {
          const { hit, accent } = atStep[drum];
          if (hit) hits.push({ drum, step: stepInBar, time, velocity: accent ? velocity.accent : velocity.hit });
        }
      }
      return hits;
    },
  };
}
