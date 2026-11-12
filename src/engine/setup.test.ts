import { describe, expect, test } from 'vitest';
import { BPM_RANGE, BYTE_RANGE, SWING_RANGE, defaultSetup, type Range } from './setup';

function byteFields(value: unknown, path: string): [string, number][] {
  if (typeof value === 'number') return [[path, value]];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) =>
    byteFields(inner, path ? `${path}.${key}` : key),
  );
}

function fits(value: number, range: Range): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}

describe('default setup', () => {
  // A tuned default outside the URL format would be clamped or rejected on
  // the next load, so the instrument would not start as tuned.
  test('every field fits the v1 URL format', () => {
    const { bpm, swing, ...bytes } = defaultSetup();
    expect(fits(bpm, BPM_RANGE), `bpm ${bpm}`).toBe(true);
    expect(fits(swing, SWING_RANGE), `swing ${swing}`).toBe(true);
    const fields = byteFields(bytes, '');
    expect(fields).toHaveLength(19);
    for (const [name, value] of fields) {
      expect(fits(value, BYTE_RANGE), `${name} ${value}`).toBe(true);
    }
  });
});
