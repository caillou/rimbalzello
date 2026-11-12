// SPDX-License-Identifier: GPL-3.0-or-later
//
// Pattern generator: turns a position on the map, the densities and the chaos
// perturbations into hits and accents for one step. Pure: it holds no state
// and draws no random numbers; the transport rolls the random bytes and
// passes the perturbations in.
//
// Ported from Grids' pattern generator (grids/pattern_generator.cc) by Émilie
// Gillet, GPL-3.0-or-later. The 8-bit arithmetic is kept as is: it decides
// the sound.

import { NODES, PLACEMENT } from './map';
import type { Drum } from './setup';

/** Steps in one pattern: 32nd notes, one bar. */
export const PATTERN_STEPS = 32;

/** A hit whose level is above this is an accent. */
const ACCENT_LEVEL = 192;

/** Where each drum's 32 levels start in a node. */
const DRUM_OFFSET: Record<Drum, number> = { bd: 0, sd: 32, hh: 64 };

export interface PatternInput {
  /** Position on the pad, bytes. Out-of-range values are clamped. */
  x: number;
  y: number;
  /** Per drum, bytes. 0 never hits; 255 hits wherever the level is above 0. */
  density: Record<Drum, number>;
  /** Per drum, 0–63, from `perturbation()`. Added to the map level. */
  perturbation: Record<Drum, number>;
}

export interface DrumHit {
  hit: boolean;
  /** Only ever true on a hit. */
  accent: boolean;
}

export type StepHits = Record<Drum, DrumHit>;

function toByte(value: number): number {
  return Math.min(255, Math.max(0, value | 0));
}

/** 8-bit crossfade from a (f = 0) towards b (f = 255). Never reaches b. */
function mix(a: number, b: number, f: number): number {
  return (a * (255 - f) + b * f) >> 8;
}

function nodeLevel(i: number, j: number, offset: number): number {
  return NODES[PLACEMENT[i]?.[j] ?? 0]?.[offset] ?? 0;
}

/**
 * The map level (0–255) of a drum at a step, for a position on the pad,
 * interpolated between the four surrounding nodes.
 */
export function mapLevel(x: number, y: number, drum: Drum, step: number): number {
  const xb = toByte(x);
  const yb = toByte(y);
  const i = xb >> 6;
  const j = yb >> 6;
  // Masked to 8 bits: the fraction wraps back to 0 at each node.
  const fx = (xb << 2) & 0xff;
  const fy = (yb << 2) & 0xff;
  const offset = DRUM_OFFSET[drum] + (step & (PATTERN_STEPS - 1));
  const a = nodeLevel(i, j, offset);
  const b = nodeLevel(i + 1, j, offset);
  const c = nodeLevel(i, j + 1, offset);
  const d = nodeLevel(i + 1, j + 1, offset);
  return mix(mix(a, b, fx), mix(c, d, fx), fy);
}

/**
 * One drum's chaos perturbation (0–63) from a random byte and the chaos
 * amount. The transport rolls the byte when the playhead crosses step 0.
 */
export function perturbation(randomByte: number, chaos: number): number {
  return (randomByte * (chaos >> 2)) >> 8;
}

function drumHit(input: PatternInput, drum: Drum, step: number): DrumHit {
  const level = Math.min(255, mapLevel(input.x, input.y, drum, step) + input.perturbation[drum]);
  const hit = level > 255 - input.density[drum];
  return { hit, accent: hit && level > ACCENT_LEVEL };
}

/** Hits and accents of all three drums at one step (0–31) of the pattern. */
export function hitsAt(input: PatternInput, step: number): StepHits {
  return {
    bd: drumHit(input, 'bd', step),
    sd: drumHit(input, 'sd', step),
    hh: drumHit(input, 'hh', step),
  };
}
