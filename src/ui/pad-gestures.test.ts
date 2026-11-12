import { describe, expect, test } from 'vitest';
import { tunables } from '../engine/tunables';
import { createPadGestures, type PadIntent, type PadPoint, type PadPointerEvent } from './pad-gestures';

const { movementThreshold, doubleTapWindow, doubleTapDistance, twoFingerWindow, fineSpeed } =
  tunables.padGestures;

/** Under the movement threshold: a finger rolling during a tap. */
const JITTER = movementThreshold / 2;
/** Past the movement threshold. */
const SLIDE = movementThreshold * 4;

function event(
  type: PadPointerEvent['type'],
  time: number,
  [x, y]: [number, number],
  pointerId = 1,
): PadPointerEvent {
  return { type, pointerId, time, x, y };
}

const down = (time: number, at: [number, number], id?: number) => event('down', time, at, id);
const move = (time: number, at: [number, number], id?: number) => event('move', time, at, id);
const up = (time: number, at: [number, number], id?: number) => event('up', time, at, id);
const cancel = (time: number, at: [number, number], id?: number) => event('cancel', time, at, id);

function gestures(position: PadPoint = { x: 0, y: 0 }) {
  return createPadGestures({ position: () => position });
}

function types(intents: PadIntent[]): string[] {
  return intents.map((intent) => intent.type);
}

describe('tap', () => {
  test('jumps on touch-down, before any lift, and commits one pad move on lift', () => {
    const pad = gestures();
    expect(pad.handle(down(0, [100, 120]))).toEqual([
      { type: 'begin' },
      { type: 'jump', x: 100, y: 120 },
    ]);
    expect(pad.handle(move(30, [100 + JITTER, 120]))).toEqual([]);
    expect(pad.handle(up(60, [100 + JITTER, 120]))).toEqual([{ type: 'commit' }]);
  });

  test('quick taps on different spots, or on one spot after the double-tap window, each jump at once', () => {
    const pad = gestures();
    pad.handle(down(0, [100, 100]));
    pad.handle(up(50, [100, 100]));

    const far = 100 + doubleTapDistance * 2;
    expect(pad.handle(down(100, [far, 100]))).toContainEqual({ type: 'jump', x: far, y: 100 });
    pad.handle(up(150, [far, 100]));

    const late = 150 + doubleTapWindow + 1;
    expect(pad.handle(down(late, [far, 100]))).toContainEqual({ type: 'jump', x: far, y: 100 });
  });
});

describe('drag', () => {
  test('follows the finger past the threshold and commits the whole drag as one pad move', () => {
    const pad = gestures();
    const intents = [
      pad.handle(down(0, [100, 100])),
      pad.handle(move(20, [100 + JITTER, 100])),
      pad.handle(move(40, [100 + SLIDE, 100])),
      pad.handle(move(60, [100 + SLIDE, 100 + SLIDE])),
      pad.handle(up(80, [100 + SLIDE, 100 + SLIDE])),
    ];
    expect(intents).toEqual([
      [{ type: 'begin' }, { type: 'jump', x: 100, y: 100 }],
      [],
      [{ type: 'follow', x: 100 + SLIDE, y: 100 }],
      [{ type: 'follow', x: 100 + SLIDE, y: 100 + SLIDE }],
      [{ type: 'commit' }],
    ]);
  });

  test('a second finger landing mid-drag is ignored', () => {
    const pad = gestures();
    pad.handle(down(0, [100, 100]));
    pad.handle(move(20, [100 + SLIDE, 100]));
    expect(pad.handle(down(40, [200, 200], 2))).toEqual([]);
    expect(pad.handle(up(60, [200, 200], 2))).toEqual([]);
    expect(pad.handle(up(80, [100 + SLIDE, 100]))).toEqual([{ type: 'commit' }]);
  });
});

describe('two-finger tap', () => {
  test('a second finger within the window reverts the first, and lifting both undoes', () => {
    const pad = gestures();
    pad.handle(down(0, [100, 100]));
    expect(pad.handle(down(twoFingerWindow, [160, 100], 2))).toEqual([{ type: 'revert' }]);
    expect(pad.handle(move(twoFingerWindow + 20, [100 + JITTER, 100]))).toEqual([]);
    expect(pad.handle(up(twoFingerWindow + 40, [100 + JITTER, 100]))).toEqual([]);
    expect(pad.handle(up(twoFingerWindow + 60, [160, 100], 2))).toEqual([{ type: 'undo' }]);
  });

  test('a second finger after the window leaves the tap standing', () => {
    const pad = gestures();
    pad.handle(down(0, [100, 100]));
    expect(pad.handle(down(twoFingerWindow + 1, [160, 100], 2))).toEqual([]);
    expect(pad.handle(up(twoFingerWindow + 20, [160, 100], 2))).toEqual([]);
    expect(pad.handle(up(twoFingerWindow + 40, [100, 100]))).toEqual([{ type: 'commit' }]);
  });

  test('moving two fingers past the threshold cancels: no undo and no committed move', () => {
    const pad = gestures();
    const intents = [
      pad.handle(down(0, [100, 100])),
      pad.handle(down(20, [160, 100], 2)),
      pad.handle(move(40, [160 + SLIDE, 100], 2)),
      pad.handle(move(60, [100 + SLIDE, 100])),
      pad.handle(up(80, [100 + SLIDE, 100])),
      pad.handle(up(100, [160 + SLIDE, 100], 2)),
    ].flat();
    expect(types(intents)).toEqual(['begin', 'jump', 'revert']);

    // Idle again once all fingers lift: the next touch is an ordinary tap.
    expect(pad.handle(down(1000, [50, 50]))).toEqual([
      { type: 'begin' },
      { type: 'jump', x: 50, y: 50 },
    ]);
  });

  test('right after a tap, near it, still undoes', () => {
    const pad = gestures();
    pad.handle(down(0, [100, 100]));
    pad.handle(up(50, [100, 100]));
    const intents = [
      pad.handle(down(100, [100 + JITTER, 100])),
      pad.handle(down(120, [160, 100], 2)),
      pad.handle(up(160, [100 + JITTER, 100])),
      pad.handle(up(170, [160, 100], 2)),
    ].flat();
    expect(intents).toEqual([{ type: 'undo' }]);
  });
});

describe('double-tap and slide', () => {
  test('fine adjusts at the fine speed, relative to the current position, as one pad move', () => {
    const position = { x: 40, y: 200 };
    const pad = gestures(position);
    pad.handle(down(0, [100, 100]));
    pad.handle(up(50, [100, 100]));

    expect(pad.handle(down(50 + doubleTapWindow, [100, 100]))).toEqual([]);
    expect(pad.handle(move(400, [100 + JITTER, 100]))).toEqual([]);
    expect(pad.handle(move(420, [100 + SLIDE, 100]))).toEqual([
      { type: 'begin' },
      { type: 'fine', x: position.x + SLIDE * fineSpeed, y: position.y },
    ]);
    expect(pad.handle(move(440, [100 + SLIDE, 100 - 2 * SLIDE]))).toEqual([
      { type: 'fine', x: position.x + SLIDE * fineSpeed, y: position.y - 2 * SLIDE * fineSpeed },
    ]);
    expect(pad.handle(up(460, [100 + SLIDE, 100 - 2 * SLIDE]))).toEqual([{ type: 'commit' }]);
  });

  test('without movement acts as a tap on lift', () => {
    const pad = gestures();
    pad.handle(down(0, [100, 100]));
    pad.handle(up(50, [100, 100]));

    const near = 100 + doubleTapDistance;
    expect(pad.handle(down(100, [near, 100]))).toEqual([]);
    expect(pad.handle(up(150, [near, 100]))).toEqual([
      { type: 'begin' },
      { type: 'jump', x: near, y: 100 },
      { type: 'commit' },
    ]);
  });
});

describe('cancelled pointers', () => {
  // The setup store needs every begun move to end, and a cancel is not a tap.
  test('close the pad move they began and never undo', () => {
    const tap = gestures();
    tap.handle(down(0, [100, 100]));
    expect(tap.handle(cancel(20, [100, 100]))).toEqual([{ type: 'commit' }]);

    const twoFingers = gestures();
    twoFingers.handle(down(0, [100, 100]));
    twoFingers.handle(down(20, [160, 100], 2));
    expect(twoFingers.handle(up(40, [100, 100]))).toEqual([]);
    expect(twoFingers.handle(cancel(60, [160, 100], 2))).toEqual([]);
  });
});
