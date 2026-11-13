// Help on the pad. On touch screens `// help` opens a hint box over the lower
// part of the pad; on first launch a one-line gesture hint sits inside the
// pad until the first pad move, once per device. Neither takes touches, so
// the pad stays playable under them. Laptop help is the keycap hints
// (Keycap.tsx), which App shows instead.

import { createSignal, For, onCleanup, type Accessor } from 'solid-js';
import './help.css';

const TOUCH_SCREEN = '(pointer: coarse)';

/** A touch screen: the primary pointer is a finger, so `// help` opens the help box. */
export function touchScreen(): boolean {
  return matchMedia(TOUCH_SCREEN).matches;
}

/** `touchScreen()` as a signal, following a change of the primary pointer. */
export function createTouchScreen(): Accessor<boolean> {
  const query = matchMedia(TOUCH_SCREEN);
  const [touch, setTouch] = createSignal(query.matches);
  const change = () => setTouch(query.matches);
  query.addEventListener('change', change);
  onCleanup(() => query.removeEventListener('change', change));
  return touch;
}

/**
 * Hint lines: one `<p>` per line, its items joined by ` · `. Each item
 * stays whole, so on a narrow pad a line wraps between items.
 */
function HintLines(props: { lines: readonly (readonly string[])[] }) {
  return (
    <For each={props.lines}>
      {(items) => (
        <p>
          <For each={items}>
            {(item, i) => (
              <>
                {i() > 0 && ' '}
                <span class="hint-item">{i() < items.length - 1 ? `${item} ·` : item}</span>
              </>
            )}
          </For>
        </p>
      )}
    </For>
  );
}

/** The help box: gestures, then anchor, mutes, loop and sound. */
const HELP_LINES = [
  ['tap, drag: move', 'two-finger tap: undo'],
  ['double-tap + slide: fine', 'tap bd sd hh: mute'],
  ['anchor: set, noodle, return on bar'],
  ['loop: hold a size', '→ sound: shape the drums'],
] as const;

export function HelpBox() {
  return (
    <div class="help-box" role="note" aria-label="gestures and controls">
      <HintLines lines={HELP_LINES} />
    </div>
  );
}

type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

const FIRST_LAUNCH_HINT_KEY = 'rimbalzello.firstLaunchHint';

/** localStorage, or undefined where reading it throws (blocked storage). */
function deviceStorage(): HintStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export interface FirstLaunchHintState {
  shown: Accessor<boolean>;
  /** The first pad move: the hint goes away and stays away on this device. */
  dismiss(): void;
}

export function createFirstLaunchHint(storage = deviceStorage()): FirstLaunchHintState {
  const [shown, setShown] = createSignal(!seen());

  function seen(): boolean {
    try {
      return storage?.getItem(FIRST_LAUNCH_HINT_KEY) === 'seen';
    } catch {
      return false;
    }
  }

  function dismiss() {
    if (!shown()) return;
    setShown(false);
    try {
      storage?.setItem(FIRST_LAUNCH_HINT_KEY, 'seen');
    } catch {
      // Not remembered on this device; it comes back on the next visit.
    }
  }

  return { shown, dismiss };
}

export function FirstLaunchHint() {
  return (
    <div class="first-launch-hint">
      <HintLines lines={[['tap', 'drag', 'two-finger tap undo', 'double-tap+slide fine']]} />
    </div>
  );
}
