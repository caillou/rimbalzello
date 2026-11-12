// Displayed values run 0–100; the setup stores bytes (0–255).

import { BYTE_RANGE } from '../engine/setup';

/** A stored byte as the UI shows it, 0–100. */
export function toDisplay(byte: number): number {
  return Math.round((byte / BYTE_RANGE.max) * 100);
}

/** The byte that shows as `value` (0–100). */
export function fromDisplay(value: number): number {
  return Math.round((value / 100) * BYTE_RANGE.max);
}
