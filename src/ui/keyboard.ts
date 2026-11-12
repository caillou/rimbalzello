// Keyboard bindings: key down/up events in, intents out. Pure apart from the
// hint visibility, which is remembered on the device.
//
// Keys bind by physical position (`event.code`), designed for the US layout,
// so they sit in the same place on a Swiss or AZERTY keyboard. Key repeat is
// ignored except for tempo. Wiring the intents to the app happens elsewhere.

import type { Drum } from '../engine/setup';
import { tunables } from '../engine/tunables';

/** Loop sizes 1/4, 1/8, 1/16, 1/32 as lengths in steps. */
export type LoopSteps = 8 | 4 | 2 | 1;

export type KeyIntent =
  | { type: 'play-stop' }
  /** One bpm step down or up. */
  | { type: 'tempo'; direction: -1 | 1 }
  /** Loop this many steps; sent again whenever the held size changes. */
  | { type: 'loop'; steps: LoopSteps }
  /** No loop key is held any more: the pattern slips. */
  | { type: 'loop-end' }
  | { type: 'set-anchor' }
  /** Return to the anchor on the next bar. */
  | { type: 'return' }
  | { type: 'toggle-mute'; drum: Drum }
  /** Pad undo / redo. */
  | { type: 'undo' }
  /** A run of arrow nudges starts: one pad move for pad undo. */
  | { type: 'begin' }
  /** Move the pad position by this many bytes; `dy > 0` is toward the top of the pad. */
  | { type: 'nudge'; dx: number; dy: number }
  /** The run of arrow nudges is over. */
  | { type: 'commit' }
  | { type: 'hints'; shown: boolean };

/** The parts of a KeyboardEvent the bindings read. A real KeyboardEvent fits. */
export interface KeyEventLike {
  code: string;
  repeat?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Milliseconds, on the same clock as `tick`. */
  timeStamp?: number;
  /** Where the event came from; text inputs are left alone. */
  target?: unknown;
}

export type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface KeyboardOptions {
  /** Where hint visibility is remembered. Defaults to localStorage. */
  storage?: HintStorage;
}

export interface Keyboard {
  keyDown(event: KeyEventLike): KeyIntent[];
  keyUp(event: KeyEventLike): KeyIntent[];
  /** Call with the current time (e.g. every animation frame) so a run of nudges ends after the idle gap. */
  tick(now: number): KeyIntent[];
  /** The window lost focus: every held key counts as released and an open nudge run ends. */
  releaseAll(): KeyIntent[];
  hintsShown(): boolean;
  /** Toggle the keycap hints, as `?`, `h` or `// help` do. Returns the new visibility. */
  toggleHints(): boolean;
}

const HINTS_KEY = 'rimbalzello.hints';

const LOOP_KEYS = new Map<string, LoopSteps>([
  ['Digit1', 8],
  ['Digit2', 4],
  ['Digit3', 2],
  ['Digit4', 1],
]);

const MUTE_KEYS = new Map<string, Drum>([
  ['KeyQ', 'bd'],
  ['KeyW', 'sd'],
  ['KeyE', 'hh'],
]);

/** Unit direction per arrow; up is toward the top of the pad. */
const ARROWS = new Map<string, [number, number]>([
  ['ArrowLeft', [-1, 0]],
  ['ArrowRight', [1, 0]],
  ['ArrowUp', [0, 1]],
  ['ArrowDown', [0, -1]],
]);

/** Input types that do not take typed text, so key events from them still play. */
const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

function isTextEntry(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const element = target as { tagName?: string; type?: string; isContentEditable?: boolean };
  if (element.isContentEditable === true) return true;
  if (element.tagName === 'TEXTAREA') return true;
  return element.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(element.type ?? 'text');
}

function deviceStorage(): HintStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function createKeyboard({ storage = deviceStorage() }: KeyboardOptions = {}): Keyboard {
  const tuning = tunables.keyboard;
  let hints = readHints();
  /** Held loop keys, most recently pressed last. */
  const heldLoopKeys: string[] = [];
  const heldArrows = new Set<string>();
  let runOpen = false;
  let lastArrowAt = 0;

  function readHints(): boolean {
    try {
      return storage?.getItem(HINTS_KEY) === '1';
    } catch {
      return false;
    }
  }

  function toggleHints(): boolean {
    hints = !hints;
    try {
      storage?.setItem(HINTS_KEY, hints ? '1' : '0');
    } catch {
      // Not remembered on this device; the toggle still works for this visit.
    }
    return hints;
  }

  function activeLoop(): KeyIntent {
    const top = heldLoopKeys.at(-1);
    return top === undefined ? { type: 'loop-end' } : { type: 'loop', steps: LOOP_KEYS.get(top)! };
  }

  function runIsOver(now: number): boolean {
    return runOpen && heldArrows.size === 0 && now - lastArrowAt >= tuning.nudgeRunGap;
  }

  function commitRun(): KeyIntent[] {
    if (!runOpen) return [];
    runOpen = false;
    return [{ type: 'commit' }];
  }

  function nudge(event: KeyEventLike, [x, y]: [number, number]): KeyIntent[] {
    const now = event.timeStamp ?? 0;
    const intents = runIsOver(now) ? commitRun() : [];
    if (!runOpen) {
      runOpen = true;
      intents.push({ type: 'begin' });
    }
    const step = event.shiftKey ? tuning.fineNudgeStep : tuning.nudgeStep;
    intents.push({ type: 'nudge', dx: x * step, dy: y * step });
    heldArrows.add(event.code);
    lastArrowAt = now;
    return intents;
  }

  function keyDown(event: KeyEventLike): KeyIntent[] {
    if (event.ctrlKey || event.metaKey || event.altKey) return [];
    if (isTextEntry(event.target)) return [];
    const { code } = event;

    if (code === 'Comma') return [{ type: 'tempo', direction: -1 }];
    if (code === 'Period') return [{ type: 'tempo', direction: 1 }];
    if (event.repeat) return [];

    if (LOOP_KEYS.has(code)) {
      const before = heldLoopKeys.at(-1);
      const index = heldLoopKeys.indexOf(code);
      if (index !== -1) heldLoopKeys.splice(index, 1);
      heldLoopKeys.push(code);
      return before === code ? [] : [activeLoop()];
    }
    const mute = MUTE_KEYS.get(code);
    if (mute) return [{ type: 'toggle-mute', drum: mute }];
    const arrow = ARROWS.get(code);
    if (arrow) return nudge(event, arrow);

    switch (code) {
      case 'Space':
        return [{ type: 'play-stop' }];
      case 'KeyA':
        return [{ type: 'set-anchor' }];
      case 'KeyR':
        return [{ type: 'return' }];
      case 'KeyZ':
        // Close an open run first, so undo flips back past the whole run.
        return [...commitRun(), { type: 'undo' }];
      case 'KeyH':
        return [{ type: 'hints', shown: toggleHints() }];
      case 'Slash':
        return event.shiftKey ? [{ type: 'hints', shown: toggleHints() }] : [];
      default:
        return [];
    }
  }

  function keyUp(event: KeyEventLike): KeyIntent[] {
    const { code } = event;
    const index = heldLoopKeys.indexOf(code);
    if (index !== -1) {
      const wasActive = index === heldLoopKeys.length - 1;
      heldLoopKeys.splice(index, 1);
      return wasActive ? [activeLoop()] : [];
    }
    if (heldArrows.delete(code)) lastArrowAt = event.timeStamp ?? lastArrowAt;
    return [];
  }

  function tick(now: number): KeyIntent[] {
    return runIsOver(now) ? commitRun() : [];
  }

  function releaseAll(): KeyIntent[] {
    const intents: KeyIntent[] = heldLoopKeys.length > 0 ? [{ type: 'loop-end' }] : [];
    heldLoopKeys.length = 0;
    heldArrows.clear();
    return [...intents, ...commitRun()];
  }

  return { keyDown, keyUp, tick, releaseAll, hintsShown: () => hints, toggleHints };
}
