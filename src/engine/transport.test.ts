import { describe, expect, it } from 'vitest';
import { grooveHits } from './groove';
import { PATTERN_STEPS } from './pattern';
import { DRUMS } from './setup';
import { createTransport, type TimedHit } from './transport';

const bpm = 128;
const step = 60 / bpm / 8;
const lookahead = 0.1;

/** What the groove says should play in the first `steps` steps after `origin`. */
function expectedHits(origin: number, steps: number) {
  const hits = [];
  for (let n = 0; n < steps; n++) {
    const inBar = n % PATTERN_STEPS;
    for (const drum of DRUMS) {
      if (grooveHits(inBar)[drum].hit) hits.push({ drum, step: inBar, time: expect.closeTo(origin + n * step, 9) });
    }
  }
  return hits;
}

const withoutVelocity = (hits: TimedHit[]) => hits.map(({ drum, step, time }) => ({ drum, step, time }));

describe('tracer transport', () => {
  it('hands out every hit of two bars exactly once, on the 32nd-note grid, however the timer wakes', () => {
    const transport = createTransport(bpm);
    const origin = 10.05;
    transport.start(origin);

    // A timer that mostly wakes every 25 ms, sometimes late, sometimes early.
    const gaps = [0.025, 0.025, 0.07, 0.025, 0.004];
    const hits: TimedHit[] = [];
    for (let now = 10, i = 0; now < origin + 2 * PATTERN_STEPS * step; now += gaps[i++ % gaps.length] ?? 0) {
      hits.push(...transport.hitsBefore(now + lookahead));
    }
    const twoBars = hits.filter((hit) => hit.time < origin + (2 * PATTERN_STEPS - 0.5) * step);

    expect(withoutVelocity(twoBars)).toEqual(expectedHits(origin, 2 * PATTERN_STEPS));
  });

  it('hands out nothing after stop, and restarts at step 0 on the next start', () => {
    const transport = createTransport(bpm);
    transport.start(0);
    transport.hitsBefore(13.5 * step);
    transport.stop();

    expect(transport.hitsBefore(100)).toEqual([]);

    transport.start(20);
    expect(withoutVelocity(transport.hitsBefore(20 + 1.5 * step))).toEqual(expectedHits(20, 2));
  });
});
