// The native kit's voices: bd, sd and hh as small Web Audio graphs, one
// graph per hit. Structure and parameter names start from the drums in
// Peaks by Émilie Gillet (see handover-grids-peaks.md); every range and
// amount comes from the kit tunables.

import type { Drum, Sound } from './setup';
import { tunables } from './tunables';

/** One hit as a voice plays it, its drift offsets already drawn. */
export interface VoiceHit {
  /** When the hit starts, in seconds on the context clock. */
  time: number;
  /** Peak gain before the drum's level: velocity and level drift. */
  gain: number;
  /** Pitch offset, in cents. */
  detune: number;
  /** Decay time multiplier: 1 is the decay the sound asks for. */
  decay: number;
  /** Filter cutoff offset, in cents. */
  cutoff: number;
  /** Where to start reading the noise, as a fraction 0–1 of its length. */
  noise: number;
  /** An accent: on hh it opens the hat as far as the sound's accent asks. */
  accent: boolean;
}

/** A started voice: its output, cut to cancel it, and when it ends. */
export interface Voice {
  output: AudioNode;
  end: number;
}

export type Voices = { [D in Drum]: (hit: VoiceHit, sound: Sound[D]) => Voice };

/** Exponential envelopes end here rather than at 0, which they cannot reach. */
const SILENT = 0.0001;

/** Points in the bd saturation curve. Odd, so input 0 maps exactly to 0. */
const SATURATION_POINTS = 4097;

/** Maps a byte onto a range exponentially: equal byte steps are equal ratios. */
function byteToRange(byte: number, { min, max }: { min: number; max: number }): number {
  return min * (max / min) ** (byte / 255);
}

/** Gain of a level byte. */
function levelGain(level: number): number {
  return (level / 255) ** tunables.kit.levelCurve;
}

/** A tanh curve normalised so full scale in is full scale out. */
function saturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(SATURATION_POINTS);
  for (let i = 0; i < SATURATION_POINTS; i++) {
    const x = (2 * i) / (SATURATION_POINTS - 1) - 1;
    curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
  }
  return curve;
}

/**
 * One second of white noise for sd. Always the same noise, from a fixed seed,
 * so that at drift 0 every hit is identical.
 */
function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  const buffer = new AudioBuffer({ length: context.sampleRate, sampleRate: context.sampleRate });
  const data = buffer.getChannelData(0);
  // xorshift32
  let state = 0x2545f491;
  for (let i = 0; i < data.length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    data[i] = (state >>> 0) / 0x80000000 - 1;
  }
  return buffer;
}

export function createVoices(context: BaseAudioContext): Voices {
  const noise = noiseBuffer(context);
  const saturation = saturationCurve(tunables.kit.bd.saturation);

  /** A gain that jumps to 1 at `time` and decays to silence over `decay` seconds. */
  function envelope(time: number, decay: number): GainNode {
    const gain = new GainNode(context, { gain: 0 });
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(SILENT, time + decay);
    return gain;
  }

  /** An oscillator from `time` to `end` that starts `sweep` semitones high and falls to `frequency`. */
  function sweptOscillator(
    type: OscillatorType,
    frequency: number,
    detune: number,
    sweep: number,
    sweepTime: number,
    time: number,
    end: number,
  ): OscillatorNode {
    const oscillator = new OscillatorNode(context, { type, frequency, detune });
    oscillator.frequency.setValueAtTime(frequency * 2 ** (sweep / 12), time);
    oscillator.frequency.setTargetAtTime(frequency, time, sweepTime);
    oscillator.start(time);
    oscillator.stop(end);
    return oscillator;
  }

  function filter(type: BiquadFilterType, frequency: number, detune: number, Q?: number): BiquadFilterNode {
    return new BiquadFilterNode(context, { type, frequency, detune, ...(Q === undefined ? {} : { Q }) });
  }

  // bd: punch sets how high the pitch starts, tone the low-pass on the
  // saturated body, decay how long it rings.
  function bd(hit: VoiceHit, sound: Sound['bd']): Voice {
    const t = tunables.kit.bd;
    const { time } = hit;
    const decay = byteToRange(sound.decay, t.decay) * hit.decay;
    const end = time + decay;
    const output = new GainNode(context, { gain: hit.gain * levelGain(sound.level) * t.gain });
    sweptOscillator('sine', byteToRange(sound.freq, t.freq), hit.detune, (t.sweep * sound.punch) / 255, t.sweepTime, time, end)
      .connect(envelope(time, decay))
      .connect(new WaveShaperNode(context, { curve: saturation }))
      .connect(filter('lowpass', byteToRange(sound.tone, t.tone), hit.cutoff))
      .connect(output);
    return { output, end };
  }

  // sd: freq tunes the two body modes, tone moves the balance to the upper
  // mode and opens the noise, snappy is the noise level, decay the length.
  function sd(hit: VoiceHit, sound: Sound['sd']): Voice {
    const t = tunables.kit.sd;
    const { time } = hit;
    const tone = sound.tone / 255;
    const decay = byteToRange(sound.decay, t.decay) * hit.decay;
    const noiseDecay = decay * t.noiseDecay;
    const end = time + Math.max(decay, noiseDecay);
    const output = new GainNode(context, { gain: hit.gain * levelGain(sound.level) * t.gain });
    const frequency = byteToRange(sound.freq, t.freq);
    for (const mode of t.modes) {
      sweptOscillator('sine', frequency * mode.ratio, hit.detune, t.sweep, t.sweepTime, time, end)
        .connect(envelope(time, decay))
        .connect(new GainNode(context, { gain: mode.dark + (mode.bright - mode.dark) * tone }))
        .connect(output);
    }
    const source = new AudioBufferSourceNode(context, { buffer: noise, loop: true });
    source.start(time, hit.noise * noise.duration);
    source.stop(end);
    source
      .connect(filter('highpass', t.noiseHighpass, hit.cutoff))
      .connect(filter('lowpass', byteToRange(sound.tone, t.noiseTone), hit.cutoff))
      .connect(envelope(time, noiseDecay))
      .connect(new GainNode(context, { gain: (t.noiseLevel * sound.snappy) / 255 }))
      .connect(output);
    return { output, end };
  }

  // hh: the metallic cluster of six squares, filtered to its top end. A
  // plain hit is a closed hat; an accent rings longer as accent goes up, to
  // a fully open hat at 255.
  function hh(hit: VoiceHit, sound: Sound['hh']): Voice {
    const t = tunables.kit.hh;
    const { time } = hit;
    const decay = hit.accent ? byteToRange(sound.accent, { min: t.decay, max: t.openDecay }) : t.decay;
    const end = time + decay * hit.decay;
    const output = new GainNode(context, { gain: hit.gain * levelGain(sound.level) * t.gain });
    const metal = new GainNode(context, { gain: 1 / t.oscillators.length });
    for (const frequency of t.oscillators) {
      const oscillator = new OscillatorNode(context, { type: 'square', frequency, detune: hit.detune });
      oscillator.start(time);
      oscillator.stop(end);
      oscillator.connect(metal);
    }
    metal
      .connect(filter('bandpass', t.bandpass, hit.cutoff, t.bandpassQ))
      .connect(filter('highpass', t.highpass, hit.cutoff))
      .connect(envelope(time, end - time))
      .connect(output);
    return { output, end };
  }

  return { bd, sd, hh };
}
