// The scheduler: the thin real-time wrapper that runs the transport from the
// AudioContext clock. A timer wakes it often; each time it asks the
// transport for the hits due within the lookahead and queues them on the
// kit. All musical timing stays in the transport.

import type { Kit } from './kit';
import type { Sound } from './setup';
import type { Transport } from './transport';
import { tunables } from './tunables';

/** How often the scheduler wakes, in ms. Well under the lookahead, so one late timer leaves no gap. */
const TICK_MS = 25;

/** How far after the play tap step 0 sounds, in seconds: room to queue it before it is due. */
const START_DELAY = 0.05;

export interface Scheduler {
  /** Starts playback at step 0. Does nothing while playing. */
  play(): void;
  /** Stops playback and cancels the hits queued but not yet started. */
  stop(): void;
}

export function createScheduler(context: BaseAudioContext, kit: Kit, transport: Transport, sound: Sound): Scheduler {
  let timer: ReturnType<typeof setInterval> | undefined;

  function tick() {
    for (const hit of transport.hitsBefore(context.currentTime + tunables.lookahead)) {
      kit.trigger(hit.drum, hit.time, hit.velocity, sound[hit.drum]);
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
  };
}
