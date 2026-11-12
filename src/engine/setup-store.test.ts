import { describe, expect, onTestFinished, test } from 'vitest';
import { defaultSetup, type Setup } from './setup';
import { createSetupStore, rememberedSetup, type SetupStorage, type SetupStore } from './setup-store';

function memoryStorage(): SetupStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

function store(setup: Setup = defaultSetup()): SetupStore {
  return createSetupStore({ setup, storage: memoryStorage() });
}

/** A setup with every byte field at `byte`, so it differs from another one in every field. */
function setupOf(byte: number, bpm: number, swing: number): Setup {
  const fill = (value: unknown): unknown =>
    typeof value === 'number'
      ? byte
      : Object.fromEntries(Object.entries(value as object).map(([key, inner]) => [key, fill(inner)]));
  return { ...(fill(defaultSetup()) as Setup), bpm, swing };
}

const START = setupOf(40, 100, 60);
const ANCHORED = setupOf(90, 120, 66);
const NOODLED = setupOf(200, 170, 72);

function becomes(next: Setup): (setup: Setup) => void {
  return (setup) => void Object.assign(setup, structuredClone(next));
}

describe('anchor', () => {
  test('return restores pattern, sound, swing, drift and drive, and leaves tempo and mutes', () => {
    const s = store(START);
    s.change(becomes(ANCHORED));
    s.setAnchor();
    s.change(becomes(NOODLED));
    s.toggleMute('sd');

    const restored = { ...ANCHORED, bpm: NOODLED.bpm };
    // The transport reads this ahead of the bar to schedule the first hits after the return.
    expect(s.returnSetup()).toEqual(restored);
    s.applyAnchor();
    expect(s.setup()).toEqual(restored);
    expect(s.mutes()).toEqual({ bd: false, sd: true, hh: false });
  });

  test('return before any set anchor restores the setup the session started with', () => {
    const s = store(START);
    s.change(becomes(NOODLED));
    s.applyAnchor();
    expect(s.setup()).toEqual({ ...START, bpm: NOODLED.bpm });
  });
});

describe('pad undo', () => {
  function padMove(s: SetupStore, ...path: [number, number][]): void {
    s.padBegin();
    for (const [x, y] of path) s.padTo(x, y);
    s.padCommit();
  }

  const position = (s: SetupStore) => [s.setup().x, s.setup().y];

  test('undo flips back over the whole last move, again flips forward, and leaves other changes', () => {
    const s = store();
    padMove(s, [10, 20]);
    // A drag, or a run of arrow nudges: one move.
    padMove(s, [30, 40], [50, 60], [70, 80]);
    s.change((setup) => void (setup.chaos = 3));

    s.padUndo();
    expect(position(s)).toEqual([10, 20]);
    expect(s.setup().chaos).toBe(3);
    s.padUndo();
    expect(position(s)).toEqual([70, 80]);
  });

  test('a reverted move records nothing, so a two-finger tap undoes the move before it', () => {
    const s = store();
    padMove(s, [10, 20]);
    padMove(s, [70, 80]);

    // The first finger jumps, the second finger lands: revert, then undo.
    s.padBegin();
    s.padTo(200, 200);
    s.padRevert();
    expect(position(s)).toEqual([70, 80]);
    s.padUndo();
    expect(position(s)).toEqual([10, 20]);
  });

  test('a move that ends where it began keeps the slot', () => {
    const s = store();
    padMove(s, [10, 20]);
    padMove(s, [70, 80]);
    // Arrow nudges against the edge of the pad, or a tap on the spot.
    padMove(s, [70, 80]);

    s.padUndo();
    expect(position(s)).toEqual([10, 20]);
  });

  test('a return empties the slot, so an undo right after it stays on the anchor', () => {
    const s = store();
    s.padTo(10, 20);
    s.setAnchor();
    padMove(s, [70, 80]);
    padMove(s, [200, 210]);

    s.applyAnchor();
    s.padUndo();
    expect(position(s)).toEqual([10, 20]);
  });

  test('the position stays on the pad', () => {
    const s = store();
    padMove(s, [-30, 300]);
    expect(position(s)).toEqual([0, 255]);
  });
});

test('tempo and swing stay in range, so what plays is what the link holds', () => {
  const s = store();
  s.change((setup) => void Object.assign(setup, { bpm: 250, swing: 90 }));
  expect([s.setup().bpm, s.setup().swing]).toEqual([200, 75]);
  s.change((setup) => void Object.assign(setup, { bpm: 0, swing: 10 }));
  expect([s.setup().bpm, s.setup().swing]).toEqual([60, 50]);
});

describe('device memory', () => {
  test('the setup round-trips through storage', () => {
    const storage = memoryStorage();
    expect(rememberedSetup(storage)).toBeUndefined();

    const s = createSetupStore({ setup: START, storage });
    expect(rememberedSetup(storage)).toEqual(START);
    s.change(becomes(NOODLED));
    s.padBegin();
    s.padTo(12, 34);
    s.padCommit();
    expect(rememberedSetup(storage)).toEqual(s.setup());
  });

  function stubLocalStorage(get: () => unknown): void {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get });
    onTestFinished(() => {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    });
  }

  const fails = () => {
    throw new DOMException('storage is blocked', 'SecurityError');
  };

  test.each([
    ['missing', () => undefined],
    ['throwing on access', fails],
    ['throwing on use', () => ({ getItem: fails, setItem: fails })],
  ])('a %s localStorage does not stop the store', (_, get) => {
    stubLocalStorage(get);
    expect(rememberedSetup()).toBeUndefined();
    const s = createSetupStore({ setup: START });
    s.change(becomes(NOODLED));
    expect(s.setup()).toEqual(NOODLED);
  });
});
