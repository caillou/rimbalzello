// Help on the pad. On touch screens `// help` opens a hint box over the lower
// part of the pad; on first launch a one-line gesture hint sits inside the
// pad until the first pad move, once per device. Neither takes touches, so
// the pad stays playable under them. Laptop help is the keycap hints
// (Keycap.tsx), which App shows instead.

import { createSignal, For, onCleanup, type Accessor, type JSX } from 'solid-js';
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
function HintLines(props: { lines: readonly (readonly JSX.Element[])[] }) {
  return (
    <For each={props.lines}>
      {(items) => (
        <p>
          <For each={items}>
            {(item, i) => (
              <>
                {i() > 0 && ' '}
                <span class="hint-item">
                  {item}
                  {i() < items.length - 1 && ' ·'}
                </span>
              </>
            )}
          </For>
        </p>
      )}
    </For>
  );
}

/**
 * The help box: gestures, then anchor, mutes, loop and sound. The mutes item
 * names the step display's labels as they show; `tap a drum name: mute` would
 * take a fifth line on a 393 px phone.
 */
function helpLines(fullNames: boolean) {
  return [
    ['tap, drag: move', 'two-finger tap: undo'],
    ['double-tap + slide: fine', fullNames ? 'tap a drum name: mute' : 'tap bd sd hh: mute'],
    ['anchor: set, noodle, return on bar'],
    [
      'loop: hold a size',
      <>
        <span class="glyph-upright">→</span> sound: shape the drums
      </>,
    ],
  ];
}

export interface HelpBoxProps {
  /** Whether the step display writes the drums' names out (drum-names.ts). */
  fullNames: boolean;
}

export function HelpBox(props: HelpBoxProps) {
  return (
    <div class="help-box" role="note" aria-label="gestures and controls">
      <HintLines lines={helpLines(props.fullNames)} />
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
