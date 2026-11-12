// Tap tempo: tap times in, a tempo in whole bpm out. The tempo is the
// average gap over the last few taps (tunables.tapTempo.taps), rounded and
// clamped to the tempo range. A gap far from the running average starts a
// new average from the tap before it, so tapping a new tempo takes at once.
// A long pause starts over: the next tap only starts counting.

import { BPM_RANGE } from '../engine/setup';
import { tunables } from '../engine/tunables';

export interface TapTempo {
  /**
   * One tap, at `time` in ms on any monotonic clock (such as
   * `PointerEvent.timeStamp`). Returns the tapped tempo, or undefined while
   * there is no gap to measure yet.
   */
  tap(time: number): number | undefined;
}

export function createTapTempo(): TapTempo {
  const { taps, outlierRatio, restartGap } = tunables.tapTempo;
  let last: number | undefined;
  /** The gaps of the current average, oldest first. */
  let gaps: number[] = [];

  return {
    tap(time) {
      const gap = last === undefined ? undefined : time - last;
      last = time;
      if (gap === undefined || gap > restartGap) {
        gaps = [];
        return undefined;
      }
      if (gaps.length > 0) {
        const average = mean(gaps);
        if (gap > average * outlierRatio || gap < average / outlierRatio) gaps = [];
      }
      gaps = [...gaps, gap].slice(-(taps - 1));
      const bpm = Math.round(60_000 / mean(gaps));
      return Math.min(BPM_RANGE.max, Math.max(BPM_RANGE.min, bpm));
    },
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
