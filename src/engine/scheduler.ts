// The scheduler: the thin real-time wrapper that runs the transport from the
// AudioContext clock. A timer wakes it often; each time it asks the
// transport for the steps due within the lookahead and queues their hits on
// the kit, with the sound the setup store holds at that moment. All musical
// timing stays in the transport.

import type { Kit } from './kit';
import type { SetupStore } from './setup-store';
import type { LoopSteps, Transport } from './transport';
import { tunables } from './tunables';

/** How often the scheduler wakes, in ms. Well under the lookahead, so one late timer leaves no gap. */
const TICK_MS = 25;

/** How far after the play tap step 0 sounds, in seconds: room to queue it before it is due. */
const START_DELAY = 0.05;

export interface Scheduler {
  /** Starts playback at step 0. Does nothing while playing. */
  play(): void;
  /** Stops playback, ending a held loop, and cancels the hits queued but not yet started. */
  stop(): void;
  /**
   * Holds a loop of `steps` steps: engages it on the step heard now, or
   * slides a held loop to that size. Heard from the next step boundary.
   * Does nothing while stopped.
   */
  hold(steps: LoopSteps): void;
  /** Releases the loop: from the next step boundary the playhead step plays again (the slip). */
  release(): void;
}

export function createScheduler(context: BaseAudioContext, kit: Kit, transport: Transport, store: SetupStore): Scheduler {
  let timer: ReturnType<typeof setInterval> | undefined;

  /**
   * Seconds from the context clock to the speakers: what sounds now was
   * scheduled this long ago. Browsers without `outputLatency` (Safari) count
   * the base latency only.
   */
  function latency(): number {
    const { baseLatency = 0, outputLatency = 0 } = context as Partial<AudioContext>;
    return baseLatency + outputLatency;
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
    for (const step of transport.stepsBefore(context.currentTime + tunables.lookahead)) {
      // The transport plays the anchor's pattern from this step on; the store
      // follows, so sound, drift and drive come back with it.
      if (step.returned) store.applyAnchor();
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
      transport.stop();
      kit.cancelScheduled();
    },
    hold(steps) {
      changeLoop((now) => transport.hold(steps, { now, heard: now - latency() }));
    },
    release() {
      changeLoop((now) => transport.release(now));
    },
  };
}
