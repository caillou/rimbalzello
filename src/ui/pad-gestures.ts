// Pad gesture interpreter: timestamped pointer events on the pad in, intents
// out. It owns all gesture timing in milliseconds and knows nothing about
// steps, audio or the DOM. The state machine follows the table in design.md,
// "Pad interaction".
//
// Every pad move opens with `begin` and closes with exactly one `commit`
// (record it for pad undo) or `revert` (restore where it began, record
// nothing). `undo` never falls inside an open move.

import { tunables } from '../engine/tunables';

/** A point on the pad in CSS pixels, relative to the pad's top-left corner. */
export interface PadPoint {
  readonly x: number;
  readonly y: number;
}

export interface PadPointerEvent extends PadPoint {
  readonly type: 'down' | 'move' | 'up' | 'cancel';
  readonly pointerId: number;
  /** Milliseconds on any monotonic clock, such as `PointerEvent.timeStamp`. */
  readonly time: number;
}

export type PadIntent =
  /** A pad move starts here. */
  | { readonly type: 'begin' }
  /** Glide to this absolute point, starting at once. */
  | ({ readonly type: 'jump' } & PadPoint)
  /** Follow the finger to this point during a drag. */
  | ({ readonly type: 'follow' } & PadPoint)
  /** Fine adjust: go to this point, worked out relative to where the fine adjust began. */
  | ({ readonly type: 'fine' } & PadPoint)
  /** The pad move is done; record it for pad undo. */
  | { readonly type: 'commit' }
  /** Drop the pad move: go back to where it began and record nothing. */
  | { readonly type: 'revert' }
  /** Pad undo: flip/flop with the undo slot. */
  | { readonly type: 'undo' };

export interface PadGestureOptions {
  /** The current pad position in pad CSS px; read when a fine adjust starts. */
  readonly position: () => PadPoint;
}

export interface PadGestures {
  /** Feed one pointer event; returns the intents it causes, in order. */
  handle(event: PadPointerEvent): PadIntent[];
}

interface Finger {
  readonly id: number;
  readonly down: PadPoint;
  readonly time: number;
}

type State =
  | { readonly name: 'idle' }
  | { readonly name: 'touching'; readonly finger: Finger }
  | { readonly name: 'dragging'; readonly finger: Finger }
  | { readonly name: 'second touch'; readonly finger: Finger }
  | { readonly name: 'fine'; readonly finger: Finger; readonly from: PadPoint }
  | {
      readonly name: 'two fingers';
      /** Touch-down points of the two fingers that are still down. */
      readonly down: Map<number, PadPoint>;
      cancelled: boolean;
    };

const IDLE: State = { name: 'idle' };

export function createPadGestures(options: PadGestureOptions): PadGestures {
  const tuning = tunables.padGestures;
  let state: State = IDLE;
  /** The last tap, for spotting a double-tap. */
  let lastTap: { readonly at: PadPoint; readonly time: number } | null = null;

  function toIdle(tap: typeof lastTap = null): void {
    state = IDLE;
    lastTap = tap;
  }

  function moved(from: PadPoint, to: PadPoint): boolean {
    return distance(from, to) > tuning.movementThreshold;
  }

  function twoFingers(first: Finger, second: PadPointerEvent): State {
    return {
      name: 'two fingers',
      down: new Map([
        [first.id, first.down],
        [second.pointerId, point(second)],
      ]),
      cancelled: false,
    };
  }

  function handle(event: PadPointerEvent): PadIntent[] {
    const at = point(event);

    switch (state.name) {
      case 'idle': {
        if (event.type !== 'down') return [];
        const finger = { id: event.pointerId, down: at, time: event.time };
        const doubleTap =
          lastTap !== null &&
          event.time - lastTap.time <= tuning.doubleTapWindow &&
          distance(at, lastTap.at) <= tuning.doubleTapDistance;
        lastTap = null;
        if (doubleTap) {
          state = { name: 'second touch', finger };
          return [];
        }
        state = { name: 'touching', finger };
        return [{ type: 'begin' }, { type: 'jump', ...at }];
      }

      case 'touching': {
        const { finger } = state;
        if (event.pointerId !== finger.id) {
          if (event.type !== 'down' || event.time - finger.time > tuning.twoFingerWindow) return [];
          state = twoFingers(finger, event);
          return [{ type: 'revert' }];
        }
        if (event.type === 'move') {
          if (!moved(finger.down, at)) return [];
          state = { name: 'dragging', finger };
          return [{ type: 'follow', ...at }];
        }
        if (event.type === 'up') {
          toIdle({ at: finger.down, time: event.time });
          return [{ type: 'commit' }];
        }
        if (event.type === 'cancel') {
          toIdle();
          return [{ type: 'commit' }];
        }
        return [];
      }

      case 'dragging': {
        if (event.pointerId !== state.finger.id) return [];
        if (event.type === 'move') return [{ type: 'follow', ...at }];
        if (event.type === 'up' || event.type === 'cancel') {
          toIdle();
          return [{ type: 'commit' }];
        }
        return [];
      }

      case 'second touch': {
        const { finger } = state;
        if (event.pointerId !== finger.id) {
          // A two-finger tap right after a tap, near it: nothing has moved
          // yet, so there is nothing to revert.
          if (event.type !== 'down' || event.time - finger.time > tuning.twoFingerWindow) return [];
          state = twoFingers(finger, event);
          return [];
        }
        if (event.type === 'move') {
          if (!moved(finger.down, at)) return [];
          const from = options.position();
          state = { name: 'fine', finger, from };
          return [{ type: 'begin' }, fineIntent(from, finger.down, at)];
        }
        if (event.type === 'up') {
          // A double-tap without movement acts as a tap.
          toIdle({ at: finger.down, time: event.time });
          return [{ type: 'begin' }, { type: 'jump', ...finger.down }, { type: 'commit' }];
        }
        if (event.type === 'cancel') toIdle();
        return [];
      }

      case 'fine': {
        const { finger, from } = state;
        if (event.pointerId !== finger.id) return [];
        if (event.type === 'move') return [fineIntent(from, finger.down, at)];
        if (event.type === 'up' || event.type === 'cancel') {
          toIdle();
          return [{ type: 'commit' }];
        }
        return [];
      }

      case 'two fingers': {
        const fingerDown = state.down.get(event.pointerId);
        if (fingerDown === undefined) return [];
        if (event.type === 'move' && moved(fingerDown, at)) state.cancelled = true;
        if (event.type === 'cancel') state.cancelled = true;
        if (event.type === 'up' || event.type === 'cancel') {
          state.down.delete(event.pointerId);
          if (state.down.size > 0) return [];
          const { cancelled } = state;
          toIdle();
          return cancelled ? [] : [{ type: 'undo' }];
        }
        return [];
      }
    }
  }

  function fineIntent(from: PadPoint, fingerDown: PadPoint, at: PadPoint): PadIntent {
    return {
      type: 'fine',
      x: from.x + (at.x - fingerDown.x) * tuning.fineSpeed,
      y: from.y + (at.y - fingerDown.y) * tuning.fineSpeed,
    };
  }

  return { handle };
}

function point(event: PadPointerEvent): PadPoint {
  return { x: event.x, y: event.y };
}

function distance(a: PadPoint, b: PadPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
