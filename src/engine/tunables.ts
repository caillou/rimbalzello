// Tunables: every value tuned by ear or feel lives here, and code reads
// these values from here and nowhere else. Each value carries a comment.
// Values marked "about" are starting points to tune in the running app.

import type { Setup } from './setup';

export const tunables = {
  /**
   * The setup a fresh visitor hears, and what a broken link falls back to.
   * Bytes are 0–255; the UI shows them as 0–100. Every byte value is a
   * starting point copied from the design screenshots, to be set by ear
   * in the kit tuning issue.
   */
  initialSetup: {
    // Pad position, the X/Y readout in the screenshots.
    x: 87,
    y: 148,
    // A little chaos (34 on the strip) so the bars already vary a bit.
    chaos: 87,
    // Fills: bd 63, sd 50, hh 78 on the strips.
    density: { bd: 161, sd: 128, hh: 199 },
    // Voice parameters as shown in the sound sections of the screenshots.
    sound: {
      bd: { freq: 128, punch: 156, tone: 117, decay: 148, level: 179 },
      sd: { freq: 128, tone: 128, snappy: 140, decay: 117, level: 143 },
      hh: { level: 112 },
    },
    // Light drift (22 on the strip) so repeated hits do not sound identical.
    drift: 56,
    // Some drive on the sum (40 on the strip).
    drive: 102,
    // Default tempo in whole bpm (PRD).
    bpm: 128,
    // Light swing on by default (PRD); 54 and 58 are the fallbacks if 56 sounds wrong.
    swing: 56,
  } satisfies Setup,

  /** How far ahead the scheduler queues hits on the AudioContext, in seconds. About 100 ms. */
  lookahead: 0.1,

  /** Pad gesture thresholds, tuned by feel on the acceptance devices. */
  padGestures: {
    /** Finger travel in CSS px before a touch counts as moving. About 10 px. */
    movementThreshold: 10,
    /** Longest gap in ms from a tap's lift to the next touch-down for a double-tap. About 300 ms. */
    doubleTapWindow: 300,
    /** Furthest a double-tap's second touch may land from the tap, in CSS px. About 40 px. */
    doubleTapDistance: 40,
    /** Longest gap in ms between the first and second finger landing for a two-finger tap. About 150 ms. */
    twoFingerWindow: 150,
    /** Fine adjust moves the position by this fraction of finger travel. About ¼. */
    fineSpeed: 0.25,
  },
};
