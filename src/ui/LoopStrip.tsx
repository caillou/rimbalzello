// The loop strip: four zones that hold the looper, longest loop on the left.
// It tracks the finger: the zone under it is held, sliding to another zone
// changes the size, and sliding off the strip or lifting releases the loop.
// Each zone is a button, so a focused zone also holds while space or enter
// is down. A finger or key that went down while stopped, or stayed down
// through a stop, holds nothing until it lifts: the player must touch again.

import { createEffect, createUniqueId, For, type Accessor } from 'solid-js';
import type { LoopSteps } from '../engine/transport';
import { Keycap } from './Keycap';
import './loop-strip.css';

export interface LoopStripProps {
  /** The loop held now, if any: its zone shows white. */
  held: Accessor<LoopSteps | undefined>;
  /** Whether the pattern plays: the looper works only while playing. */
  playing: Accessor<boolean>;
  /** The finger or key is on this zone: hold its loop. Called again only when the zone changes. */
  onHold(steps: LoopSteps): void;
  /** The finger lifted or left the strip, or the key went up: release the loop. */
  onRelease(): void;
}

/** The zones, longest on the left: 1/4, 1/8, 1/16 and 1/32 of a bar, and the keys that hold them. */
const ZONES: readonly { label: string; steps: LoopSteps; key: string }[] = [
  { label: '1/4', steps: 8, key: '1' },
  { label: '1/8', steps: 4, key: '2' },
  { label: '1/16', steps: 2, key: '3' },
  { label: '1/32', steps: 1, key: '4' },
];

/** Keys that hold a focused zone, like a button pressed down. */
const HOLD_KEYS = new Set([' ', 'Enter']);

/** The pointer (by id) or the key holding the strip, and the zone it is on. */
interface Holder {
  id: number | 'key';
  steps: LoopSteps | undefined;
  /** Down while stopped, or held through a stop: it holds nothing until it lifts. */
  inert: boolean;
}

export function LoopStrip(props: LoopStripProps) {
  const labelId = createUniqueId();
  const zones: HTMLButtonElement[] = [];
  let holder: Holder | undefined;

  // Stop ends the loop, and the finger or key still down stays inert.
  createEffect(() => {
    if (!props.playing() && holder) holder.inert = true;
  });

  function zoneAt(x: number, y: number): LoopSteps | undefined {
    const index = zones.findIndex((zone) => {
      const box = zone.getBoundingClientRect();
      return x >= box.left && x < box.right && y >= box.top && y < box.bottom;
    });
    return ZONES[index]?.steps;
  }

  /** The holder is on `steps` now, or off the strip. */
  function moveTo(steps: LoopSteps | undefined) {
    if (!holder || holder.inert || steps === holder.steps) return;
    holder.steps = steps;
    if (steps === undefined) props.onRelease();
    else props.onHold(steps);
  }

  function letGo() {
    moveTo(undefined);
    holder = undefined;
  }

  function down(event: PointerEvent) {
    if (holder || (event.pointerType === 'mouse' && event.button !== 0)) return;
    holder = { id: event.pointerId, steps: undefined, inert: !props.playing() };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser does not know (a synthetic one): followed without capture.
    }
    moveTo(zoneAt(event.clientX, event.clientY));
  }

  function move(event: PointerEvent) {
    if (holder?.id === event.pointerId) moveTo(zoneAt(event.clientX, event.clientY));
  }

  function up(event: PointerEvent) {
    if (holder?.id === event.pointerId) letGo();
  }

  function keyDown(steps: LoopSteps, event: KeyboardEvent) {
    if (!HOLD_KEYS.has(event.key)) return;
    event.preventDefault();
    if (event.repeat || holder) return;
    holder = { id: 'key', steps: undefined, inert: !props.playing() };
    moveTo(steps);
  }

  function keyUp(event: KeyboardEvent) {
    if (HOLD_KEYS.has(event.key) && holder?.id === 'key') letGo();
  }

  function blur() {
    if (holder?.id === 'key') letGo();
  }

  return (
    <div class="loop-strip" role="group" aria-labelledby={labelId}>
      <span id={labelId} class="loop-label">
        loop
      </span>
      <div class="loop-zones" onPointerDown={down} onPointerMove={move} onPointerUp={up} on:pointercancel={up}>
        <For each={ZONES}>
          {(zone, index) => (
            <button
              type="button"
              class="loop-zone"
              aria-pressed={props.held() === zone.steps ? 'true' : 'false'}
              ref={(element) => (zones[index()] = element)}
              onKeyDown={(event) => keyDown(zone.steps, event)}
              onKeyUp={keyUp}
              onBlur={blur}
            >
              {zone.label}
              <Keycap>{zone.key}</Keycap>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
