// Which layout the play screen takes, from its own size. The play screen is
// 100dvh tall, so its size, less the safe areas, is what the rows have
// to share. The breakpoints live in `tunables.layouts`; App sets the result
// on the play screen as `data-layout`, `data-sound-folded` and `data-stacked`,
// and the layout stylesheets key on them. It also sets the laptop layout's
// zoom as `--zoom`, which the stylesheets multiply their px sizes by. The
// zoom reads the browser window's outer size besides the play screen's,
// because browser zoom leaves the outer size alone in Chrome and Safari: Cmd +
// then enlarges the layout instead of being absorbed by its zoom.

import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js';
import { tunables } from '../engine/tunables';

/**
 * - phone: one column, pad on top, the strips in `mix`, `fx` and `tempo` tabs,
 *   or, in a window tall enough, stacked as groups without tabs (`stacked`).
 * - compact: the phone layout tightened, with the step display inside the pad.
 * - tablet: wide and portrait: pad on top, two columns below.
 * - laptop: wide and landscape, tablets in landscape included: pad on the
 *   left, everything else on the right.
 * - rotate: landscape but too narrow or too short for two columns: a hint to
 *   turn the phone upright instead of the play screen.
 */
export type Layout = 'phone' | 'compact' | 'tablet' | 'laptop' | 'rotate';

/**
 * The height of the phone layout's rows besides the pad, in CSS px: header
 * 52, step display 80, loop strip 44, tab row 44 and three rows 132, bottom
 * bar 48, footer 44. They mirror the stylesheets; the e2e sweep over
 * viewport heights catches a stylesheet change that makes them wrong.
 */
const PHONE_ROWS = 444;

/**
 * The phone layout's rows besides the pad when it stacks its groups: the
 * phone rows with the tab row and its three rows (176) replaced by three
 * 32 px group headings and nine 44 px rows (mix 3, fx 3, tempo 3; 492).
 * They mirror stacked.css. With PAD_SIDE_MARGINS they set where the pad is
 * square at the threshold; the e2e sweep around 1103 px at 375 wide catches
 * either one going wrong.
 */
const STACKED_ROWS = PHONE_ROWS - 176 + 492;

/**
 * The pad's 16 px margin on each side (pad.css): the pad is the play
 * screen's width less this.
 */
const PAD_SIDE_MARGINS = 32;

// Below the phone layout, the compact layout: a 44 px header and bottom bar
// and the step display inside the pad leave 352 px of rows. It is the
// smallest, so its pad takes what is left.

function layoutFor(width: number, height: number): Layout {
  const { wideMinWidth, wideMinHeight, padMinHeight } = tunables.layouts;
  const landscape = width > height;
  if (width >= wideMinWidth && height >= wideMinHeight) return landscape ? 'laptop' : 'tablet';
  if (landscape) return 'rotate';
  return height >= PHONE_ROWS + padMinHeight ? 'phone' : 'compact';
}

export interface Size {
  width: number;
  height: number;
}

/**
 * What the laptop zoom is computed from, all as the page reads them:
 * `screen` the play screen, `inner` the window's `innerWidth × innerHeight`,
 * `outer` its `outerWidth × outerHeight`.
 */
export interface WindowSizes {
  screen: Size;
  inner: Size;
  outer: Size;
}

const usable = (size: Size) =>
  Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;

/**
 * The laptop layout's zoom with the sound unfolded, 1 to maxZoom
 * (`tunables.layouts.laptopZoom`). How large the layout wants to be comes
 * from the outer window less its toolbar, which Cmd + does not change in
 * Chrome and Safari; how large it may be comes from the play screen, which
 * Cmd + shrinks. The toolbar is the outer height less the inner height in
 * outer px (scaled by outer ÷ inner width, the browser zoom), at least 0: a
 * side panel inflates the ratio and reads as no toolbar, DevTools docked at
 * the bottom counts as toolbar. Without a usable outer size, or with outer
 * equal to inner, it is the play screen's own zoom; Firefox, whose outer
 * size scales with browser zoom, lands there too.
 */
export function laptopZoom({ screen, inner, outer }: WindowSizes): number {
  const { designSize, maxZoom, fitWidth } = tunables.layouts.laptopZoom;
  let unzoomed = screen;
  if (usable(outer) && usable(inner)) {
    const chrome = Math.max(0, outer.height - inner.height * (outer.width / inner.width));
    // The inner − screen terms take off the safe areas; 0 on a desktop.
    unzoomed = {
      width: outer.width - (inner.width - screen.width),
      height: outer.height - chrome - (inner.height - screen.height),
    };
  }
  const wanted = Math.min(unzoomed.width / designSize.width, unzoomed.height / designSize.height);
  const fits = Math.min(screen.width / fitWidth, screen.height / tunables.layouts.soundSectionsMinHeight);
  return Math.min(maxZoom, Math.max(1, Math.min(wanted, fits)));
}

/**
 * How much the laptop layout grows in a window larger than it was designed
 * for; 1 in every other layout, and in a laptop window with the sound folded.
 */
function zoomFor(layout: Layout, soundFolded: boolean, sizes: WindowSizes): number {
  return layout !== 'laptop' || soundFolded ? 1 : laptopZoom(sizes);
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
  /**
   * The phone layout in a window tall enough for the pad to stay at least
   * `tunables.layouts.stackedPadMinShape` (height ÷ width) with every group
   * on screen: mix, fx and tempo, and in sound mode the three sound
   * sections, stack under their headings instead of folding into tabs.
   */
  stacked: Accessor<boolean>;
  /** The factor every size of the laptop layout grows by on a large window: 1 to 2, 1 elsewhere. */
  zoom: Accessor<number>;
  /** Follow the play screen's element. Until it is laid out, the window's size stands in. */
  observe(element: HTMLElement): void;
}

export function createLayout(): PlayScreenLayout {
  // Cmd +, Cmd −, a window resize and fullscreen all resize the play screen,
  // so its observer is the moment to read the window's sizes too.
  const windowSizes = (screen: Size): WindowSizes => ({
    screen,
    inner: { width: innerWidth, height: innerHeight },
    outer: { width: outerWidth, height: outerHeight },
  });
  const [sizes, setSizes] = createSignal(windowSizes({ width: innerWidth, height: innerHeight }));
  const resize = new ResizeObserver(([entry]) => {
    if (entry) setSizes(windowSizes({ width: entry.contentRect.width, height: entry.contentRect.height }));
  });
  onCleanup(() => resize.disconnect());

  const size = () => sizes().screen;
  const layout = createMemo(() => layoutFor(size().width, size().height));
  const soundFolded = createMemo(
    () => layout() === 'laptop' && size().height < tunables.layouts.soundSectionsMinHeight,
  );
  const stacked = createMemo(
    () =>
      layout() === 'phone' &&
      size().height >= STACKED_ROWS + tunables.layouts.stackedPadMinShape * (size().width - PAD_SIDE_MARGINS),
  );
  const zoom = createMemo(() => zoomFor(layout(), soundFolded(), sizes()));
  return { layout, soundFolded, stacked, zoom, observe: (element) => resize.observe(element) };
}
