// A button that acts when pressed, not when released: a pointer acts on
// touch-down, so a tap lands at once, and keys (Enter, Space) or assistive
// technology act through the click they send. With `repeat` it acts again
// and again while held, after a delay (the header's − and + for tempo).

import { onCleanup, type JSX } from 'solid-js';
import { tunables } from '../engine/tunables';

export interface PressButtonProps {
  class: string;
  /** The accessible name, when the text alone does not say it (`−`, `+`). */
  label?: string;
  /** Act again while held: after `tunables.repeat.delay`, then every `tunables.repeat.interval`. */
  repeat?: boolean;
  /** `time` is when the press happened, in ms on the page's clock (`performance.now()`). */
  onPress(time: number): void;
  children: JSX.Element;
}

export function PressButton(props: PressButtonProps) {
  /** The pointer holding the button down. */
  let held: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** A pointer press already acted, so the click that ends it must not act again. */
  let pressed = false;

  function release() {
    clearTimeout(timer);
    timer = undefined;
    held = undefined;
  }
  onCleanup(release);

  function repeat() {
    props.onPress(performance.now());
    timer = setTimeout(repeat, tunables.repeat.interval);
  }

  function down(event: PointerEvent) {
    if (held !== undefined || (event.pointerType === 'mouse' && event.button !== 0)) return;
    held = event.pointerId;
    pressed = true;
    props.onPress(event.timeStamp);
    if (props.repeat) timer = setTimeout(repeat, tunables.repeat.delay);
  }

  function up(event: PointerEvent) {
    if (event.pointerId === held) release();
  }

  function click(event: MouseEvent) {
    if (pressed) pressed = false;
    else props.onPress(event.timeStamp);
  }

  return (
    <button
      type="button"
      class={props.class}
      aria-label={props.label}
      onPointerDown={down}
      onPointerUp={up}
      on:pointercancel={up}
      // A mouse slid off the button lets go; a finger stays captured until it lifts.
      on:pointerleave={up}
      // A press that never ended in a click must not swallow the next key press.
      onKeyDown={() => (pressed = false)}
      onClick={click}
    >
      {props.children}
    </button>
  );
}
