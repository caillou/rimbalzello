// The kit: the drum voices behind one interface. The transport triggers drums
// through it and never knows how they make sound.
//
// The native kit below is the tracer's: minimal Web Audio voices for bd, sd
// and hh, each drum on its own mute gain, summing into a master gain. The kit
// voices issue replaces the voices behind the same interface.

import { DRUMS, type Drum, type Sound } from './setup';

export interface Kit {
  /**
   * Plays `drum` at `time` (seconds on the AudioContext clock) with a
   * velocity 0–1 and the drum's sound parameters.
   */
  trigger<D extends Drum>(drum: D, time: number, velocity: number, sound: Sound[D]): void;
  /** Cancels every hit scheduled but not yet started. Hits already sounding ring out. */
  cancelScheduled(): void;
  /** Mutes or unmutes a drum at once: a gain on the drum's bus, so it also silences a hit already sounding. */
  setMuted(drum: Drum, muted: boolean): void;
}

/** Gain on the sum of all drums, so three loud hits together stay well below clipping. */
const MASTER_GAIN = 0.5;

/** Time constant of a mute or unmute, in seconds: at once, without a click. */
const MUTE_TIME_CONSTANT = 0.005;

/** Exponential envelopes end here rather than at 0, which they cannot reach. */
const SILENT = 0.0001;

/** A started voice: its output, cut to cancel it, and when it starts and ends. */
interface Voice {
  output: AudioNode;
  start: number;
  end: number;
}

type Play<D extends Drum> = (time: number, gain: number, sound: Sound[D]) => Voice;

export function createNativeKit(context: BaseAudioContext): Kit {
  const master = new GainNode(context, { gain: MASTER_GAIN });
  master.connect(context.destination);

  const buses = {} as Record<Drum, GainNode>;
  for (const drum of DRUMS) {
    buses[drum] = new GainNode(context);
    buses[drum].connect(master);
  }

  // One second of white noise, shared by every sd and hh hit.
  const noise = new AudioBuffer({ length: context.sampleRate, sampleRate: context.sampleRate });
  const noiseData = noise.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

  /** A decaying envelope from `peak` at `time` to silence after `decay` seconds. */
  function envelope(time: number, peak: number, decay: number): GainNode {
    const gain = new GainNode(context, { gain: 0 });
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(SILENT, time + decay);
    return gain;
  }

  function noiseBurst(time: number, end: number): AudioBufferSourceNode {
    const source = new AudioBufferSourceNode(context, { buffer: noise, loop: true });
    source.start(time, Math.random() * noise.duration);
    source.stop(end);
    return source;
  }

  // bd: a sine dropping from 160 to 50 Hz, ringing out over 0.4 s.
  const bd: Play<'bd'> = (time, gain, sound) => {
    const end = time + 0.4;
    const output = new GainNode(context, { gain: gain * (sound.level / 255) });
    const osc = new OscillatorNode(context, { type: 'sine', frequency: 160 });
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.07);
    osc.connect(envelope(time, 1, end - time)).connect(output);
    osc.start(time);
    osc.stop(end);
    return { output, start: time, end };
  };

  // sd: a short triangle body under high-passed noise.
  const sd: Play<'sd'> = (time, gain, sound) => {
    const end = time + 0.2;
    const output = new GainNode(context, { gain: gain * (sound.level / 255) });
    const body = new OscillatorNode(context, { type: 'triangle', frequency: 180 });
    body.connect(envelope(time, 0.5, 0.1)).connect(output);
    body.start(time);
    body.stop(end);
    const filter = new BiquadFilterNode(context, { type: 'highpass', frequency: 1500 });
    noiseBurst(time, end).connect(filter).connect(envelope(time, 0.5, end - time)).connect(output);
    return { output, start: time, end };
  };

  // hh: a tick of high-passed noise.
  const hh: Play<'hh'> = (time, gain, sound) => {
    const end = time + 0.06;
    const output = new GainNode(context, { gain: gain * (sound.level / 255) });
    const filter = new BiquadFilterNode(context, { type: 'highpass', frequency: 7000 });
    noiseBurst(time, end).connect(filter).connect(envelope(time, 0.35, end - time)).connect(output);
    return { output, start: time, end };
  };

  const voices: { [D in Drum]: Play<D> } = { bd, sd, hh };
  let sounding: Voice[] = [];

  return {
    trigger(drum, time, velocity, sound) {
      // Forget voices that have ended; cancelling only needs the ones still ahead.
      sounding = sounding.filter((voice) => voice.end > context.currentTime);
      const voice = voices[drum](time, velocity, sound);
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
  };
}
