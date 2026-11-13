import { describe, expect, it } from 'vitest';
import { PATTERN_STEPS, hitsAt } from './pattern';
import { DRUMS, defaultSetup } from './setup';
import { createTransport, type LoopSteps, type TimedStep, type TransportSetup } from './transport';
import { tunables } from './tunables';

/** Length of one step in seconds at a tempo: a beat is 8 steps. */
const stepLength = (bpm: number) => 60 / bpm / 8;

/** The default setup made straight and without chaos: steps sit on the grid and read the map as it is. */
function plain(changes: Partial<TransportSetup> = {}): TransportSetup {
  const { x, y, density, bpm } = defaultSetup();
  return { x, y, density, bpm, chaos: 0, swing: 50, ...changes };
}

const position = (step: TimedStep) => ({ x: step.pattern.x, y: step.pattern.y });

/** The hits the setup's pattern has on `step`, chaos aside, accents louder and marked. */
function hitsOn(setup: TransportSetup, step: number) {
  const atStep = hitsAt({ x: setup.x, y: setup.y, density: setup.density, perturbation: { bd: 0, sd: 0, hh: 0 } }, step);
  return DRUMS.filter((drum) => atStep[drum].hit).map((drum) => ({
    drum,
    velocity: atStep[drum].accent ? tunables.velocity.accent : tunables.velocity.hit,
    accent: atStep[drum].accent,
  }));
}

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
    const expected = twoBars.map((s) => hitsOn(setup, s.playhead));
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

  it('reports the step heard at a time: the last one sounding by then, not the steps handed out ahead of it', () => {
    const transport = createTransport({ setup: plain(), seed: 1 });
    const step = stepLength(plain().bpm);
    transport.start(1);
    transport.stepsBefore(1 + 2.5 * step);
    const heardAt = (time: number) => transport.stepHeardAt(time)?.playhead;

    expect(heardAt(0.9)).toBeUndefined();
    expect(heardAt(1 + 0.5 * step)).toBe(0);
    expect(heardAt(1 + 1.5 * step)).toBe(1);
    // Past the last step handed out, the last one stays heard until more come.
    expect(heardAt(1 + 5 * step)).toBe(2);
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

describe('looper', () => {
  /**
   * Plays a transport the way the scheduler does, on a fake clock counted in
   * steps from play start: a timer wakes every 25 ms and queues the steps due
   * within the lookahead; a loop change cancels the steps queued after now,
   * like the kit, and queues again. The player hears the steps `heard` lists.
   */
  function createPlayer(setup: TransportSetup, { lookahead = tunables.lookahead, latency = 0, seed = 1 } = {}) {
    const transport = createTransport({ setup, seed });
    const step = stepLength(setup.bpm);
    let now = 0;
    let queued: TimedStep[] = [];
    const wake = () => queued.push(...transport.stepsBefore(now + lookahead));
    const changed = () => {
      queued = queued.filter((s) => s.time <= now);
      wake();
    };
    transport.start(0);
    wake();
    return {
      transport,
      /** Runs the clock on to `steps` steps after play start. */
      to(steps: number) {
        while (now < steps * step) {
          now = Math.min(steps * step, now + 0.025);
          wake();
        }
      },
      hold(steps: LoopSteps) {
        transport.hold(steps, { now, heard: now - latency * step });
        changed();
      },
      release() {
        transport.release(now);
        changed();
      },
      /** What sounds from playhead step `from` (counted from play start) to before `to`. */
      heard(from: number, to: number) {
        const steps = queued.slice(from, to);
        expect(steps.map((s) => s.playhead), 'the playhead runs on').toEqual(
          [...Array(to - from).keys()].map((n) => (from + n) % PATTERN_STEPS),
        );
        return steps;
      },
    };
  }

  const played = (steps: TimedStep[]) => steps.map((s) => s.played);

  // Beat 2 is steps 8–15. A touch heard on a beat's last step counts for the next beat (the grace step).
  it.each([
    { heard: 13, size: '1/4', steps: 8, plays: [14, 15, 8, 9, 10] },
    { heard: 13, size: '1/8', steps: 4, plays: [10, 11, 8, 9, 10] },
    { heard: 13, size: '1/32', steps: 1, plays: [8, 8, 8, 8] },
    { heard: 6, size: '1/8', steps: 4, plays: [3, 0, 1, 2, 3] },
    { heard: 15, size: '1/4', steps: 8, plays: [16, 17, 18, 19, 20, 21, 22, 23, 16, 17] },
    { heard: 31, size: '1/8', steps: 4, plays: [0, 1, 2, 3, 0, 1] },
  ] as const)(
    "loops the first steps of the beat heard, keeping the grid, the beat's last step counting for the next beat: $size at step $heard",
    ({ heard, steps, plays }) => {
      const player = createPlayer(plain());
      player.to(heard + 0.5);
      player.hold(steps);
      player.to(heard + 1 + plays.length);

      expect(played(player.heard(heard + 1, heard + 1 + plays.length))).toEqual(plays);
    },
  );

  it('holding 1/8 while step 13 is heard loops steps 8–11 in time with the playhead, and on release plays the step the playhead has reached', () => {
    // Steps are queued about four steps ahead: engage and release are heard
    // from the next step boundary, not a lookahead later.
    const player = createPlayer(plain(), { lookahead: 0.25 });
    player.to(13.5);
    player.hold(4);
    player.to(22.5);
    player.release();
    player.to(28);

    expect(played(player.heard(13, 28))).toEqual([13, 10, 11, 8, 9, 10, 11, 8, 9, 10, 23, 24, 25, 26, 27]);
  });

  it('takes the beat of the step heard, not of the step being scheduled ahead', () => {
    // Steps are queued about four steps ahead, and the speakers lag the clock
    // by two: step 13 is heard (beat 8–15) while step 19 is queued (beat 16–23).
    const player = createPlayer(plain(), { lookahead: 0.25, latency: 2 });
    player.to(15.5);
    expect(player.heard(0, 20).at(-1)?.playhead, 'queued ahead').toBe(19);
    player.hold(4);
    player.to(22);

    expect(played(player.heard(13, 22))).toEqual([13, 14, 15, 8, 9, 10, 11, 8, 9]);
  });

  it('plays the pattern on until the playhead reaches the loop, when the step heard lies ahead of the clock', () => {
    // The speakers run two steps ahead of the clock: step 8 is heard at 6.5, and step 7 is still to sound.
    // The app caps the heard time at the clock, so this stands in for the case it guards there: a grace of
    // more than one step puts the loop's start ahead of steps that get handed out again.
    // A 1/32 loop plays 8 on every step it covers, so step 7 playing 7 shows the pattern still runs there.
    const player = createPlayer(plain(), { lookahead: 0.25, latency: -2 });
    player.to(6.5);
    player.hold(1);
    player.to(14);

    expect(played(player.heard(6, 14))).toEqual([6, 7, 8, 8, 8, 8, 8, 8]);
  });

  it('reports the steps handed out again after a loop change as heard, not the ones they replaced', () => {
    // Steps are queued about four steps ahead; a 1/32 loop engaged on step 12 hands them out again, all playing 8.
    const player = createPlayer(plain(), { lookahead: 0.25 });
    const step = stepLength(plain().bpm);
    player.to(12.5);
    player.hold(1);

    expect([12.5, 13.5, 14.5, 15.5].map((n) => player.transport.stepHeardAt(n * step)?.played)).toEqual([12, 8, 8, 8]);
  });

  it('holding 1/4 at step 4, then sliding to 1/8 when the playhead is in the next beat, keeps the first beat', () => {
    const player = createPlayer(plain());
    player.to(4.5);
    player.hold(8);
    player.to(9.5);
    player.hold(4);
    player.to(15);

    expect(played(player.heard(4, 15))).toEqual([4, 5, 6, 7, 0, 1, 2, 3, 0, 1, 2]);
  });

  it("holding 1/4 at step 4, then sliding to 1/32, repeats the beat's first step", () => {
    const player = createPlayer(plain());
    player.to(4.5);
    player.hold(8);
    player.to(9.5);
    player.hold(1);
    player.to(15);

    expect(played(player.heard(4, 15))).toEqual([4, 5, 6, 7, 0, 1, 0, 0, 0, 0, 0]);
  });

  it('a loop on the first beat repeats step 0 without re-rolling chaos; the re-roll happens when the playhead crosses step 0', () => {
    const player = createPlayer(plain({ chaos: 255 }), { seed: 7 });
    player.to(1.5);
    player.hold(4);
    player.to(66);
    const steps = player.heard(1, 66);

    // The loop plays step 0 eight times in the second bar (playheads 32–63);
    // chaos rolls only where the playhead crosses step 0, at the second and third bars.
    const bars = [steps.slice(0, 31), steps.slice(31, 63), steps.slice(63)];
    expect(played(bars[1]!)).toEqual(Array(8).fill([0, 1, 2, 3]).flat());
    const rolls = bars.map((bar) => {
      const first = bar[0]!.pattern.perturbation;
      bar.forEach((s) => expect(s.pattern.perturbation, `playhead ${s.playhead}`).toEqual(first));
      return JSON.stringify(first);
    });
    expect(new Set(rolls).size).toBe(3);
  });

  it('lets a pending return land on the playhead step 0, and the loop then reads the restored setup', () => {
    const start = plain({ x: 30, y: 200 });
    const anchor = plain({ x: 220, y: 40, density: { bd: 255, sd: 0, hh: 128 } });
    const player = createPlayer(start);
    player.to(13.5);
    player.hold(4);
    player.to(20);
    player.transport.requestReturn(anchor);
    player.to(40);

    const before = player.heard(20, 32);
    const after = player.heard(32, 40);
    before.forEach((s) => expect(s.hits, `playhead ${s.playhead}`).toEqual(hitsOn(start, s.played)));
    expect(after.map((s) => [s.playhead, s.played, s.returned])).toEqual([
      [0, 8, true],
      [1, 9, false],
      [2, 10, false],
      [3, 11, false],
      [4, 8, false],
      [5, 9, false],
      [6, 10, false],
      [7, 11, false],
    ]);
    after.forEach((s) => expect(s.hits, `playhead ${s.playhead}`).toEqual(hitsOn(anchor, s.played)));
    expect(after.map((s) => s.hits), 'the anchor sounds different').not.toEqual(after.map((s) => hitsOn(start, s.played)));
  });

  it('works only while playing: holding while stopped does nothing, and stop ends a held loop', () => {
    const transport = createTransport({ setup: plain(), seed: 1 });
    const step = stepLength(plain().bpm);
    const straight = [...Array(PATTERN_STEPS).keys()];

    transport.hold(4, { now: 0, heard: 0 });
    transport.start(1);
    expect(played(transport.stepsBefore(1 + 31.5 * step))).toEqual(straight);

    transport.stop();
    transport.start(10);
    transport.stepsBefore(10 + 13.5 * step);
    transport.hold(1, { now: 10 + 13.5 * step, heard: 10 + 13.5 * step });
    expect(played(transport.stepsBefore(10 + 15.5 * step))).toEqual([8, 8]);
    transport.stop();
    transport.start(20);
    expect(played(transport.stepsBefore(20 + 31.5 * step))).toEqual(straight);
  });

  it('keeps an accented beat start accented on every 1/32 retrigger', () => {
    const setup = plain();
    const accented = [0, 8, 16, 24].find((n) => hitsOn(setup, n).some((hit) => hit.velocity === tunables.velocity.accent));
    expect(accented, 'a beat start of the default pattern is accented').toBeDefined();
    const player = createPlayer(setup);
    player.to(accented! + 0.5);
    player.hold(1);
    player.to(accented! + 10);

    for (const s of player.heard(accented!, accented! + 10)) {
      expect(s.hits, `playhead ${s.playhead}`).toEqual(hitsOn(setup, accented!));
    }
  });

  it('lands looped steps on the swung slot of the playhead, not of the step they play', () => {
    // Swing 56 % at 120 bpm puts the off-beat 16th 15 ms late, the 32nds beside it 7.5 ms.
    const player = createPlayer(plain({ bpm: 120, swing: 56 }));
    const step = stepLength(120);
    player.to(4.5);
    player.hold(1);
    player.to(9);

    const steps = player.heard(5, 9);
    expect(played(steps)).toEqual([0, 0, 0, 0]);
    expect(steps.map((s, n) => (s.time - (5 + n) * step) * 1000)).toEqual([7.5, 15, 7.5, 0].map((ms) => expect.closeTo(ms, 6)));
  });
});
