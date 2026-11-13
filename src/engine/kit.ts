// The kit: the drum voices behind one interface. The transport triggers drums
// through it and never knows how they make sound.
//
// The native kit below plays the voices in voices.ts. Each drum has its own
// mute gain; the drums sum into the master drive (gain, a soft clip with 4×
// oversampling, gain compensation) and on to the speakers. A new hh hit
// chokes the hh still ringing, as an open hat is cut by the next hat.

import { DRUMS, type Drum, type Sound } from './setup';
import { tunables } from './tunables';
import { createVoices, type Voice } from './voices';

export interface Kit {
  /**
   * Plays `drum` at `time` (seconds on the AudioContext clock) with a
   * velocity 0–1 and the drum's sound parameters. The hit draws its own
   * drift offsets. An accent on hh opens the hat as far as the sound's
   * accent asks. An hh hit chokes the hh hit before it from its own start,
   * so hh hits come in time order, as the scheduler triggers them.
   */
  trigger<D extends Drum>(drum: D, time: number, velocity: number, sound: Sound[D], accent?: boolean): void;
  /**
   * Cancels every hit triggered for a time after `from` (seconds on the
   * context clock; now when left out). Hits are judged by the time they were
   * triggered for, not by their drifted start, so a caller that queues again
   * from the same `from` neither loses nor doubles a hit. Hits already
   * sounding ring out, and a cancelled hh hit no longer chokes the one before it.
   */
  cancelScheduled(from?: number): void;
  /** Mutes or unmutes a drum at once: a gain on the drum's bus, so it also silences a hit already sounding. */
  setMuted(drum: Drum, muted: boolean): void;
  /** Sets drift (a byte) for the hits triggered from now on. */
  setDrift(drift: number): void;
  /**
   * Sets the master drive (a byte) from `time` (seconds on the context
   * clock; now when left out), hits already sounding included, and cancels
   * any drive change set for after it. Asking for the drive the kit already
   * has, or is set to reach, changes nothing.
   */
  setDrive(drive: number, time?: number): void;
}

/** Drift and drive the kit starts with, bytes. Both default to 0. */
export interface KitOptions {
  drift?: number;
  drive?: number;
}

/** Time constant of a mute or unmute, in seconds: at once, without a click. */
const MUTE_TIME_CONSTANT = 0.005;

/** Time constant of a drive change, in seconds: follows a slider without zipper noise. */
const DRIVE_TIME_CONSTANT = 0.02;

/** Points in the drive curve. Odd, so input 0 maps exactly to 0. */
const DRIVE_CURVE_POINTS = 32769;

/**
 * The input level the drive curve reaches before it holds at full scale:
 * twice the loudest sum at the most drive, so the clip never turns hard.
 */
const DRIVE_HEADROOM = 2 * 10 ** (tunables.kit.drive.maxGainDb / 20);

/** Where the soft clip levels off, just under full scale: room for the oversampling filter's overshoot. */
const DRIVE_CEILING = 0.95;

/** Linear up to the knee, then bending smoothly towards ±DRIVE_CEILING. */
function softClip(x: number): number {
  const { knee } = tunables.kit.drive;
  const level = Math.abs(x);
  if (level <= knee) return x;
  const bend = DRIVE_CEILING - knee;
  return Math.sign(x) * (knee + bend * Math.tanh((level - knee) / bend));
}

/** The soft clip over ±DRIVE_HEADROOM, squeezed into the shaper's ±1 input. */
function driveCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(DRIVE_CURVE_POINTS);
  for (let i = 0; i < DRIVE_CURVE_POINTS; i++) {
    curve[i] = softClip(((2 * i) / (DRIVE_CURVE_POINTS - 1) - 1) * DRIVE_HEADROOM);
  }
  return curve;
}

/**
 * Gains in front of and after the clip for a drive byte. The cut after the
 * clip follows the gain in front while the clip is gentle and levels off at
 * `compensationDb`, as the clip caps how much louder the kit can get.
 */
function driveGains(drive: number): { input: number; output: number } {
  const { maxGainDb, compensationDb } = tunables.kit.drive;
  const gainDb = (drive / 255) * maxGainDb;
  const cutDb = compensationDb * Math.tanh(gainDb / compensationDb);
  return {
    input: 10 ** (gainDb / 20) / DRIVE_HEADROOM,
    output: 10 ** (-cutDb / 20),
  };
}

/** A uniform random number in −1 to 1. */
function spread(): number {
  return Math.random() * 2 - 1;
}

/** A hit the kit started that has not ended yet. */
interface Sounding {
  drum: Drum;
  voice: Voice;
  /** The time the hit was triggered for, which cancelling judges by. */
  time: number;
  /** The gain the voice plays through, which a choke fades out. */
  gate: GainNode;
  /** When a later hh hit chokes it: that hit's start, drift included. */
  chokedAt?: number;
}

/** When a hit has ended: at the end of its voice, or once its choke has faded out. */
function endOf({ voice, chokedAt }: Sounding): number {
  return chokedAt === undefined ? voice.end : Math.min(voice.end, chokedAt + tunables.kit.hh.chokeFade);
}

/**
 * Fades the hit out over the choke fade from `at`. The gate holds 1 until
 * then. These are the only events on the gate, so a cancel can take them
 * back with `cancelScheduledValues`, without `cancelAndHoldAtTime`, which
 * Firefox does not support reliably.
 */
function choke(hit: Sounding, at: number): void {
  hit.gate.gain.setValueAtTime(1, at);
  hit.gate.gain.linearRampToValueAtTime(0, at + tunables.kit.hh.chokeFade);
  hit.chokedAt = at;
}

/** Takes a choke back: the hit rings on as if the hit that choked it was never triggered. */
function unchoke(hit: Sounding): void {
  if (hit.chokedAt === undefined) return;
  hit.gate.gain.cancelScheduledValues(hit.chokedAt);
  hit.chokedAt = undefined;
}

export function createNativeKit(context: BaseAudioContext, options: KitOptions = {}): Kit {
  const gains = driveGains(options.drive ?? 0);
  const driveOutput = new GainNode(context, { gain: gains.output });
  const shaper = new WaveShaperNode(context, { curve: driveCurve(), oversample: '4x' });
  const driveInput = new GainNode(context, { gain: gains.input });
  const mix = new GainNode(context, { gain: tunables.kit.mix });
  mix.connect(driveInput).connect(shaper).connect(driveOutput).connect(context.destination);

  const buses = {} as Record<Drum, GainNode>;
  for (const drum of DRUMS) {
    buses[drum] = new GainNode(context);
    buses[drum].connect(mix);
  }

  const voices = createVoices(context);
  let drift = options.drift ?? 0;
  let drive = options.drive ?? 0;
  /**
   * Hits that have not ended, in the order they were triggered. The last hh
   * among them is the one ringing, which the next hh hit chokes.
   */
  let sounding: Sounding[] = [];

  return {
    trigger(drum, time, velocity, sound, accent = false) {
      // Forget hits that have ended; cancelling and choking only need the ones still sounding or ahead.
      sounding = sounding.filter((hit) => endOf(hit) > context.currentTime);
      const amount = drift / 255;
      const max = tunables.kit.drift;
      const start = time + Math.random() * amount * max.timing;
      const voice = voices[drum](
        {
          time: start,
          gain: velocity * 10 ** ((spread() * amount * max.levelDb) / 20),
          detune: spread() * amount * max.pitchCents,
          decay: 1 + spread() * amount * max.decay,
          cutoff: spread() * amount * max.cutoffCents,
          noise: Math.random() * amount,
          accent,
        },
        sound,
      );
      const gate = new GainNode(context);
      voice.output.connect(gate).connect(buses[drum]);
      if (drum === 'hh') {
        const ringing = sounding.findLast((hit) => hit.drum === 'hh');
        if (ringing && endOf(ringing) > start) choke(ringing, start);
      }
      sounding.push({ drum, voice, time, gate });
    },
    cancelScheduled(from = context.currentTime) {
      for (const { voice, time } of sounding) if (time > from) voice.output.disconnect();
      sounding = sounding.filter(({ time }) => time <= from);
      // The ringing hh is now the last one kept, so the hits the looper hands
      // out again choke it, never a cancelled one. If it was choked, the hit
      // that did it came later and was cancelled: it rings on until the next
      // hh hit triggered.
      const ringing = sounding.findLast((hit) => hit.drum === 'hh');
      if (ringing) unchoke(ringing);
    },
    setMuted(drum, muted) {
      const { gain } = buses[drum];
      const now = context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(muted ? 0 : 1, now, MUTE_TIME_CONSTANT);
    },
    setDrift(value) {
      drift = value;
    },
    setDrive(value, time = context.currentTime) {
      if (value === drive) return;
      drive = value;
      const { input, output } = driveGains(value);
      driveInput.gain.cancelScheduledValues(time);
      driveOutput.gain.cancelScheduledValues(time);
      driveInput.gain.setTargetAtTime(input, time, DRIVE_TIME_CONSTANT);
      driveOutput.gain.setTargetAtTime(output, time, DRIVE_TIME_CONSTANT);
    },
  };
}
