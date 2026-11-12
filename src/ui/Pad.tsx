// The pad: the X/Y surface the player touches to move through the map.
// Pointer events go through the pad gesture interpreter, whose intents move
// the setup store's position and open and close pad moves for pad undo. The
// drawing (crosshair, ring, position, X/Y readout) is written straight to the
// DOM once per frame, outside Solid's update cycle.

import { onCleanup, onMount, type JSX } from 'solid-js';
import { BYTE_RANGE } from '../engine/setup';
import type { SetupStore } from '../engine/setup-store';
import { toDisplay } from './display';
import { createPadGestures, type PadIntent, type PadPoint, type PadPointerEvent } from './pad-gestures';
import './pad.css';

/** Gap between the position and the X/Y readout, in px. */
const READOUT_GAP = 12;

export interface PadProps {
  store: SetupStore;
  /** A pad move is done: a tap, drag or fine adjust has ended. */
  onMove?: () => void;
  /** Shown over the pad, such as `▶ tap to play`. Buttons in it take their own taps. */
  children?: JSX.Element;
}

export function Pad(props: PadProps) {
  let pad!: HTMLDivElement;
  let vertical!: HTMLDivElement;
  let horizontal!: HTMLDivElement;
  let ring!: HTMLDivElement;
  let dot!: HTMLDivElement;
  let readout!: HTMLDivElement;
  let width = 0;
  let height = 0;
  let frame = 0;

  // Bytes run left to right and bottom to top: a higher y is higher up the
  // pad, as the arrow keys have it (ArrowUp raises y).
  const full = BYTE_RANGE.max;
  const toPad = (x: number, y: number): PadPoint => ({ x: (x / full) * width, y: (1 - y / full) * height });
  const toBytes = (point: PadPoint) => ({
    x: width > 0 ? (point.x / width) * full : 0,
    y: height > 0 ? (1 - point.y / height) * full : 0,
  });

  const gestures = createPadGestures({
    position: () => {
      const { x, y } = props.store.setup();
      return toPad(x, y);
    },
  });

  function apply(intent: PadIntent) {
    const { store } = props;
    switch (intent.type) {
      case 'begin':
        return store.padBegin();
      case 'jump':
      case 'follow':
      case 'fine': {
        const to = toBytes(intent);
        return store.padTo(to.x, to.y);
      }
      case 'commit':
        store.padCommit();
        return props.onMove?.();
      case 'revert':
        return store.padRevert();
      case 'undo':
        return store.padUndo();
    }
  }

  /** Pointers that went down on the pad itself, not on a button over it. */
  const pointers = new Set<number>();

  function feed(type: PadPointerEvent['type'], event: PointerEvent) {
    const rect = pad.getBoundingClientRect();
    const intents = gestures.handle({
      type,
      pointerId: event.pointerId,
      time: event.timeStamp,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    for (const intent of intents) apply(intent);
  }

  function down(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    pointers.add(event.pointerId);
    try {
      // Keeps a drag going when the finger leaves the pad.
      pad.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser does not know (a synthetic one): followed without capture.
    }
    feed('down', event);
  }

  function move(event: PointerEvent) {
    if (pointers.has(event.pointerId)) feed('move', event);
  }

  function up(event: PointerEvent) {
    if (pointers.delete(event.pointerId)) feed('up', event);
  }

  function cancel(event: PointerEvent) {
    if (pointers.delete(event.pointerId)) feed('cancel', event);
  }

  function draw() {
    frame = 0;
    const { x, y } = props.store.setup();
    const at = toPad(x, y);
    vertical.style.transform = `translateX(${at.x}px)`;
    horizontal.style.transform = `translateY(${at.y}px)`;
    ring.style.transform = `translate(${at.x}px, ${at.y}px)`;
    dot.style.transform = `translate(${at.x}px, ${at.y}px)`;
    readout.textContent = `x ${toDisplay(x)} · y ${toDisplay(y)}`;
    // Below right of the position, flipped to the other side near the far edges.
    const left = at.x + READOUT_GAP + readout.offsetWidth > width ? at.x - READOUT_GAP - readout.offsetWidth : at.x + READOUT_GAP;
    const top = at.y + READOUT_GAP + readout.offsetHeight > height ? at.y - READOUT_GAP - readout.offsetHeight : at.y + READOUT_GAP;
    readout.style.transform = `translate(${left}px, ${top}px)`;
  }

  function redraw() {
    frame ||= requestAnimationFrame(draw);
  }

  onMount(() => {
    const resize = new ResizeObserver(() => {
      width = pad.clientWidth;
      height = pad.clientHeight;
      redraw();
    });
    resize.observe(pad);
    const unsubscribe = props.store.subscribe(redraw);
    onCleanup(() => {
      resize.disconnect();
      unsubscribe();
      cancelAnimationFrame(frame);
    });
  });

  return (
    <div
      ref={pad}
      class="pad"
      data-control="pad"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      on:pointercancel={cancel}
    >
      <div ref={vertical} class="pad-line pad-line-vertical" />
      <div ref={horizontal} class="pad-line pad-line-horizontal" />
      <div ref={ring} class="pad-ring" />
      <div ref={dot} class="pad-position" />
      <div ref={readout} class="pad-readout" />
      {props.children}
    </div>
  );
}
