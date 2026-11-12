// Transport: what to play at time t. It owns tempo, swing, the playhead, the
// chaos RNG, the glide and return quantisation, and reads the pattern from the
// pattern generator at every step.
//
// Pure and clock-injected: every time is passed in, in seconds on whatever
// clock the caller runs, and nothing here touches Web Audio, the DOM or
// timers, so it can move into an AudioWorklet later. The scheduler drives it
// from the AudioContext clock and plays its steps through the kit.

import { PATTERN_STEPS, hitsAt, perturbation, type PatternInput } from './pattern';
import { DRUMS, type Drum } from './setup';
import type { SetupSnapshot } from './setup-store';
import { tunables } from './tunables';

/** The part of the setup the transport plays: pattern, tempo and swing. */
export type TransportSetup = Pick<SetupSnapshot, 'x' | 'y' | 'chaos' | 'density' | 'bpm' | 'swing'>;

/** What a return restores: the transport's setup minus tempo. */
export type ReturnSetup = Omit<TransportSetup, 'bpm'>;

export interface TransportOptions {
  /** The setup to play; later changes come through `update`. */
  setup: TransportSetup;
  /** Seed of the chaos RNG: the same seed rolls the same perturbations. */
  seed: number;
}

/** One drum to play, and how hard (0–1). */
export interface Hit {
  drum: Drum;
  velocity: number;
}

/** One step the transport hands out: when it sounds and what it plays. */
export interface TimedStep {
  /** The playhead step, 0–31. Bar lines, chaos, return and swing follow it. */
  playhead: number;
  /** The step whose hits play: the playhead step while no loop is held. */
  played: number;
  /** When the step sounds, in clock seconds, swing included. */
  time: number;
  /**
   * The pattern the step reads, as the pattern generator's input: the
   * position (gliding toward the pad target), densities and chaos perturbations.
   */
  pattern: PatternInput;
  /** The drums that hit on the played step. */
  hits: Hit[];
  /** A pending return landed on this step: from here the anchor's setup plays. */
  returned: boolean;
}

export interface Transport {
  readonly playing: boolean;
  /** True from `requestReturn` until the return lands. */
  readonly returnPending: boolean;
  /** Plays from step 0, with step 0 sounding at `time`. Rolls chaos. */
  start(time: number): void;
  stop(): void;
  /**
   * The setup to play from the next step handed out. A new pad position
   * glides there from where the position is; the rest applies at once.
   */
  update(setup: TransportSetup): void;
  /**
   * Return: `setup` replaces the playing setup when the playhead next crosses
   * step 0, and the position jumps there without gliding. Tempo is not part
   * of it. A second request before the return lands replaces the first.
   */
  requestReturn(setup: ReturnSetup): void;
  /**
   * The steps due before `until`, in time order. Each step is handed out
   * once: the next call continues after the last step already returned.
   */
  stepsBefore(until: number): TimedStep[];
}

interface Position {
  x: number;
  y: number;
}

/** The position travelling toward a pad target, one step at a time. */
interface Glide {
  from: Position;
  to: Position;
  /** Steps of the glide handed out so far. It has arrived at `tunables.glideSteps`. */
  steps: number;
}

/** Length of one step in seconds: a beat is 8 steps. */
function stepDuration(bpm: number): number {
  return 60 / bpm / 8;
}

/**
 * How late swing puts a step, in seconds. The off-beat 16th (step mod 4 = 2)
 * moves by d = (p − 0.5) × 2 × a 16th; the 32nds either side of it move by
 * d/2, so they stay halfway between their neighbours.
 */
function swingDelay(playhead: number, swing: number, stepLength: number): number {
  const delay = (swing / 100 - 0.5) * 2 * (2 * stepLength);
  const slot = playhead % 4;
  return slot === 0 ? 0 : slot === 2 ? delay : delay / 2;
}

function glidePosition({ from, to, steps }: Glide): Position {
  const done = Math.min(1, steps / tunables.glideSteps);
  return { x: from.x + (to.x - from.x) * done, y: from.y + (to.y - from.y) * done };
}

/** A position at rest: no glide under way. */
function settledAt(position: Position): Glide {
  return { from: position, to: position, steps: tunables.glideSteps };
}

function positionOf({ x, y }: ReturnSetup): Position {
  return { x, y };
}

function copy<T extends ReturnSetup>(setup: T): T {
  return { ...setup, density: { ...setup.density } };
}

/**
 * A seeded source of random bytes (the mulberry32 generator, public domain):
 * the same seed gives the same bytes on every device.
 */
function randomBytes(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = Math.imul(state ^ (state >>> 15), state | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return (z ^ (z >>> 14)) >>> 24;
  };
}

export function createTransport({ setup: initial, seed }: TransportOptions): Transport {
  const random = randomBytes(seed);
  const { velocity } = tunables;
  let setup = copy(initial);
  let playing = false;
  /** The setup a pending return restores; null while none is pending. */
  let returnTo: ReturnSetup | null = null;
  // Random bytes rolled once per bar. The chaos amount scales them into
  // perturbations at every step, so a chaos change is heard at once.
  let chaosBytes: Record<Drum, number> = { bd: 0, sd: 0, hh: 0 };
  let glide = settledAt(positionOf(setup));
  // The playhead: the next step to hand out, counted from play start without wrapping.
  let next = 0;
  // Step times are counted from the last tempo change, not summed, so they
  // never drift: step `sinceStep` sat at clock time `sinceTime`, and each step
  // since lasts `stepLength`.
  let sinceStep = 0;
  let sinceTime = 0;
  let stepLength = stepDuration(setup.bpm);

  /**
   * The looper's seam: the step whose hits play when the playhead is at step
   * `playhead`, counted without wrapping. No looper yet, so the playhead step.
   */
  function playedStep(playhead: number): number {
    return playhead % PATTERN_STEPS;
  }

  /**
   * A tempo change applies from the next step: the gap before it is the first
   * at the new tempo. Calling it again at the same tempo changes nothing.
   * The previous step keeps the swing delay it was handed out with, so a jump
   * of more than 1.5× at heavy swing can put a step before the one ahead of
   * it; clamp here if tap tempo makes that audible.
   */
  function retime(bpm: number): void {
    const length = stepDuration(bpm);
    if (length === stepLength) return;
    const from = Math.max(0, next - 1);
    sinceTime += (from - sinceStep) * stepLength;
    sinceStep = from;
    stepLength = length;
  }

  /** The step the playhead reaches at `count` steps from play start. */
  function stepAt(count: number, time: number, returned: boolean): TimedStep {
    const position = glidePosition(glide);
    const playhead = count % PATTERN_STEPS;
    const played = playedStep(count);
    const pattern: PatternInput = {
      x: Math.round(position.x),
      y: Math.round(position.y),
      density: { ...setup.density },
      perturbation: {
        bd: perturbation(chaosBytes.bd, setup.chaos),
        sd: perturbation(chaosBytes.sd, setup.chaos),
        hh: perturbation(chaosBytes.hh, setup.chaos),
      },
    };
    const atStep = hitsAt(pattern, played);
    const hits = DRUMS.filter((drum) => atStep[drum].hit).map((drum) => ({
      drum,
      velocity: atStep[drum].accent ? velocity.accent : velocity.hit,
    }));
    return { playhead, played, time, pattern, hits, returned };
  }

  return {
    get playing() {
      return playing;
    },
    get returnPending() {
      return returnTo !== null;
    },
    start(time) {
      playing = true;
      next = 0;
      sinceStep = 0;
      sinceTime = time;
      stepLength = stepDuration(setup.bpm);
    },
    stop() {
      playing = false;
      // Whatever is left of a glide is skipped: play starts on the target.
      glide = settledAt(glide.to);
    },
    update(changed) {
      const to = positionOf(changed);
      if (!playing) glide = settledAt(to);
      // The new glide starts from the position the last step read.
      else if (to.x !== glide.to.x || to.y !== glide.to.y) glide = { from: glidePosition(glide), to, steps: 0 };
      setup = copy(changed);
    },
    requestReturn(restore) {
      returnTo = copy(restore);
    },
    stepsBefore(until) {
      const steps: TimedStep[] = [];
      while (playing) {
        const playhead = next % PATTERN_STEPS;
        retime(setup.bpm);
        const grid = sinceTime + (next - sinceStep) * stepLength;
        // Swing follows the playhead slot, whatever step the looper plays.
        // Step 0 is never swung, so a return landing there cannot move it.
        const time = grid + swingDelay(playhead, setup.swing, stepLength);
        if (time >= until) break;

        // A pending return lands as the playhead crosses step 0 (play start
        // included), never on a looped step 0. Tempo is not part of it.
        const landing = playhead === 0 ? returnTo : null;
        if (landing) {
          setup = { ...landing, bpm: setup.bpm };
          glide = settledAt(positionOf(landing));
          returnTo = null;
        }
        if (playhead === 0) chaosBytes = { bd: random(), sd: random(), hh: random() };
        glide.steps++;
        steps.push(stepAt(next, time, landing !== null));
        next++;
      }
      return steps;
    },
  };
}
