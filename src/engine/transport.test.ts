import { describe, expect, it } from 'vitest';
import { PATTERN_STEPS, hitsAt } from './pattern';
import { DRUMS, defaultSetup } from './setup';
import { createTransport, type TimedStep, type TransportSetup } from './transport';
import { tunables } from './tunables';

/** Length of one step in seconds at a tempo: a beat is 8 steps. */
const stepLength = (bpm: number) => 60 / bpm / 8;

/** The default setup made straight and without chaos: steps sit on the grid and read the map as it is. */
function plain(changes: Partial<TransportSetup> = {}): TransportSetup {
  const { x, y, density, bpm } = defaultSetup();
  return { x, y, density, bpm, chaos: 0, swing: 50, ...changes };
}

const position = (step: TimedStep) => ({ x: step.pattern.x, y: step.pattern.y });

describe('playhead', () => {
  it('hands out every step of two bars once, on the 32nd-note grid at 128 bpm, however the timer wakes', () => {
    const setup = plain({ bpm: 128 });
    const transport = createTransport({ setup, seed: 1 });
    const origin = 10.05;
    const step = stepLength(128);
    transport.start(origin);

    // A timer that mostly wakes every 25 ms, sometimes late, sometimes early.
    const gaps = [0.025, 0.025, 0.07, 0.025, 0.004];
    const steps: TimedStep[] = [];
    for (let now = 10, i = 0; now < origin + 2 * PATTERN_STEPS * step; now += gaps[i++ % gaps.length] ?? 0) {
      steps.push(...transport.stepsBefore(now + tunables.lookahead));
    }
    const twoBars = steps.slice(0, 2 * PATTERN_STEPS);

    expect(twoBars.map((s) => s.playhead)).toEqual([...Array(2 * PATTERN_STEPS).keys()].map((n) => n % PATTERN_STEPS));
    twoBars.forEach((s, n) => expect(s.time, `step ${n}`).toBeCloseTo(origin + n * step, 9));

    // Each step plays the pattern at the setup's position, accents louder.
    const input = { x: setup.x, y: setup.y, density: { ...setup.density }, perturbation: { bd: 0, sd: 0, hh: 0 } };
    const expected = twoBars.map((s) => {
      const atStep = hitsAt(input, s.playhead);
      return DRUMS.filter((drum) => atStep[drum].hit).map((drum) => ({
        drum,
        velocity: atStep[drum].accent ? tunables.velocity.accent : tunables.velocity.hit,
      }));
    });
    expect(twoBars.map((s) => s.hits)).toEqual(expected);
    expect(expected.flat().some((hit) => hit.velocity === tunables.velocity.accent), 'the bar has an accent').toBe(true);
  });

  it('changes the spacing from the next step when the tempo changes mid-bar', () => {
    const transport = createTransport({ setup: plain({ bpm: 128 }), seed: 1 });
    const before = stepLength(128);
    const after = stepLength(100);
    transport.start(0);
    const first = transport.stepsBefore(10.5 * before);
    transport.update(plain({ bpm: 100 }));
    const rest = transport.stepsBefore(10 * before + 10.5 * after);

    const all = [...first, ...rest];
    const gaps = all.slice(1).map((s, n) => s.time - (all[n]?.time ?? NaN));
    expect(first.at(-1)?.playhead).toBe(10);
    expect(gaps.slice(0, 10)).toEqual(Array(10).fill(expect.closeTo(before, 9)));
    expect(gaps.slice(10)).toEqual(Array(10).fill(expect.closeTo(after, 9)));
  });

  it('hands out nothing after stop, and restarts at step 0 on the next start', () => {
    const transport = createTransport({ setup: plain(), seed: 1 });
    const step = stepLength(plain().bpm);
    transport.start(0);
    transport.stepsBefore(13.5 * step);
    transport.stop();

    expect(transport.stepsBefore(100)).toEqual([]);

    transport.start(20);
    const restarted = transport.stepsBefore(20 + 1.5 * step);
    expect(restarted.map((s) => [s.playhead, s.time])).toEqual([
      [0, 20],
      [1, expect.closeTo(20 + step, 9)],
    ]);
  });
});

describe('swing', () => {
  /** How late each of the first nine steps lands, in ms, at 120 bpm. */
  function lateness(swing: number): number[] {
    const transport = createTransport({ setup: plain({ bpm: 120, swing }), seed: 1 });
    transport.start(0);
    return transport.stepsBefore(9 * stepLength(120)).map((s, n) => (s.time - n * stepLength(120)) * 1000);
  }

  it('at 56 % and 120 bpm puts the off-beat 16th about 15 ms late and the 32nds beside it half that', () => {
    expect(lateness(56)).toEqual([0, 7.5, 15, 7.5, 0, 7.5, 15, 7.5, 0].map((ms) => expect.closeTo(ms, 6)));
  });

  it('at 50 % moves nothing', () => {
    expect(lateness(50)).toEqual(Array(9).fill(expect.closeTo(0, 6)));
  });
});

describe('chaos', () => {
  it('re-rolls the perturbations once per bar, at step 0, and again at play start', () => {
    const transport = createTransport({ setup: plain({ chaos: 255 }), seed: 7 });
    const step = stepLength(plain().bpm);
    transport.start(0);
    const bars = [0, 1, 2].map((bar) => transport.stepsBefore((bar + 1) * PATTERN_STEPS * step - step / 2));
    // Stopped five steps into the fourth bar.
    const stopped = transport.stepsBefore((3 * PATTERN_STEPS + 4.5) * step);
    transport.stop();
    transport.start(100);
    const restart = transport.stepsBefore(100 + PATTERN_STEPS * step - step / 2);

    const perturbations = [...bars, stopped, restart].map((bar) => {
      expect(bar).toHaveLength(bar === stopped ? 5 : PATTERN_STEPS);
      const first = bar[0]!.pattern.perturbation;
      bar.forEach((s) => expect(s.pattern.perturbation, `step ${s.playhead}`).toEqual(first));
      return first;
    });
    // Play start rolled the first bar, not left it at zero.
    expect(Object.values(perturbations[0]!).some((p) => p > 0)).toBe(true);
    // Every bar rolled its own, including the one play restarted.
    expect(new Set(perturbations.map((p) => JSON.stringify(p))).size).toBe(perturbations.length);
    // And the hits follow them.
    for (const s of bars.flat()) {
      const atStep = hitsAt(s.pattern, s.played);
      expect(s.hits.map((hit) => hit.drum)).toEqual(DRUMS.filter((drum) => atStep[drum].hit));
    }
  });
});

describe('return', () => {
  const start = plain({ x: 30, y: 200, bpm: 128 });
  const anchor = plain({ x: 220, y: 40, density: { bd: 255, sd: 0, hh: 128 }, swing: 60, bpm: 90 });
  const step = stepLength(128);

  it('requested at step 9 lands at the next step 0, not before, jumping the position and keeping the tempo', () => {
    const transport = createTransport({ setup: start, seed: 1 });
    transport.start(0);
    transport.stepsBefore(9.5 * step);
    transport.requestReturn(anchor);

    const restOfBar = transport.stepsBefore(31.5 * step);
    expect(restOfBar.map((s) => s.playhead)).toEqual([...Array(22).keys()].map((n) => n + 10));
    for (const s of restOfBar) {
      expect(s.returned).toBe(false);
      expect(position(s)).toEqual({ x: start.x, y: start.y });
      expect(s.pattern.density).toEqual(start.density);
    }
    expect(transport.returnPending).toBe(true);

    const nextBar = transport.stepsBefore(40.5 * step);
    expect(transport.returnPending).toBe(false);
    expect(nextBar.map((s) => [s.playhead, s.returned])).toEqual(
      [...Array(9).keys()].map((n) => [n, n === 0]),
    );
    // No glide: step 0 already reads the anchor's position and densities.
    for (const s of nextBar) {
      expect(position(s)).toEqual({ x: anchor.x, y: anchor.y });
      expect(s.pattern.density).toEqual(anchor.density);
    }
    // Still 128 bpm, now with the anchor's swing on the off-beat 16th.
    expect(nextBar[0]?.time).toBeCloseTo(32 * step, 9);
    expect(nextBar[1]?.time).toBeCloseTo((33 + 0.2) * step, 9);
    expect(nextBar[2]?.time).toBeCloseTo((34 + 0.4) * step, 9);
    expect(nextBar[4]?.time).toBeCloseTo(36 * step, 9);
  });
});

describe('glide', () => {
  const step = stepLength(plain().bpm);

  /** Whether `p` lies in the box spanned by `a` and `b`, edges included. */
  function between(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
    const within = (v: number, s: number, t: number) => v >= Math.min(s, t) && v <= Math.max(s, t);
    return within(p.x, a.x, b.x) && within(p.y, a.y, b.y);
  }

  it('moves toward a new pad target from the first step, through points in between, and arrives within the glide length', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 200, y: 100 };
    const transport = createTransport({ setup: plain(from), seed: 1 });
    transport.start(0);
    transport.stepsBefore(5.5 * step);
    transport.update(plain(to));
    const path = transport.stepsBefore(15.5 * step).map(position);

    expect(path[0]).not.toEqual(from);
    expect(path[0]).not.toEqual(to);
    expect(between(path[0]!, from, to)).toBe(true);
    expect(path.slice(tunables.glideSteps - 1)).toEqual(Array(path.length - tunables.glideSteps + 1).fill(to));
  });

  it('glides a jump made during a glide from where the position is', () => {
    const b = { x: 200, y: 100 };
    const c = { x: 200, y: 250 };
    const d = { x: 200, y: 200 };
    const transport = createTransport({ setup: plain(b), seed: 1 });
    transport.start(0);
    transport.stepsBefore(5.5 * step);
    transport.update(plain(c));
    const [halfway] = transport.stepsBefore(6.5 * step).map(position);
    transport.update(plain(d));
    const path = transport.stepsBefore(15.5 * step).map(position);

    expect(halfway).not.toEqual(c);
    expect(path[0]).not.toEqual(halfway);
    expect(between(path[0]!, halfway!, d)).toBe(true);
    expect(path.at(-1)).toEqual(d);
  });
});
