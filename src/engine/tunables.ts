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
    // hh accent 0: an accent only makes the hat louder and the hat stays closed.
    sound: {
      bd: { freq: 128, punch: 156, tone: 117, decay: 148, level: 179 },
      sd: { freq: 128, tone: 128, snappy: 140, decay: 117, level: 143 },
      hh: { accent: 0, level: 112 },
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

  /**
   * How long a resume after an interruption may stay pending before the pad
   * asks for `tap to resume`, in ms. Some browsers leave a refused resume
   * pending instead of rejecting it. About 1 s: a resume that works is done
   * well before, and the player is not left long with silent controls.
   */
  resumeWait: 1000,

  /** How hard the transport triggers a drum, 0–1, tuned by ear with the kit. */
  velocity: {
    /** A plain hit: about 0.7, so accents stand out. */
    hit: 0.7,
    /** An accent (map level above 192): full velocity. */
    accent: 1,
  },

  /**
   * How many steps a new pad target takes to reach. The position moves on
   * every step, starting with the first after the jump, so 2 is the shortest
   * glide (one point halfway) and 3 passes through two points on the way.
   * 1 would be a hard jump, which the glide test rules out. About 2.
   */
  glideSteps: 2,

  /** The looper, tuned by feel. */
  looper: {
    /**
     * Steps at the end of a beat whose touch counts for the next beat, so a
     * touch a hair early for the next downbeat still loops it: step 15 loops
     * from step 16, step 31 the next bar's first beat. 0 turns the grace off;
     * below 8. About 1.
     */
    graceSteps: 1,
  },

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

  /**
   * Strips: sliders that move relative to a touch; a mouse click on the track
   * sets the value there. Tuned by feel on the acceptance devices.
   */
  strips: {
    /**
     * Travel in CSS px before a relative drag moves a strip's value, so a tap
     * never changes it: a touch or pen anywhere, a mouse on the thumb, the
     * label or the value. About 4 px: under a thumb's wobble, too little to
     * notice when dragging. A mouse press on the track off the thumb sets
     * the value at once, with no threshold.
     */
    dragThreshold: 4,
  },

  /** Arrow-key nudges on the pad, tuned by feel on the laptop. */
  keyboard: {
    /** Pad bytes per arrow press: 1/8 of the gap between map nodes, about 3 on the 0–100 readout. */
    nudgeStep: 8,
    /** Pad bytes per shift + arrow press: about ¼ of a nudge, like fine adjust on the pad. */
    fineNudgeStep: 2,
    /** Milliseconds with no arrow held after which a run of nudges ends as one pad move. About 500 ms. */
    nudgeRunGap: 500,
  },

  /** The header's − and + for tempo repeat while held. Tuned by feel. */
  repeat: {
    /** Milliseconds from the press to the first repeat. About 400 ms, so a tap never repeats. */
    delay: 400,
    /** Milliseconds between repeats after that. About 80 ms: 128 to 172 bpm in about 4 s. */
    interval: 80,
  },

  /** Tap tempo, tuned by feel. */
  tapTempo: {
    /** The tempo is the average over this many most recent taps. About 4, one bar of beats. */
    taps: 4,
    /**
     * A gap this many times longer or shorter than the running average
     * starts a new average, so a deliberate tempo change takes at once
     * instead of blending in over the next taps. About 1.5.
     */
    outlierRatio: 1.5,
    /** A gap longer than this many ms starts over: that tap is a first tap. About 2 s, twice the beat at 60 bpm. */
    restartGap: 2000,
  },

  /**
   * The play screen's layouts (`src/ui/layout.ts`), picked by its size: the
   * browser viewport less the safe areas (100dvh less the home indicator,
   * and the status bar when standalone), in CSS px, not the device screen.
   * At least `wideMinWidth` wide and `wideMinHeight` tall, it has two
   * columns: the tablet layout in portrait, the laptop layout in landscape
   * (tablets in landscape too). Short of either, a portrait screen gets a
   * phone layout by its height and a landscape one the rotate hint; a phone
   * layout tall enough stacks its groups instead of tabbing them
   * (`stackedPadMinShape`). Starting points until the design pass measures
   * the acceptance devices: Safari leaves about 660–750 px on a current
   * iPhone and about 553 px on an SE.
   */
  layouts: {
    /**
     * About 700 px wide (design.md): iPads in portrait (744–1024) get two
     * columns; phones, in portrait or landscape, do not.
     */
    wideMinWidth: 700,
    /**
     * About 580 px tall: what the laptop layout's right column needs with the
     * sound folded into the drum tabs and no gaps between its rows. Phones in
     * landscape (320–430 px tall) stay under it and get the rotate hint;
     * laptop windows under a taskbar or at 150 % scaling stay above it.
     */
    wideMinHeight: 580,
    /**
     * About 700 px tall: what the laptop layout's right column needs for the
     * three sound sections side by side (step display, strips, tempo, loop
     * strip and the sound sections, in 44 px rows) under the header and over
     * the bottom row. A shorter laptop window folds them into the drum tabs.
     */
    soundSectionsMinHeight: 700,
    /**
     * The laptop layout in a window larger than it was designed for: every
     * size in the layout grows by min(width / designSize.width, height /
     * designSize.height), so a large screen reads from a distance. The size
     * is the browser window's outer size less its toolbar, as measured, which
     * browser zoom leaves alone in Chrome and Safari, so Cmd + enlarges the
     * layout further. Never below 1, at most maxZoom, and never more than
     * the play screen holds: the layout needs fitWidth ×
     * soundSectionsMinHeight at zoom 1 (the 1024×700 e2e test), and then
     * fits at any zoom. A window with the sound folded never zooms. When the
     * right column grows, raise soundSectionsMinHeight and designSize.height.
     */
    laptopZoom: {
      /** The design.md laptop, 1280×800. */
      designSize: { width: 1280, height: 800 },
      /** About 2: a 4K window does not get giant text. */
      maxZoom: 2,
      /**
       * 1024: an iPad in landscape, the narrowest unfolded laptop window the
       * e2e tests check; narrower ones (down to wideMinWidth) stay at zoom 1.
       */
      fitWidth: 1024,
    },
    /**
     * The shortest the pad gets above the compact layout, and so the phone
     * breakpoint: the phone layout starts where its rows leave the pad this
     * much. With 200, the phone layout (444 px of rows) starts at 644 px;
     * below that, the compact layout (352 px) takes over. About 200 px.
     * design.md asks for about 240, which does not fit with 44 px rows: 553 px
     * leaves the compact pad 201 px, and a 240 px pad in the phone layout
     * needs 684 px, more than 393×659 has.
     */
    padMinHeight: 200,
    /**
     * The pad's height ÷ width below which the phone layout keeps its tabs:
     * with 1, a phone-width window stacks mix, fx and tempo (and the sound
     * sections) only where the pad stays at least square under them. Tall
     * enough means about 1100 px at 375 wide, 1120 at 393, 1280 at 550 and
     * 1430 at 699, so no phone in Safari (660–750 px) stacks; a desktop window
     * or a tall foldable does. Lower it to stack sooner with a flatter pad.
     */
    stackedPadMinShape: 1,
  },

  /**
   * The native kit's voices, drift and drive. Starting points for the kit
   * tuning issue, to be set by ear on the acceptance devices; the sound is
   * heading towards hard techno. Byte parameters (0–255) map onto the
   * `{ min, max }` ranges below exponentially: equal byte steps are equal
   * ratios, so the middle of a range sits at its geometric middle.
   */
  kit: {
    /** Gain on the sum of the drums, before drive. About 0.6: a loud default bar peaks under the drive's knee. */
    mix: 0.6,

    /** A level byte maps to gain as (level / 255) ^ levelCurve. 2 puts 50 % at about −12 dB. */
    levelCurve: 2,

    /** bd: a sine with a falling pitch, saturated and low-passed. */
    bd: {
      /** Gain at full level and velocity, to balance bd against sd and hh. */
      gain: 1,
      /** freq: the pitch the kick settles on, in Hz. About 30–90 Hz, centre about 52 Hz. */
      freq: { min: 30, max: 90 },
      /** punch: how far above `freq` the pitch starts, in semitones at punch 255. About 3 octaves. */
      sweep: 36,
      /** Time constant of the pitch fall, in seconds. About 12 ms: a click, then the body. */
      sweepTime: 0.012,
      /** tone: low-pass cutoff on the saturated body, in Hz. */
      tone: { min: 80, max: 5000 },
      /** decay: seconds until the kick is silent (−80 dB). */
      decay: { min: 0.08, max: 1.5 },
      /** Soft saturation inside the voice: the tanh drive at full amplitude. About 2. */
      saturation: 2,
    },

    /** sd: two tuned body modes plus filtered noise. */
    sd: {
      /** Gain at full level and velocity. */
      gain: 1,
      /** freq: the lower body mode, in Hz. Centre about 220 Hz. */
      freq: { min: 120, max: 400 },
      /**
       * The two body modes: frequency ratio to `freq`, and level at tone 0
       * (`dark`) and tone 255 (`bright`), mixed linearly in between.
       */
      modes: [
        { ratio: 1, dark: 1, bright: 0.5 },
        { ratio: 1.62, dark: 0.2, bright: 0.7 },
      ],
      /** Semitones the body modes start above their pitch. About 4: a short knock. */
      sweep: 4,
      /** Time constant of that pitch fall, in seconds. */
      sweepTime: 0.008,
      /** decay: seconds until the body is silent (−80 dB). */
      decay: { min: 0.06, max: 0.6 },
      /** The noise lasts this many times the body decay. */
      noiseDecay: 1.4,
      /** High-pass on the noise, in Hz, so it never muddies the body. */
      noiseHighpass: 1200,
      /** tone: low-pass on the noise, in Hz. */
      noiseTone: { min: 2500, max: 12000 },
      /** snappy: noise level at snappy 255, relative to the body. */
      noiseLevel: 1.6,
    },

    /** hh: six detuned square oscillators through band-pass and high-pass. */
    hh: {
      /** Gain at full level and velocity. The filters keep little of the squares, so it is high. */
      gain: 3,
      /** The six square oscillators, in Hz: inharmonic ratios, so together they ring metallic. */
      oscillators: [205.3, 304.4, 369.6, 522.7, 540, 800],
      /** Band-pass centre in Hz, and its Q. */
      bandpass: 10000,
      bandpassQ: 1,
      /** High-pass after it, in Hz. */
      highpass: 7000,
      /** Seconds until a closed hat is silent (−80 dB): every plain hit, and every hit at accent 0. About 90 ms. */
      decay: 0.09,
      /**
       * Seconds until an accented hit at accent 255 is silent: a fully open
       * hat. About 0.5 s, to set by ear in the kit tuning issue. In between,
       * the accent byte maps from `decay` to this exponentially, like the
       * other byte parameters.
       */
      openDecay: 0.5,
      /**
       * Seconds a choke takes to fade out the hat still ringing when the next
       * hh hit starts. About 5 ms: the cut is heard at once, without a click.
       */
      chokeFade: 0.005,
    },

    /**
     * Drift: per-hit random offsets, each scaled by drift / 255. These are the
     * offsets at drift 255; every hit draws its own, uniformly within ±max
     * (timing: 0 to max late, so a hit is never early).
     */
    drift: {
      /** Pitch, in cents. */
      pitchCents: 35,
      /** Decay, as a fraction of the decay time. */
      decay: 0.25,
      /** Level, in dB. */
      levelDb: 2.5,
      /** Timing, in seconds late. 2 ms. */
      timing: 0.002,
      /** Filter cutoffs, in cents. */
      cutoffCents: 400,
    },

    /**
     * Drive: the sum of the drums goes through gain, a soft clip and a gain
     * compensation. The clip is linear up to the knee and bends smoothly to
     * just under full scale above it, so drive 0 is clean below the knee.
     */
    drive: {
      /** Gain in front of the clip at drive 255, in dB. Drive 0 is 0 dB; in between is linear in dB. */
      maxGainDb: 24,
      /**
       * Gain compensation after the clip, so drive does not make the kit much
       * louder: the cut is compensationDb × tanh(gain in dB / compensationDb),
       * which follows the drive gain at first and levels off near this many dB.
       * About 22 keeps the default bar within about 1 dB across the drive range.
       */
      compensationDb: 22,
      /** Level where the soft clip starts to bend, 0–1. */
      knee: 0.5,
      /** Most a one-bar render at drive 255 may differ in RMS from drive 0, in dB (checked by the kit render test). */
      loudnessToleranceDb: 3,
    },
  },
};
