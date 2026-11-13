// A strip: one horizontal slider row (label, track, value). It moves relative
// to the touch: a drag anywhere on the row moves the value by the distance
// dragged along the track, and a tap changes nothing. Most strips hold a
// byte and show it as 0–100; bpm and swing hold their own range and show
// their value as it is (`128`, `56%`). A labelled ARIA slider, so keys work too.

import { createUniqueId } from 'solid-js';
import { BYTE_RANGE, type Range } from '../engine/setup';
import { tunables } from '../engine/tunables';
import { fromDisplay, toDisplay } from './display';
import './strip.css';

export interface StripProps {
  label: string;
  /** The control's colour, such as `var(--bd)`. */
  colour: string;
  /** The stored value: a byte, unless `range` says otherwise. */
  value: number;
  /** The value's range when it is not a byte; such a value shows as it is, not as 0–100. */
  range?: Range;
  /** Shown after the value, such as `%`. */
  unit?: string;
  /** A new value, not rounded; the store rounds and clamps it. */
  onChange(value: number): void;
}

/** Shown steps per key: arrows by 1, page keys by 10. */
const KEY_STEPS: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 10,
  PageDown: -10,
};

interface Drag {
  pointerId: number;
  /** Where the value was `value`, in client px. */
  from: number;
  value: number;
  /** False until the finger has travelled past the drag threshold. */
  moving: boolean;
}

export function Strip(props: StripProps) {
  const labelId = createUniqueId();
  let track!: HTMLSpanElement;
  let drag: Drag | undefined;
  const range = () => props.range ?? BYTE_RANGE;
  // A byte shows as 0–100; a value with a range of its own shows as it is.
  const toShown = (value: number) => (props.range ? value : toDisplay(value));
  const fromShown = (shown: number) => (props.range ? shown : fromDisplay(shown));
  const shown = () => toShown(props.value);

  function down(event: PointerEvent) {
    if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag = { pointerId: event.pointerId, from: event.clientX, value: props.value, moving: false };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser does not know (a synthetic one): followed without capture.
    }
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moving) {
      if (Math.abs(event.clientX - drag.from) < tunables.strips.dragThreshold) return;
      // Measured from here, so passing the threshold does not jump the value.
      drag.moving = true;
      drag.from = event.clientX;
    }
    const { min, max } = range();
    const wanted = drag.value + ((event.clientX - drag.from) / Math.max(1, track.clientWidth)) * (max - min);
    const value = Math.min(max, Math.max(min, wanted));
    // Past either end, start again from the end, so turning back moves at once.
    if (value !== wanted) {
      drag.value = value;
      drag.from = event.clientX;
    }
    props.onChange(value);
  }

  function end(event: PointerEvent) {
    if (drag?.pointerId === event.pointerId) drag = undefined;
  }

  function key(event: KeyboardEvent) {
    const [min, max] = [toShown(range().min), toShown(range().max)];
    const step = KEY_STEPS[event.key];
    const next = event.key === 'Home' ? min : event.key === 'End' ? max : step === undefined ? undefined : shown() + step;
    if (next === undefined) return;
    event.preventDefault();
    props.onChange(fromShown(Math.min(max, Math.max(min, next))));
  }

  return (
    <div
      class="strip"
      role="slider"
      tabindex="0"
      aria-labelledby={labelId}
      aria-valuemin={toShown(range().min)}
      aria-valuemax={toShown(range().max)}
      aria-valuenow={shown()}
      aria-valuetext={props.unit ? `${shown()}${props.unit}` : undefined}
      style={{
        '--colour': props.colour,
        '--value': `${((props.value - range().min) / (range().max - range().min)) * 100}%`,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      on:pointercancel={end}
      onKeyDown={key}
    >
      <span id={labelId} class="strip-label">
        {props.label}
      </span>
      <span ref={track} class="strip-track">
        <span class="strip-fill" />
        <span class="strip-thumb" />
      </span>
      <span class="strip-value" aria-hidden="true">
        {shown()}
        {props.unit}
      </span>
    </div>
  );
}
