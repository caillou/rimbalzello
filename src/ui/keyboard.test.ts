import { describe, expect, test } from 'vitest';
import { tunables } from '../engine/tunables';
import { createKeyboard, type HintStorage, type KeyEventLike, type KeyIntent } from './keyboard';

const { nudgeStep: step, fineNudgeStep: fine, nudgeRunGap: gap } = tunables.keyboard;

function memoryStorage(): HintStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

function keyboard(storage: HintStorage = memoryStorage()) {
  return createKeyboard({ storage });
}

/** A key event as the browser sends it; `key` is what the layout prints, which the bindings must ignore. */
function key(code: string, extra: Partial<KeyEventLike> & { key?: string } = {}): KeyEventLike {
  return { code, repeat: false, shiftKey: false, timeStamp: 0, ...extra };
}

describe('bindings by physical key', () => {
  // [code, key on US, Swiss German, French AZERTY, shift, intents]
  const bindings: [string, string, string, string, boolean, KeyIntent[]][] = [
    ['Space', ' ', ' ', ' ', false, [{ type: 'play-stop' }]],
    ['Comma', ',', ',', ';', false, [{ type: 'tempo', direction: -1 }]],
    ['Period', '.', '.', ':', false, [{ type: 'tempo', direction: 1 }]],
    ['Digit1', '1', '1', '&', false, [{ type: 'loop', steps: 8 }]],
    ['Digit2', '2', '2', 'é', false, [{ type: 'loop', steps: 4 }]],
    ['Digit3', '3', '3', '"', false, [{ type: 'loop', steps: 2 }]],
    ['Digit4', '4', '4', "'", false, [{ type: 'loop', steps: 1 }]],
    ['KeyA', 'a', 'a', 'q', false, [{ type: 'set-anchor' }]],
    ['KeyR', 'r', 'r', 'r', false, [{ type: 'return' }]],
    ['KeyQ', 'q', 'q', 'a', false, [{ type: 'toggle-mute', drum: 'bd' }]],
    ['KeyW', 'w', 'w', 'z', false, [{ type: 'toggle-mute', drum: 'sd' }]],
    ['KeyE', 'e', 'e', 'e', false, [{ type: 'toggle-mute', drum: 'hh' }]],
    ['KeyZ', 'z', 'y', 'w', false, [{ type: 'undo' }]],
    ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', false, [{ type: 'begin' }, { type: 'nudge', dx: -step, dy: 0 }]],
    ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', false, [{ type: 'begin' }, { type: 'nudge', dx: step, dy: 0 }]],
    ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', false, [{ type: 'begin' }, { type: 'nudge', dx: 0, dy: step }]],
    ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', false, [{ type: 'begin' }, { type: 'nudge', dx: 0, dy: -step }]],
    ['Slash', '?', '_', '§', true, [{ type: 'hints', shown: true }]],
    ['KeyH', 'h', 'h', 'h', false, [{ type: 'hints', shown: true }]],
  ];

  test.each(bindings)('%s acts the same on US, Swiss and AZERTY keyboards', (code, us, swiss, azerty, shiftKey, intents) => {
    for (const printed of [us, swiss, azerty]) {
      expect(keyboard().keyDown(key(code, { key: printed, shiftKey })), printed).toEqual(intents);
    }
  });

  test('browser shortcuts such as cmd+1 or ctrl+r are left alone', () => {
    const kb = keyboard();
    expect(kb.keyDown(key('Digit1', { metaKey: true }))).toEqual([]);
    expect(kb.keyDown(key('KeyR', { ctrlKey: true }))).toEqual([]);
    expect(kb.keyUp(key('Digit1'))).toEqual([]);
  });

  test('typing in a text input plays nothing', () => {
    const input = { tagName: 'INPUT', type: 'text' };
    expect(keyboard().keyDown(key('KeyQ', { target: input }))).toEqual([]);
    expect(keyboard().keyDown(key('Space', { target: input }))).toEqual([]);
  });
});

describe('key repeat', () => {
  test('holding , or . keeps changing the tempo', () => {
    const kb = keyboard();
    const intents = [false, true, true, true].flatMap((repeat) => kb.keyDown(key('Period', { repeat })));
    expect(intents).toEqual(Array(4).fill({ type: 'tempo', direction: 1 }));
    expect(kb.keyDown(key('Comma', { repeat: true }))).toEqual([{ type: 'tempo', direction: -1 }]);
  });

  test.each(['Space', 'Digit1', 'Digit4', 'KeyA', 'KeyR', 'KeyQ', 'KeyW', 'KeyE', 'KeyZ', 'ArrowLeft', 'ArrowUp', 'KeyH'])(
    'holding %s acts once',
    (code) => {
      const kb = keyboard();
      kb.keyDown(key(code));
      expect(kb.keyDown(key(code, { repeat: true }))).toEqual([]);
      expect(kb.keyDown(key(code, { repeat: true }))).toEqual([]);
    },
  );
});

describe('loop keys', () => {
  test('the most recent loop key wins and releasing it falls back to the one still held', () => {
    const kb = keyboard();
    expect(kb.keyDown(key('Digit1'))).toEqual([{ type: 'loop', steps: 8 }]);
    expect(kb.keyDown(key('Digit3'))).toEqual([{ type: 'loop', steps: 2 }]);
    expect(kb.keyUp(key('Digit3'))).toEqual([{ type: 'loop', steps: 8 }]);
    expect(kb.keyUp(key('Digit1'))).toEqual([{ type: 'loop-end' }]);
  });

  test('releasing an older loop key keeps the newer one looping', () => {
    const kb = keyboard();
    kb.keyDown(key('Digit1'));
    kb.keyDown(key('Digit3'));
    expect(kb.keyUp(key('Digit1'))).toEqual([]);
    expect(kb.keyUp(key('Digit3'))).toEqual([{ type: 'loop-end' }]);
  });

  test('switching away from the window while holding a loop key ends the loop', () => {
    const kb = keyboard();
    kb.keyDown(key('Digit2'));
    expect(kb.releaseAll()).toEqual([{ type: 'loop-end' }]);
    expect(kb.keyUp(key('Digit2'))).toEqual([]);
  });
});

describe('arrow nudges', () => {
  /** Press and release an arrow at `at` ms. */
  function press(kb: ReturnType<typeof keyboard>, code: string, at: number, shiftKey = false): KeyIntent[] {
    return [...kb.keyDown(key(code, { timeStamp: at, shiftKey })), ...kb.keyUp(key(code, { timeStamp: at + 1 }))];
  }

  test('three presses in a run are one pad move', () => {
    const kb = keyboard();
    const lastUp = gap + 1;
    const intents = [
      ...press(kb, 'ArrowRight', 0),
      ...press(kb, 'ArrowRight', gap / 2),
      ...press(kb, 'ArrowUp', gap),
      ...kb.tick(lastUp + gap - 1),
      ...kb.tick(lastUp + gap),
    ];
    expect(intents).toEqual([
      { type: 'begin' },
      { type: 'nudge', dx: step, dy: 0 },
      { type: 'nudge', dx: step, dy: 0 },
      { type: 'nudge', dx: 0, dy: step },
      { type: 'commit' },
    ]);
  });

  test('an arrow held past the idle gap keeps the run open', () => {
    const kb = keyboard();
    kb.keyDown(key('ArrowLeft', { timeStamp: 0 }));
    expect(kb.tick(4 * gap)).toEqual([]);
    kb.keyUp(key('ArrowLeft', { timeStamp: 4 * gap }));
    expect(kb.tick(5 * gap)).toEqual([{ type: 'commit' }]);
  });

  test('a press after the idle gap starts a new pad move', () => {
    const kb = keyboard();
    press(kb, 'ArrowDown', 0);
    expect(press(kb, 'ArrowDown', 1 + gap)).toEqual([
      { type: 'commit' },
      { type: 'begin' },
      { type: 'nudge', dx: 0, dy: -step },
    ]);
  });

  test('z right after a run commits the run first, so undo goes back before it', () => {
    const kb = keyboard();
    press(kb, 'ArrowRight', 0);
    press(kb, 'ArrowRight', gap / 2);
    expect(kb.keyDown(key('KeyZ', { timeStamp: gap / 2 + 2 }))).toEqual([{ type: 'commit' }, { type: 'undo' }]);
    expect(kb.tick(10 * gap)).toEqual([]);
  });

  test('shift + arrow nudges by the fine step', () => {
    const kb = keyboard();
    expect(press(kb, 'ArrowLeft', 0, true)).toEqual([{ type: 'begin' }, { type: 'nudge', dx: -fine, dy: 0 }]);
    expect(press(kb, 'ArrowUp', gap / 2, true)).toEqual([{ type: 'nudge', dx: 0, dy: fine }]);
  });
});

describe('keycap hints', () => {
  test('hidden by default, and the choice is remembered on the device', () => {
    const storage = memoryStorage();
    expect(keyboard(storage).hintsShown()).toBe(false);

    keyboard(storage).keyDown(key('Slash', { shiftKey: true }));
    expect(keyboard(storage).hintsShown()).toBe(true);

    const kb = keyboard(storage);
    expect(kb.keyDown(key('KeyH'))).toEqual([{ type: 'hints', shown: false }]);
    expect(keyboard(storage).hintsShown()).toBe(false);

    keyboard(storage).toggleHints();
    expect(keyboard(storage).hintsShown()).toBe(true);
  });

  test('a throwing localStorage still lets the hints toggle', () => {
    const broken: HintStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const kb = keyboard(broken);
    expect(kb.hintsShown()).toBe(false);
    expect(kb.keyDown(key('KeyH'))).toEqual([{ type: 'hints', shown: true }]);
    expect(kb.hintsShown()).toBe(true);
  });
});
