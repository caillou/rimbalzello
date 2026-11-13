// The debug readout (`?debug`, debug-flags.ts): how the scheduler's timers
// woke it while the page was visible and while it was hidden, for measuring
// background playback on a device (#22). Loaded only under the flag, so it
// costs nothing otherwise. A developer tool outside design.md: plain DOM in
// the app's colours and font.

import type { WakeReport, WakeSource } from '../engine/scheduler';
import { tunables } from '../engine/tunables';

/** In ms. A wake gap above the scheduler's lookahead outruns it, and hits can sound late. */
const LONG_GAP = tunables.lookahead * 1000;

/** A stretch of visible or hidden time. Play starts a new one, so a stopped stretch is no gap. */
interface Segment {
  visibility: DocumentVisibilityState;
  /** `performance.now()` at its start and, once over, its end, in ms. */
  from: number;
  to?: number;
  wakes: Record<WakeSource, number>;
  first?: WakeReport;
  last?: WakeReport;
  /** The gap ending at the latest wake, counted once a later wake shows it was not the segment's last. */
  pendingGap?: number;
  maxGap: number;
  longGaps: number;
  overdue: number;
  /** In seconds. */
  maxLate: number;
  /** Context state changes seen at a wake: seconds into the segment, and the state. */
  states: string[];
}

export interface DebugReadout {
  /** Takes one wake of the scheduler (its `probe`). */
  record(report: WakeReport): void;
  remove(): void;
}

/** Shows the readout over the play screen. `clock` names the timers that wake the scheduler. */
export function showDebugReadout(clock: string): DebugReadout {
  const startedAt = new Date();
  const segments: Segment[] = [];
  let state: AudioContextState | undefined;

  function begin(from = performance.now()): Segment {
    const segment: Segment = {
      visibility: document.visibilityState,
      from,
      wakes: { page: 0, worker: 0, play: 0, loop: 0 },
      maxGap: 0,
      longGaps: 0,
      overdue: 0,
      maxLate: 0,
      states: [],
    };
    const current = segments.at(-1);
    if (current) current.to = segment.from;
    segments.push(segment);
    return segment;
  }
  let current = begin();

  function record(report: WakeReport) {
    if (report.source === 'play') current = begin(report.wall);
    const segment = current;
    segment.wakes[report.source]++;
    segment.overdue += report.overdue;
    segment.maxLate = Math.max(segment.maxLate, report.maxLate);
    if (report.state !== state) {
      state = report.state;
      segment.states.push(`${seconds(report.wall - segment.from)} ${state}`);
    }
    // The gaps next to a segment's first and last wake span the switch to
    // or from another app, with its animation: neither counts.
    if (segment.pendingGap !== undefined) {
      segment.maxGap = Math.max(segment.maxGap, segment.pendingGap);
      if (segment.pendingGap > LONG_GAP) segment.longGaps++;
    }
    segment.pendingGap = segment.last && segment.last !== segment.first ? report.wall - segment.last.wall : undefined;
    segment.first ??= report;
    segment.last = report;
  }

  function text(): string {
    const lines = [
      `rimbalzello debug readout · clock: ${clock}`,
      navigator.userAgent,
      `since ${startedAt.toLocaleTimeString()} · gaps leave out each segment's first and last wake`,
    ];
    segments.forEach((segment, index) => lines.push(describe(segment, index + 1)));
    return lines.join('\n');
  }

  // It starts folded to its two buttons, over the title and clear of the
  // header's tempo and play/stop. `copy` works folded. `show` opens the text
  // over the header until `hide`.
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;top:0;left:0;z-index:1000;max-width:100vw;box-sizing:border-box;' +
    'padding:4px 6px;background:var(--pad);color:var(--text-secondary);border:1px solid var(--hairline);' +
    'font:10px/1.3 var(--font);opacity:0.92';
  const buttons = document.createElement('div');
  const copy = button('copy');
  const toggle = button('show');
  const pre = document.createElement('pre');
  // The text scrolls on its own, so the buttons stay in view.
  pre.style.cssText =
    'display:none;max-height:45vh;overflow:auto;margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit';
  buttons.append(copy, toggle);
  box.append(buttons, pre);
  document.body.append(box);

  function render() {
    if (document.visibilityState === 'visible' && pre.style.display !== 'none') pre.textContent = text();
  }

  function setShown(shown: boolean) {
    pre.style.display = shown ? '' : 'none';
    toggle.textContent = shown ? 'hide' : 'show';
    render();
  }

  copy.addEventListener('click', () => {
    const all = text();
    // Called inside a promise, so a missing Clipboard API lands in the
    // fallback too: an insecure origin (a dev server reached over the LAN)
    // has no navigator.clipboard at all.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(all))
      .then(
        () => {
          copy.textContent = 'copied';
          setTimeout(() => (copy.textContent = 'copy'), 1000);
        },
        () => {
          // No clipboard: show the text, selected, to copy by hand.
          setShown(true);
          pre.textContent = all;
          getSelection()?.selectAllChildren(pre);
        },
      );
  });
  toggle.addEventListener('click', () => setShown(pre.style.display === 'none'));

  function onVisibilityChange() {
    current = begin();
    render();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  const refresh = setInterval(render, 1000);
  render();

  return {
    record,
    remove() {
      clearInterval(refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      box.remove();
    },
  };
}

function describe(segment: Segment, number: number): string {
  const { first, last } = segment;
  const duration = (segment.to ?? performance.now()) - segment.from;
  const head = `#${number} ${segment.visibility} ${seconds(duration)}`;
  if (!first || !last) return `${head} · no wakes`;
  const { page, worker, play, loop } = segment.wakes;
  const taps = play + loop > 0 ? ` play ${play} loop ${loop}` : '';
  // Context time over wall time, first wake to last: 1 is healthy, 0 a frozen clock (WebKit bug 276016).
  const wall = (last.wall - first.wall) / 1000;
  const ratio = wall > 0 ? ((last.now - first.now) / wall).toFixed(3) : '–';
  const parts = [
    head,
    `wakes page ${page} worker ${worker}${taps}`,
    `max gap ${Math.round(segment.maxGap)} ms`,
    `>${LONG_GAP} ms ${segment.longGaps}`,
    `overdue ${segment.overdue} (max late ${Math.round(segment.maxLate * 1000)} ms)`,
    `ctx/wall ${ratio}`,
  ];
  const states = segment.states.length > 0 ? `\n   state ${segment.states.join(', ')}` : '';
  return parts.join(' · ') + states;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function button(label: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.style.cssText =
    'margin-right:8px;padding:2px 6px;background:none;color:var(--text);border:1px solid var(--hairline);font:inherit';
  // A click leaves focus where it was, so space still plays and stops (as noFocusFromPointer in App.tsx).
  element.addEventListener('mousedown', (event) => event.preventDefault());
  return element;
}
