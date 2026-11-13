// The setup: everything that defines the music (see CONTEXT.md).
// Fields and ranges follow the v1 URL format table in the PRD.
// Mutes and the anchor are not part of the setup.

import { tunables } from './tunables';

/** Inclusive range of a setup field. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

/** Most fields are one byte. The UI shows them as 0–100. */
export const BYTE_RANGE: Range = { min: 0, max: 255 };

/** Tempo in whole bpm. */
export const BPM_RANGE: Range = { min: 60, max: 200 };

/** Swing as a percentage: 50 is straight. */
export const SWING_RANGE: Range = { min: 50, max: 75 };

export type Drum = 'bd' | 'sd' | 'hh';

export const DRUMS: readonly Drum[] = ['bd', 'sd', 'hh'];

/** Per-drum voice parameters, each a byte. */
export interface BdSound {
  freq: number;
  punch: number;
  tone: number;
  decay: number;
  level: number;
}

export interface SdSound {
  freq: number;
  tone: number;
  snappy: number;
  decay: number;
  level: number;
}

export interface HhSound {
  /** How far an accented hit opens the hat: 0 keeps it closed, only louder; 255 opens it fully. */
  accent: number;
  level: number;
}

export interface Sound {
  bd: BdSound;
  sd: SdSound;
  hh: HhSound;
}

export interface Setup {
  /** Pad position, bytes. */
  x: number;
  y: number;
  chaos: number;
  density: Record<Drum, number>;
  sound: Sound;
  drift: number;
  drive: number;
  /** Whole bpm, in BPM_RANGE. */
  bpm: number;
  /** Percentage, in SWING_RANGE. */
  swing: number;
}

/** A fresh copy of the default setup, so callers can change it freely. */
export function defaultSetup(): Setup {
  return structuredClone(tunables.initialSetup);
}
