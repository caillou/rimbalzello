// Setup store: the state the UI and the transport subscribe to. It holds the
// setup, the mutes, the anchor and the pad's undo slot, and remembers the
// setup on the device. No UI and no framework: subscribers are callbacks.
//
// Everything the store hands out is frozen. Change state through its methods,
// which notify the subscribers.

import {
  BPM_RANGE,
  BYTE_RANGE,
  SWING_RANGE,
  defaultSetup,
  type Drum,
  type Range,
  type Setup,
} from './setup';
import { decodeSetup, encodeSetup } from './url-codec';

type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

/** The setup as the store hands it out. */
export type SetupSnapshot = DeepReadonly<Setup>;

/** Which drums are silenced. Performance state, not part of the setup. */
export type Mutes = Readonly<Record<Drum, boolean>>;

/** Where the setup is remembered on the device. localStorage fits. */
export type SetupStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface SetupStoreOptions {
  /**
   * The setup the session starts with, from the URL hash or device memory.
   * It is the anchor until the player sets one. Defaults to the default setup.
   */
  setup?: Setup;
  /** Where the setup is remembered. Defaults to localStorage. */
  storage?: SetupStorage;
}

export interface SetupStore {
  setup(): SetupSnapshot;
  mutes(): Mutes;
  /** Calls `listener` after every change; returns the function that stops it. */
  subscribe(listener: () => void): () => void;

  /**
   * Change any part of the setup; every field is then rounded and clamped
   * into its range. This is not a pad move: pad undo ignores it.
   */
  change(edit: (setup: Setup) => void): void;
  toggleMute(drum: Drum): void;

  /** Set anchor: snapshot the setup minus tempo. */
  setAnchor(): void;
  /** The setup a return restores: the anchor, with the current tempo. */
  returnSetup(): SetupSnapshot;
  /**
   * A return lands: the anchor replaces pattern, sound, swing, drift and
   * drive. Tempo and mutes stay. When it lands is the transport's job.
   */
  applyAnchor(): void;

  // Pad moves, for pad undo. A pad move opens with `padBegin` and closes
  // with one `padCommit` (record it) or `padRevert` (go back to where it
  // began, record nothing). `padUndo` flip/flops whole committed moves.
  // Calls out of that order do no harm: a second `padBegin` keeps the first
  // start, `padCommit` and `padRevert` without an open move do nothing,
  // `padTo` without one moves without recording, and `padUndo` inside one is
  // ignored.
  padBegin(): void;
  /** Put the pad position here, in bytes. Clamped to the pad and rounded. */
  padTo(x: number, y: number): void;
  padCommit(): void;
  padRevert(): void;
  /** Pad undo: swap the position with the undo slot. Again to redo. */
  padUndo(): void;
}

interface Position {
  readonly x: number;
  readonly y: number;
}

const STORAGE_KEY = 'rimbalzello.setup';

/**
 * The setup this device remembers from the last visit, or undefined when
 * there is none or storage is unavailable. Whether it or the URL hash wins
 * is the caller's choice.
 */
export function rememberedSetup(storage = deviceStorage()): Setup | undefined {
  try {
    // Stored in the URL hash format, so old entries decode like old links.
    const hash = storage?.getItem(STORAGE_KEY);
    return hash == null ? undefined : decodeSetup(hash);
  } catch {
    return undefined;
  }
}

export function createSetupStore({
  setup: initial = defaultSetup(),
  storage = deviceStorage(),
}: SetupStoreOptions = {}): SetupStore {
  let setup = frozen(inRange(initial));
  let mutes: Mutes = frozen({ bd: false, sd: false, hh: false });
  /** The setup at the last set anchor; its tempo is never restored. */
  let anchor = setup;
  /** Where the open pad move began; null while no move is open. */
  let moveStart: Position | null = null;
  /** The position the next pad undo goes to; null before the first pad move. */
  let undoSlot: Position | null = null;
  const listeners = new Set<() => void>();

  remember();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function remember(): void {
    try {
      storage?.setItem(STORAGE_KEY, encodeSetup(setup));
    } catch {
      // Not remembered on this device; the session goes on.
    }
  }

  function replace(next: Setup): void {
    setup = frozen(inRange(next));
    remember();
    notify();
  }

  function position(): Position {
    return { x: setup.x, y: setup.y };
  }

  function moveTo(to: Position): void {
    if (to.x === setup.x && to.y === setup.y) return;
    replace({ ...setup, ...to });
  }

  function returnSetup(): SetupSnapshot {
    return frozen({ ...anchor, bpm: setup.bpm });
  }

  return {
    setup: () => setup,
    mutes: () => mutes,

    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    change(edit) {
      const draft: Setup = structuredClone(setup);
      edit(draft);
      replace(draft);
    },

    toggleMute(drum) {
      mutes = frozen({ ...mutes, [drum]: !mutes[drum] });
      notify();
    },

    setAnchor() {
      // The setup is frozen, so holding it is a snapshot.
      anchor = setup;
      notify();
    },

    returnSetup,

    applyAnchor() {
      replace(returnSetup());
    },

    padBegin() {
      moveStart ??= position();
    },

    padTo(x, y) {
      moveTo({ x: fit(x, BYTE_RANGE), y: fit(y, BYTE_RANGE) });
    },

    padCommit() {
      if (moveStart === null) return;
      // A move that ends where it began is not a move: keep the slot.
      if (moveStart.x !== setup.x || moveStart.y !== setup.y) undoSlot = moveStart;
      moveStart = null;
    },

    padRevert() {
      if (moveStart === null) return;
      const start = moveStart;
      moveStart = null;
      moveTo(start);
    },

    padUndo() {
      if (moveStart !== null || undoSlot === null) return;
      const back = undoSlot;
      undoSlot = position();
      moveTo(back);
    },
  };
}

/**
 * A copy of the setup with every field rounded into its range, so tempo
 * and swing never leave what the URL format can hold.
 */
function inRange(setup: Setup): Setup {
  const { bpm, swing, ...bytes } = setup;
  return { ...inByteRange(bytes), bpm: fit(bpm, BPM_RANGE), swing: fit(swing, SWING_RANGE) };
}

function inByteRange<T>(value: T): T {
  if (typeof value === 'number') return fit(value, BYTE_RANGE) as T;
  const entries = Object.entries(value as object).map(([key, inner]) => [key, inByteRange(inner)]);
  return Object.fromEntries(entries) as T;
}

function fit(value: number, range: Range): number {
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

function frozen<T extends object>(value: T): DeepReadonly<T> {
  for (const inner of Object.values(value)) {
    if (typeof inner === 'object' && inner !== null) frozen(inner);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

/** localStorage, or undefined where reading it throws (blocked storage). */
function deviceStorage(): SetupStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
