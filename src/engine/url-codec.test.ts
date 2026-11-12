import { describe, expect, test } from 'vitest';
import { BPM_RANGE, BYTE_RANGE, SWING_RANGE, defaultSetup, type Range, type Setup } from './setup';
import { decodeSetup, encodeSetup } from './url-codec';

// A v1 link as shared today. Its bytes are 10, 11, …, 28 for the 19 byte
// fields, then bpm 140 and swing 70.
const LINK = 'v1.CgsMDQ4PEBESExQVFhcYGRobHIxG';
const LINK_BYTES = [...Array.from({ length: 19 }, (_, i) => 10 + i), 140, 70];
const LINK_SETUP: Setup = {
  x: 10,
  y: 11,
  chaos: 12,
  density: { bd: 13, sd: 14, hh: 15 },
  sound: {
    bd: { freq: 16, punch: 17, tone: 18, decay: 19, level: 20 },
    sd: { freq: 21, tone: 22, snappy: 23, decay: 24, level: 25 },
    hh: { level: 26 },
  },
  drift: 27,
  drive: 28,
  bpm: 140,
  swing: 70,
};

/** A v1 hash built straight from bytes, bypassing the encoder. */
function v1Hash(bytes: readonly number[]): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return `v1.${base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;
}

/** The range each v1 byte may hold, by position. */
function rangeAt(index: number): Range {
  if (index === 19) return BPM_RANGE;
  if (index === 20) return SWING_RANGE;
  return BYTE_RANGE;
}

/** The link's bytes with one field changed, for every value of every field. */
function* everyValueOfEveryField(): Generator<number[]> {
  for (let index = 0; index < LINK_BYTES.length; index++) {
    const { min, max } = rangeAt(index);
    for (let value = min; value <= max; value++) {
      yield LINK_BYTES.with(index, value);
    }
  }
}

describe('url codec', () => {
  // Reordering the bytes would make every shared link open a different groove.
  test('each byte of a v1 link lands in the field the PRD table names', () => {
    expect(v1Hash(LINK_BYTES)).toBe(LINK);
    expect(decodeSetup(LINK)).toEqual(LINK_SETUP);
    expect(encodeSetup(LINK_SETUP)).toBe(LINK);
  });

  test('every valid setup round-trips exactly', () => {
    expect(decodeSetup(encodeSetup(defaultSetup()))).toEqual(defaultSetup());
    // Each byte value passes through every position of the base64url text.
    for (const bytes of everyValueOfEveryField()) {
      const setup = decodeSetup(v1Hash(bytes));
      expect(encodeSetup(setup)).toBe(v1Hash(bytes));
      expect(decodeSetup(encodeSetup(setup))).toEqual(setup);
    }
  });

  test('a hash read from location.hash, with its #, decodes the same', () => {
    expect(decodeSetup(`#${LINK}`)).toEqual(LINK_SETUP);
  });

  test.each([
    { field: 'bpm', index: 19, stored: 30, expected: 60 },
    { field: 'bpm', index: 19, stored: 250, expected: 200 },
    { field: 'swing', index: 20, stored: 40, expected: 50 },
    { field: 'swing', index: 20, stored: 90, expected: 75 },
  ])('$field $stored in a link clamps to $expected', ({ field, index, stored, expected }) => {
    const link = v1Hash(LINK_BYTES.with(index, stored));
    expect(decodeSetup(link)).toEqual({ ...LINK_SETUP, [field]: expected });
  });

  test.each([
    ['20 bytes', v1Hash(LINK_BYTES.slice(0, 20))],
    ['22 bytes', v1Hash([...LINK_BYTES, 0])],
    ['a character outside base64url', LINK.replace('C', '+')],
    ['a base64 length no bytes give', `${LINK}A`],
    ['an unknown version', LINK.replace('v1.', 'v9.')],
    ['an empty hash', ''],
  ])('%s gives the default setup', (_, hash) => {
    expect(decodeSetup(hash)).toEqual(defaultSetup());
  });
});
