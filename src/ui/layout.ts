// Which layout the play screen takes, from its own size. The play screen is
// 100dvh tall, so its size, less the bottom safe area, is what the rows have
// to share. The breakpoints live in `tunables.layouts`; App sets the result
// on the play screen as `data-layout` and `data-sound-folded`, and the layout
// stylesheets key on them.

import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js';
import { tunables } from '../engine/tunables';

/**
 * - phone: one column, pad on top, all six strips.
 * - short: the phone layout with the strips in `mix` and `fx` tabs.
 * - compact: the short layout tightened, with the step display inside the pad.
 * - tablet: wide and portrait: pad on top, two columns below.
 * - laptop: wide and landscape, tablets in landscape included: pad on the
 *   left, everything else on the right.
 * - rotate: landscape but too narrow or too short for two columns: a hint to
 *   turn the phone upright instead of the play screen.
 */
export type Layout = 'phone' | 'short' | 'compact' | 'tablet' | 'laptop' | 'rotate';

// The height of each phone layout's rows besides the pad, in CSS px. They
// mirror the stylesheets; the e2e sweep over viewport heights catches a
// stylesheet change that makes them wrong.

/** Header 52, step display 80, loop strip 44, six strips 264, bottom bar 48, footer 44. */
const PHONE_ROWS = 532;

/** The phone layout's rows with a 44 px tab row and three strips instead of six. */
const SHORT_ROWS = 444;

// Below the short layout, the compact layout: a 44 px header and bottom bar
// and the step display inside the pad leave 352 px of rows. It is the
// smallest, so its pad takes what is left.

function layoutFor(width: number, height: number): Layout {
  const { wideMinWidth, wideMinHeight, padMinHeight } = tunables.layouts;
  const landscape = width > height;
  if (width >= wideMinWidth && height >= wideMinHeight) return landscape ? 'laptop' : 'tablet';
  if (landscape) return 'rotate';
  if (height >= PHONE_ROWS + padMinHeight) return 'phone';
  return height >= SHORT_ROWS + padMinHeight ? 'short' : 'compact';
}

/** Whether a layout has two columns. */
export const isWide = (layout: Layout) => layout === 'tablet' || layout === 'laptop';

export interface PlayScreenLayout {
  /** The layout for the play screen now, following its resizes and rotations. */
  layout: Accessor<Layout>;
  /**
   * The laptop layout in a window too short for the three sound sections
   * side by side: the sound folds into the drum tabs and the rows close up.
   */
  soundFolded: Accessor<boolean>;
  /** Follow the play screen's element. Until it is laid out, the window's size stands in. */
  observe(element: HTMLElement): void;
}

export function createLayout(): PlayScreenLayout {
  const [size, setSize] = createSignal({ width: innerWidth, height: innerHeight });
  const resize = new ResizeObserver(([entry]) => {
    if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
  });
  onCleanup(() => resize.disconnect());

  const layout = createMemo(() => layoutFor(size().width, size().height));
  const soundFolded = createMemo(
    () => layout() === 'laptop' && size().height < tunables.layouts.soundSectionsMinHeight,
  );
  return { layout, soundFolded, observe: (element) => resize.observe(element) };
}
