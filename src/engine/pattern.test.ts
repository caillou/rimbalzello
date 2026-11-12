import { afterEach, describe, expect, test, vi } from 'vitest';
import { NODES } from './map';
import { PATTERN_STEPS, hitsAt, mapLevel, perturbation, type PatternInput } from './pattern';
import { DRUMS, type Drum } from './setup';

// The node placement of the original module (drum_map[5][5]), indexed
// [x >> 6][y >> 6]. The test keeps its own copy so a reordered map fails.
const ORIGINAL_PLACEMENT = [
  [10, 8, 0, 9, 11],
  [15, 7, 13, 12, 6],
  [18, 14, 4, 5, 3],
  [23, 16, 21, 1, 2],
  [24, 19, 17, 20, 22],
];

const DRUM_OFFSET: Record<Drum, number> = { bd: 0, sd: 32, hh: 64 };
const STEPS = Array.from({ length: PATTERN_STEPS }, (_, step) => step);
const BYTES = Array.from({ length: 256 }, (_, value) => value);
const SAMPLE_COORDS = [0, 37, 64, 100, 128, 161, 192, 230, 255];
const SAMPLE_POSITIONS = SAMPLE_COORDS.flatMap((x) => SAMPLE_COORDS.map((y) => ({ x, y })));

/** The level a node stores for a drum at a step. */
function stored(i: number, j: number, drum: Drum, step: number): number {
  return NODES[ORIGINAL_PLACEMENT[i]?.[j] ?? -1]?.[DRUM_OFFSET[drum] + step] ?? NaN;
}

function input(
  x: number,
  y: number,
  density: number,
  chaos: Partial<Record<Drum, number>> = {},
): PatternInput {
  return {
    x,
    y,
    density: { bd: density, sd: density, hh: density },
    perturbation: { bd: 0, sd: 0, hh: 0, ...chaos },
  };
}

/** Names a point of the pattern in a failure list. */
function at(x: number, y: number, drum: Drum, step: number): string {
  return `x ${x} y ${y} ${drum} ${step}`;
}

/** Every drum and step, for checks that sweep the whole pattern. */
function eachDrumStep(check: (drum: Drum, step: number) => void): void {
  for (const drum of DRUMS) for (const step of STEPS) check(drum, step);
}

describe('map levels', () => {
  // Each 8-bit mix rounds down, so a node position plays its node 2 lower.
  test('each inner node position plays the node placed there', () => {
    const wrong: string[] = [];
    for (const i of [0, 1, 2, 3]) {
      for (const j of [0, 1, 2, 3]) {
        eachDrumStep((drum, step) => {
          const level = mapLevel(i * 64, j * 64, drum, step);
          const expected = Math.max(0, stored(i, j, drum, step) - 2);
          if (level !== expected) wrong.push(at(i * 64, j * 64, drum, step));
        });
      }
    }
    expect(wrong).toEqual([]);
  });

  // The outer nodes sit at 256, off the pad; 255 lands within a few levels.
  test('the right and bottom edges play the outer nodes', () => {
    const outer: [number, number][] = [[4, 4]];
    for (const k of [0, 1, 2, 3]) outer.push([4, k], [k, 4]);
    const wrong: string[] = [];
    for (const [i, j] of outer) {
      const x = Math.min(255, i * 64);
      const y = Math.min(255, j * 64);
      eachDrumStep((drum, step) => {
        const off = Math.abs(mapLevel(x, y, drum, step) - stored(i, j, drum, step));
        if (off > 8) wrong.push(at(x, y, drum, step));
      });
    }
    expect(wrong).toEqual([]);
  });

  test.each([
    { why: 'halfway from node 10 (255) to node 15 (0)', x: 32, y: 0, drum: 'sd', step: 16, level: 125 },
    { why: 'halfway from node 10 (255) down to node 8 (8)', x: 0, y: 32, drum: 'sd', step: 16, level: 129 },
    { why: 'halfway from node 15 (0) to node 18 (212)', x: 96, y: 0, drum: 'hh', step: 18, level: 105 },
    { why: 'centre of nodes 5 (204), 1 (255), 3 (191), 2 (0)', x: 160, y: 224, drum: 'bd', step: 16, level: 160 },
  ] as const)('between nodes: $why', ({ x, y, drum, step, level }) => {
    expect(mapLevel(x, y, drum, step)).toBe(level);
  });

  // The interpolation fraction wraps to 0 at every node. Without the 8-bit
  // wrap, crossing x = 64 would jump towards the node after next.
  test('crossing a node line moves the level no more than a step inside a cell', () => {
    const jumps: string[] = [];
    for (const line of [64, 128, 192]) {
      for (const other of BYTES) {
        eachDrumStep((drum, step) => {
          const acrossX = mapLevel(line, other, drum, step) - mapLevel(line - 1, other, drum, step);
          const acrossY = mapLevel(other, line, drum, step) - mapLevel(other, line - 1, drum, step);
          if (Math.abs(acrossX) > 4) jumps.push(at(line, other, drum, step));
          if (Math.abs(acrossY) > 4) jumps.push(at(other, line, drum, step));
        });
      }
    }
    expect(jumps).toEqual([]);
  });

  test('x = 255 stops short of the right-edge node', () => {
    // bd step 5: node 23 (x 192) holds 0, node 24 (x 256) holds 255.
    expect(stored(4, 0, 'bd', 5)).toBe(255);
    expect(mapLevel(255, 0, 'bd', 5)).toBe(250);
  });
});

describe('density', () => {
  test('density 0 is silent, even at full chaos', () => {
    const heard: string[] = [];
    for (const { x, y } of SAMPLE_POSITIONS) {
      for (const step of STEPS) {
        const hits = hitsAt(input(x, y, 0, { bd: 63, sd: 63, hh: 63 }), step);
        for (const drum of DRUMS) if (hits[drum].hit) heard.push(at(x, y, drum, step));
      }
    }
    expect(heard).toEqual([]);
  });

  test('density 255 hits wherever the level is above 0', () => {
    const wrong: string[] = [];
    for (const { x, y } of SAMPLE_POSITIONS) {
      for (const step of STEPS) {
        const hits = hitsAt(input(x, y, 255), step);
        for (const drum of DRUMS) {
          const audible = mapLevel(x, y, drum, step) > 0;
          if (hits[drum].hit !== audible) wrong.push(at(x, y, drum, step));
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  test('a drum hits once its density passes 255 minus the level', () => {
    // sd step 16 at x 32, y 0 has level 125.
    expect(hitsAt(input(32, 0, 130), 16).sd.hit).toBe(false);
    expect(hitsAt(input(32, 0, 131), 16).sd.hit).toBe(true);
  });

  test('raising density never removes a hit', () => {
    const lost: string[] = [];
    for (const { x, y } of SAMPLE_POSITIONS) {
      for (const chaos of [0, 40]) {
        const perturbations = { bd: chaos, sd: chaos, hh: chaos };
        for (const step of STEPS) {
          let before = hitsAt(input(x, y, 0, perturbations), step);
          for (let density = 1; density <= 255; density++) {
            const after = hitsAt(input(x, y, density, perturbations), step);
            for (const drum of DRUMS) {
              const gone = before[drum].hit && !after[drum].hit;
              if (gone) lost.push(`${at(x, y, drum, step)} density ${density}`);
            }
            before = after;
          }
        }
      }
    }
    expect(lost).toEqual([]);
  });
});

describe('accents', () => {
  // hh step 0 at x 0, y 128 (node 0) has level 168.
  test('a hit above level 192 is an accent, at 192 it is not', () => {
    expect(hitsAt(input(0, 128, 255, { hh: 24 }), 0).hh).toEqual({ hit: true, accent: false });
    expect(hitsAt(input(0, 128, 255, { hh: 25 }), 0).hh).toEqual({ hit: true, accent: true });
  });

  // sd step 16 at x 0, y 0 (node 10) has level 253.
  test('a loud step without a hit is no accent', () => {
    expect(hitsAt(input(0, 0, 1), 16).sd).toEqual({ hit: false, accent: false });
  });

  test('chaos on a loud step clips at 255 instead of wrapping to a quiet level', () => {
    // 253 + 62 clips to 255, which passes density 1 (threshold 254).
    expect(hitsAt(input(0, 0, 1, { sd: 62 }), 16).sd).toEqual({ hit: true, accent: true });
  });
});

describe('chaos perturbation', () => {
  test('stays within 0–63 and reaches 62 at full chaos', () => {
    const amounts = BYTES.flatMap((randomByte) =>
      BYTES.map((chaos) => perturbation(randomByte, chaos)),
    );
    expect(amounts.reduce((least, amount) => Math.min(least, amount))).toBe(0);
    expect(amounts.reduce((most, amount) => Math.max(most, amount))).toBe(62);
    expect(perturbation(255, 255)).toBe(62);
  });

  test('chaos 0 never perturbs', () => {
    expect(BYTES.filter((randomByte) => perturbation(randomByte, 0) !== 0)).toEqual([]);
  });
});

describe('purity', () => {
  afterEach(() => vi.restoreAllMocks());

  // The looper replays steps out of order and the step display reads the
  // whole bar, so a step must depend on its inputs only.
  test('steps in any order give the same pattern, without drawing random numbers', () => {
    const random = vi.spyOn(Math, 'random');
    const groove = input(100, 200, 180, { bd: 20, sd: 40, hh: 60 });
    const forwards = STEPS.map((step) => hitsAt(groove, step));
    const backwards = [...STEPS].reverse().map((step) => hitsAt(groove, step)).reverse();
    expect(backwards).toEqual(forwards);
    expect(random).not.toHaveBeenCalled();
  });
});
