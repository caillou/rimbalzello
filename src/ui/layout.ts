// The play screen's phone layouts. The play screen is 100dvh tall, so its
// own size, less the bottom safe area, is what the rows have to share. Each
// layout starts where its rows leave the pad `tunables.phoneLayouts.padMinHeight`.

import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { tunables } from '../engine/tunables';

/**
 * `phone`: all six strips. `short`: the strips in `mix` and `fx` tabs.
 * `compact`: the short layout tightened, with the step display inside the pad.
 */
export type Layout = 'phone' | 'short' | 'compact';

// The height of each layout's rows besides the pad, in CSS px. They mirror
// the stylesheets; the e2e sweep over viewport heights catches a stylesheet
// change that makes them wrong.

/** Header 52, step display 80, loop strip 44, six strips 264, bottom bar 48, footer 44. */
const PHONE_ROWS = 532;

/** The phone layout's rows with a 44 px tab row and three strips instead of six. */
const SHORT_ROWS = 444;

// Below the short layout, the compact layout: a 44 px header and bottom bar
// and the step display inside the pad leave 352 px of rows. It is the
// smallest, so its pad takes what is left.

function layoutFor(width: number, height: number): Layout {
  const { width: narrow, padMinHeight } = tunables.phoneLayouts;
  if (width >= narrow || height >= PHONE_ROWS + padMinHeight) return 'phone';
  return height >= SHORT_ROWS + padMinHeight ? 'short' : 'compact';
}

/**
 * The layout for the play screen, following its size. `observe` takes the
 * play screen's element; until it is laid out, the window's size stands in.
 */
export function createLayout(): { layout: Accessor<Layout>; observe(element: HTMLElement): void } {
  const [layout, setLayout] = createSignal(layoutFor(innerWidth, innerHeight));
  const resize = new ResizeObserver(([entry]) => {
    if (entry) setLayout(layoutFor(entry.contentRect.width, entry.contentRect.height));
  });
  onCleanup(() => resize.disconnect());
  return { layout, observe: (element) => resize.observe(element) };
}
