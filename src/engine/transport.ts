// Transport: what to play at time t. It owns tempo, swing, the playhead, the
// chaos RNG, the glide, return quantisation and the looper, and reads the
// pattern from the pattern generator at every step.
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

/** A loop length in steps: the sizes 1/4, 1/8, 1/16 and 1/32 of a bar, the first 8, 4, 2 or 1 steps of a beat. */
export type LoopSteps = 8 | 4 | 2 | 1;

/** One drum to play, how hard (0–1), and whether it is an accent. */
export interface Hit {
  drum: Drum;
  velocity: number;
  accent: boolean;
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
  /**
   * A pending return landed on this step: from here the anchor's setup plays.
   * False when the step is handed out again after a loop change: the return
   * was already handed out with it the first time.
   */
  returned: boolean;
}

export interface Transport {
  readonly playing: boolean;
  /** True from `requestReturn` until the return lands. */
  readonly returnPending: boolean;
  /** Plays from step 0, with step 0 sounding at `time`. Rolls chaos. */
  start(time: number): void;
  /**
   * Stops, and ends a held loop: a loop size still held when play is pressed
   * does not engage. Drops a pending return: with no bar to wait for, the
   * caller lands it at once.
   */
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
   * Holds a loop of `steps` steps: the first `steps` steps of the beat heard
   * at `now`. The heard step is the last step that sounded by `heard`, the
   * clock time reaching the speakers then (`now` minus the output latency),
   * not the step being scheduled ahead. A step in the last
   * `tunables.looper.graceSteps` of a beat counts for the next beat, and the
   * playhead step plays on until the playhead gets there. While a loop is
   * held, another length keeps its beat: only the length changes. The
   * playhead runs on, and from the loop's start the playhead at `p` steps
   * from play start plays step (start + ((p − start) mod length)) mod 32, so
   * the played step sits at the same place in the loop as the playhead.
   *
   * Does nothing while stopped. The steps handed out that sound after `now`
   * are handed out again with the change, so it is heard from the next step
   * boundary: the caller cancels the hits it queued after `now`.
   */
  hold(steps: LoopSteps, at: { now: number; heard: number }): void;
  /**
   * Ends the loop: from the next step boundary after `now` the playhead step
   * plays again, where it would have been without the loop (the slip). While
   * playing, the steps after `now` are handed out again, as for `hold`.
   */
  release(now: number): void;
  /**
   * The steps due before `until`, in time order. Each step is handed out
   * once: the next call continues after the last step already returned.
   * After `hold` and `release` the steps after their `now` come again first,
   * with the same playhead, time and pattern, and replace the earlier ones.
   */
  stepsBefore(until: number): TimedStep[];
  /**
   * The step heard at clock time `heard`: the last step handed out that
   * sounds at or before it, as handed out again after a loop change.
   * Undefined while stopped and before step 0 has sounded.
   */
  stepHeardAt(heard: number): TimedStep | undefined;
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

/** Steps in a beat, a quarter note: steps are 32nd notes. */
const BEAT_STEPS = 8;

/** Length of one step in seconds. */
function stepDuration(bpm: number): number {
  return 60 / bpm / BEAT_STEPS;
}

/**
 * The start of a loop engaged while step `heardCount` is heard, both counted
 * from play start without wrapping: the first step of that step's beat, or of
 * the next beat when it is one of the last `tunables.looper.graceSteps` of its
 * beat.
 */
function loopStart(heardCount: number): number {
  const offset = heardCount % BEAT_STEPS;
  const beat = heardCount - offset;
  return offset < BEAT_STEPS - tunables.looper.graceSteps ? beat : beat + BEAT_STEPS;
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

/**
 * A held loop: its first step, a beat start counted from play start without
 * wrapping, and its length. The start lies ahead of the playhead until the
 * playhead reaches it after a grace step.
 */
interface Loop {
  start: number;
  steps: LoopSteps;
}

/** A step handed out, and the playhead it belongs to counted from play start without wrapping. */
interface Handed {
  count: number;
  step: TimedStep;
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
  /** The loop held, or null. */
  let loop: Loop | null = null;
  // The last bar of steps handed out, oldest first: the heard step is looked
  // up here, and a loop change hands steps out again from here. A bar is far
  // more than the lookahead plus the output latency, even at 200 bpm.
  let handed: Handed[] = [];
  /** Steps taken out of `handed` by a loop change, to hand out again before any new step. */
  let toHandAgain: Handed[] = [];

  /**
   * The step whose hits play when the playhead is at step `count`, counted
   * without wrapping. Before the loop's start the playhead step plays: the
   * loop has not begun. Steps land there with a grace of more than one step,
   * or when a caller hears a step after `now`.
   */
  function playedStep(count: number): number {
    if (!loop || count < loop.start) return count % PATTERN_STEPS;
    const { start, steps } = loop;
    return (start + ((((count - start) % steps) + steps) % steps)) % PATTERN_STEPS;
  }

  /** What the playhead at `count` plays from `pattern`: the played step and its hits, accents louder. */
  function playedHits(count: number, pattern: PatternInput): Pick<TimedStep, 'played' | 'hits'> {
    const played = playedStep(count);
    const atStep = hitsAt(pattern, played);
    const hits = DRUMS.filter((drum) => atStep[drum].hit).map((drum) => ({
      drum,
      velocity: atStep[drum].accent ? velocity.accent : velocity.hit,
      accent: atStep[drum].accent,
    }));
    return { played, hits };
  }

  /** The last step handed out that sounds at or before clock time `heard`. */
  function heardEntry(heard: number): Handed | undefined {
    return handed.findLast((entry) => entry.step.time <= heard);
  }

  /**
   * The step heard at clock time `heard`, counted without wrapping. Before
   * step 0 has sounded there is none; the simplest reading takes the first
   * step kept, which is step 0 then.
   */
  function heardStep(heard: number): number {
    return (heardEntry(heard) ?? handed[0])?.count ?? next;
  }

  /** The steps handed out that sound after `now` are handed out again, before any new step. */
  function handOutAgainAfter(now: number): void {
    const from = handed.findIndex((entry) => entry.step.time > now);
    if (from !== -1) toHandAgain = [...handed.splice(from), ...toHandAgain];
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
    return { playhead, time, pattern, ...playedHits(count, pattern), returned };
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
      handed = [];
      toHandAgain = [];
      next = 0;
      sinceStep = 0;
      sinceTime = time;
      stepLength = stepDuration(setup.bpm);
    },
    stop() {
      playing = false;
      loop = null;
      returnTo = null;
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
    hold(steps, { now, heard }) {
      if (!playing) return;
      // Sliding to another size keeps the start: the loop stays in its beat.
      loop = { start: loop?.start ?? loopStart(heardStep(heard)), steps };
      handOutAgainAfter(now);
    },
    release(now) {
      if (!playing) return;
      loop = null;
      handOutAgainAfter(now);
    },
    stepsBefore(until) {
      const steps: TimedStep[] = [];
      // Steps handed out again after a loop change keep their playhead, time
      // and pattern (chaos, return and glide follow the playhead), and play
      // the step the loop reads now.
      while (playing && toHandAgain[0] && toHandAgain[0].step.time < until) {
        const entry = toHandAgain.shift()!;
        entry.step = { ...entry.step, ...playedHits(entry.count, entry.step.pattern), returned: false };
        handed.push(entry);
        steps.push(entry.step);
      }
      // New steps only once every step to hand out again is out, so the steps stay in time order.
      while (playing && toHandAgain.length === 0) {
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
        const step = stepAt(next, time, landing !== null);
        handed.push({ count: next, step });
        if (handed.length > PATTERN_STEPS) handed.shift();
        steps.push(step);
        next++;
      }
      return steps;
    },
    stepHeardAt(heard) {
      return playing ? heardEntry(heard)?.step : undefined;
    },
  };
}
