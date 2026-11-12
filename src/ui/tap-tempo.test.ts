import { expect, test } from 'vitest';
import { tunables } from '../engine/tunables';
import { createTapTempo } from './tap-tempo';

const { taps, outlierRatio, restartGap } = tunables.tapTempo;

/** Taps with these gaps in ms, the first at 0; the tempo each tap gives. */
function tapGaps(gaps: readonly number[]): (number | undefined)[] {
  const tapTempo = createTapTempo();
  let time = 0;
  return [0, ...gaps].map((gap) => tapTempo.tap((time += gap)));
}

const repeat = (count: number, gap: number): number[] => Array<number>(count).fill(gap);

test('taps 500 ms apart give 120 bpm from the second tap on', () => {
  expect(tapGaps(repeat(taps + 2, 500))).toEqual([undefined, ...repeat(taps + 2, 120)]);
});

test('the tempo is the average gap over the last few taps', () => {
  // The last `taps` taps have gaps of 490 ms and one longer gap, averaging
  // 500 ms (120 bpm). The last gap alone reads slower; with the 450 ms gap
  // before them in the average, it would read faster.
  const lastGap = 500 * (taps - 1) - 490 * (taps - 2);
  const results = tapGaps([450, ...repeat(taps - 2, 490), lastGap]);
  expect(results.at(-1)).toBe(120);
});

test('taps faster than 200 bpm clamp to 200, slower than 60 bpm to 60', () => {
  expect(tapGaps(repeat(taps, 250)).at(-1)).toBe(200);
  expect(tapGaps(repeat(taps, 100)).at(-1)).toBe(200);
  expect(tapGaps(repeat(taps, Math.min(1100, restartGap))).at(-1)).toBe(60);
});

test('a gap far from the running average starts a new average', () => {
  // Steady at 120 bpm, then the player taps a much slower tempo: it takes at
  // once instead of blending with the 500 ms gaps.
  const slower = Math.ceil(500 * outlierRatio) + 50;
  const results = tapGaps([...repeat(taps, 500), slower, slower]);
  expect(results.slice(-3)).toEqual([120, Math.round(60_000 / slower), Math.round(60_000 / slower)]);
});

test('after a long pause the next tap starts over', () => {
  expect(tapGaps([500, restartGap + 1, 600])).toEqual([undefined, 120, undefined, 100]);
});
