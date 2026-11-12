// The scheduler: the thin real-time wrapper that runs the transport from the
// AudioContext clock. A timer wakes it often; each time it asks the
// transport for the steps due within the lookahead and queues their hits on
// the kit, with the sound the setup store holds at that moment. All musical
// timing stays in the transport.

import type { Kit } from './kit';
import type { SetupStore } from './setup-store';
import type { LoopSteps, TimedStep, Transport } from './transport';
import { tunables } from './tunables';

/** How often the scheduler wakes, in ms. Well under the lookahead, so one late timer leaves no gap. */
const TICK_MS = 25;

/** How far after the play tap step 0 sounds, in seconds: room to queue it before it is due. */
const START_DELAY = 0.05;

/** How often the output latency is read again, in seconds of context time. */
const LATENCY_REFRESH = 1;

export interface Scheduler {
  /** Starts playback at step 0. Does nothing while playing. */
  play(): void;
  /**
   * Stops playback, ending a held loop, and cancels the hits queued but not
   * yet started. A pending return lands at once: with nothing playing there
   * is no bar to wait for.
   */
  stop(): void;
  /**
   * Holds a loop of `steps` steps: engages it on the step heard now, or
   * slides a held loop to that size. Heard from the next step boundary.
   * Does nothing while stopped.
   */
  hold(steps: LoopSteps): void;
  /** Releases the loop: from the next step boundary the playhead step plays again (the slip). */
  release(): void;
  /**
   * The step reaching the speakers now, by the same latency a loop engages
   * from, so a loop starts on the step shown. Undefined while stopped and
   * before step 0 sounds. Cheap enough to read every frame.
   */
  heard(): TimedStep | undefined;
}

export function createScheduler(context: BaseAudioContext, kit: Kit, transport: Transport, store: SetupStore): Scheduler {
  let timer: ReturnType<typeof setInterval> | undefined;

  // Seconds from the context clock to the speakers: what sounds now was
  // scheduled this long ago. Browsers without `outputLatency` (Safari) count
  // the base latency only. Browsers report the output latency as 0 until the
  // context runs, so it is read again every second of context time, from the
  // timer: in Firefox the getters can stall the page while the audio device
  // is busy, so never every frame.
  let latency = 0;
  let latencyReadAt = -Infinity;

  function readLatency() {
    const now = context.currentTime;
    if (now - latencyReadAt < LATENCY_REFRESH) return;
    const { baseLatency = 0, outputLatency = 0 } = context as Partial<AudioContext>;
    latency = baseLatency + outputLatency;
    latencyReadAt = now;
  }

  /**
   * A loop change: the transport hands out again the steps after now with
   * the change, so the hits queued for them are cancelled first, from the
   * same now, so no hit is lost or doubled.
   */
  function changeLoop(change: (now: number) => void) {
    if (!transport.playing) return;
    const now = context.currentTime;
    change(now);
    kit.cancelScheduled(now);
    tick();
  }

  function tick() {
    readLatency();
    for (const step of transport.stepsBefore(context.currentTime + tunables.lookahead)) {
      // The transport plays the anchor's pattern from this step on; the store
      // follows, so sound, drift and drive come back with it. Drive is on the
      // bus, so the kit switches it on this step, not a lookahead early. It is
      // set before the store changes, so the drive change the store reports
      // next asks the kit for the drive it already has.
      if (step.returned) {
        kit.setDrive(store.returnSetup().drive, step.time);
        store.applyAnchor();
      }
      const { sound } = store.setup();
      for (const hit of step.hits) kit.trigger(hit.drum, step.time, hit.velocity, sound[hit.drum]);
    }
  }

  return {
    play() {
      if (transport.playing) return;
      transport.start(context.currentTime + START_DELAY);
      tick();
      timer = setInterval(tick, TICK_MS);
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
      const returning = transport.returnPending;
      transport.stop();
      kit.cancelScheduled();
      if (returning) store.applyAnchor();
    },
    hold(steps) {
      changeLoop((now) => transport.hold(steps, { now, heard: now - latency }));
    },
    release() {
      changeLoop((now) => transport.release(now));
    },
    heard() {
      return transport.stepHeardAt(context.currentTime - latency);
    },
  };
}
