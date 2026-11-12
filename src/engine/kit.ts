// The kit: the drum voices behind one interface. The transport triggers drums
// through it and never knows how they make sound.
//
// The native kit below plays the voices in voices.ts. Each drum has its own
// mute gain; the drums sum into the master drive (gain, a soft clip with 4×
// oversampling, gain compensation) and on to the speakers.

import { DRUMS, type Drum, type Sound } from './setup';
import { tunables } from './tunables';
import { createVoices, type Voice } from './voices';

export interface Kit {
  /**
   * Plays `drum` at `time` (seconds on the AudioContext clock) with a
   * velocity 0–1 and the drum's sound parameters. The hit draws its own
   * drift offsets.
   */
  trigger<D extends Drum>(drum: D, time: number, velocity: number, sound: Sound[D]): void;
  /** Cancels every hit scheduled but not yet started. Hits already sounding ring out. */
  cancelScheduled(): void;
  /** Mutes or unmutes a drum at once: a gain on the drum's bus, so it also silences a hit already sounding. */
  setMuted(drum: Drum, muted: boolean): void;
  /** Sets drift (a byte) for the hits triggered from now on. */
  setDrift(drift: number): void;
  /** Sets the master drive (a byte) at once, hits already sounding included. */
  setDrive(drive: number): void;
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
  let sounding: Voice[] = [];

  return {
    trigger(drum, time, velocity, sound) {
      // Forget voices that have ended; cancelling only needs the ones still ahead.
      sounding = sounding.filter((voice) => voice.end > context.currentTime);
      const amount = drift / 255;
      const max = tunables.kit.drift;
      const voice = voices[drum](
        {
          time: time + Math.random() * amount * max.timing,
          gain: velocity * 10 ** ((spread() * amount * max.levelDb) / 20),
          detune: spread() * amount * max.pitchCents,
          decay: 1 + spread() * amount * max.decay,
          cutoff: spread() * amount * max.cutoffCents,
          noise: Math.random() * amount,
        },
        sound,
      );
      voice.output.connect(buses[drum]);
      sounding.push(voice);
    },
    cancelScheduled() {
      const now = context.currentTime;
      for (const voice of sounding) if (voice.start > now) voice.output.disconnect();
      sounding = sounding.filter((voice) => voice.start <= now);
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
    setDrive(drive) {
      const { input, output } = driveGains(drive);
      const now = context.currentTime;
      driveInput.gain.setTargetAtTime(input, now, DRIVE_TIME_CONSTANT);
      driveOutput.gain.setTargetAtTime(output, now, DRIVE_TIME_CONSTANT);
    },
  };
}
