// URL codec: the setup to and from the URL hash, so a link shares a groove.
// The hash is a version tag and base64url bytes: `v1.` plus 21 bytes in the
// order of the v1 URL format table in the PRD. That order is fixed, because
// links already shared depend on it. Mutes and the anchor are not part of the
// setup, so they are not in the hash.
//
// A later version appends fields under a new tag: give it its own decoder in
// `decoders`, let `encodeSetup` write it, and keep the older decoders so old
// links still open. Writing the hash into the address bar is not done here.

import { BPM_RANGE, BYTE_RANGE, SWING_RANGE, defaultSetup, type Range, type Setup } from './setup';

/** The setup as a hash for the address bar, without the leading `#`. */
export function encodeSetup(setup: Setup): string {
  const bytes = Uint8Array.from(v1Bytes(setup), (value) => clamp(Math.round(value), BYTE_RANGE));
  return `v1.${toBase64url(bytes)}`;
}

/**
 * The setup a hash holds, with or without the leading `#` that
 * `location.hash` carries. An empty hash, an unknown version or a malformed
 * payload gives the default setup.
 */
export function decodeSetup(hash: string): Setup {
  const { version = '', payload = '' } = HASH_FORMAT.exec(hash)?.groups ?? {};
  const decoder = decoders.get(version);
  const bytes = fromBase64url(payload);
  return (decoder && bytes && decoder(bytes)) ?? defaultSetup();
}

const HASH_FORMAT = /^#?(?<version>v\d+)\.(?<payload>[A-Za-z0-9_-]*)$/;

/** One decoder per version; each returns undefined for a payload it cannot read. */
const decoders: ReadonlyMap<string, (bytes: Uint8Array) => Setup | undefined> = new Map([
  ['v1', fromV1Bytes],
]);

/** The setup in the v1 byte order, one entry per byte. */
function v1Bytes(setup: Setup): number[] {
  const { density, sound } = setup;
  return [
    setup.x,
    setup.y,
    setup.chaos,
    density.bd,
    density.sd,
    density.hh,
    sound.bd.freq,
    sound.bd.punch,
    sound.bd.tone,
    sound.bd.decay,
    sound.bd.level,
    sound.sd.freq,
    sound.sd.tone,
    sound.sd.snappy,
    sound.sd.decay,
    sound.sd.level,
    sound.hh.level,
    setup.drift,
    setup.drive,
    setup.bpm,
    setup.swing,
  ];
}

const V1_LENGTH = 21;

function fromV1Bytes(bytes: Uint8Array): Setup | undefined {
  if (bytes.length !== V1_LENGTH) return undefined;
  // The length check above makes every index below present.
  const at = (index: number): number => bytes[index] as number;
  return {
    x: at(0),
    y: at(1),
    chaos: at(2),
    density: { bd: at(3), sd: at(4), hh: at(5) },
    sound: {
      bd: { freq: at(6), punch: at(7), tone: at(8), decay: at(9), level: at(10) },
      sd: { freq: at(11), tone: at(12), snappy: at(13), decay: at(14), level: at(15) },
      hh: { level: at(16) },
    },
    drift: at(17),
    drive: at(18),
    bpm: clamp(at(19), BPM_RANGE),
    swing: clamp(at(20), SWING_RANGE),
  };
}

function clamp(value: number, range: Range): number {
  return Math.min(range.max, Math.max(range.min, value));
}

function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/**
 * Undefined when the text cannot be base64 (a length no bytes give).
 * `HASH_FORMAT` has already limited it to the base64url alphabet.
 */
function fromBase64url(text: string): Uint8Array | undefined {
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return undefined;
  }
}
