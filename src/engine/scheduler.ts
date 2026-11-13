// The scheduler: the thin real-time wrapper that runs the transport from the
// AudioContext clock. Timers wake it often; each time it asks the transport
// for the steps due within the lookahead and queues their hits on the kit,
// with the sound the setup store holds at that moment. All musical timing
// stays in the transport.
//
// Two timers wake it: the page's, and one in a worker (tick-worker.ts),
// because Safari runs a hidden page's timers only once a second. A wake hands
// out only the steps not handed out yet, so a second timer never doubles a hit.

import type { Kit } from './kit';
import type { SetupStore } from './setup-store';
import type { TickWorker } from './tick-worker';
import type { LoopSteps, TimedStep, Transport } from './transport';
import { tunables } from './tunables';

/** How often the scheduler wakes, in ms. Well under the lookahead, so one late timer leaves no gap. */
const TICK_MS = 25;

/** How far after the play tap step 0 sounds, in seconds: room to queue it before it is due. */
const START_DELAY = 0.05;

/** How often the output latency is read again, in seconds of context time. */
const LATENCY_REFRESH = 1;

/**
 * How long the context clock runs before the output latency is first read,
 * in seconds. Firefox can hang the page on a read while the audio device
 * starts (seen with several browsers starting audio at once); a quarter
 * second in, it has not.
 */
const LATENCY_SETTLE = 0.25;

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
   * Holds a loop of `steps` steps: engages it on the beat heard now (see
   * `Transport.hold`), or slides a held loop to that size. Heard from the
   * next step boundary. Does nothing while stopped.
   */
  hold(steps: LoopSteps): void;
  /** Releases the loop: from the next step boundary the playhead step plays again (the slip). */
  release(): void;
  /**
   * The step reaching the speakers now, by the same latency a loop engages
   * from, so a loop takes the beat of the step shown. Undefined while
   * stopped and before step 0 sounds. Cheap enough to read every frame.
   */
  heard(): TimedStep | undefined;
}

/** What woke the scheduler: the page's timer, the worker's, the play tap, or a loop change. */
export type WakeSource = 'page' | 'worker' | 'play' | 'loop';

/** What one wake of the scheduler saw, for the debug readout (`?debug`). */
export interface WakeReport {
  source: WakeSource;
  /** `performance.now()` once the wake has handed out its steps, in ms. */
  wall: number;
  /** The context clock at the wake, in seconds. */
  now: number;
  state: AudioContextState;
  /** Steps handed out after their time had passed: their hits sound late. */
  overdue: number;
  /** How late the most overdue of them was, in seconds; 0 without any. */
  maxLate: number;
}

export interface SchedulerOptions {
  /** The worker timer that wakes the scheduler beside the page's (tick-worker.ts). */
  worker?: TickWorker;
  /** Hears every wake, for the debug readout. */
  probe?: (report: WakeReport) => void;
}

export function createScheduler(
  context: BaseAudioContext,
  kit: Kit,
  transport: Transport,
  store: SetupStore,
  { worker, probe }: SchedulerOptions = {},
): Scheduler {
  let timer: ReturnType<typeof setInterval> | undefined;

  // Seconds from the context clock to the speakers: what sounds now was
  // scheduled this long ago. Browsers without `outputLatency` (Safari) count
  // the base latency only. Browsers report the output latency as 0 until the
  // context runs, and the play tap comes before it does, so it is only read
  // while the context runs: first once its clock has run `LATENCY_SETTLE`,
  // then every second of context time, from the timer. In Firefox the
  // getters can stall the page while the audio device is busy, above all
  // while it starts, so never every frame.
  let latency = 0;
  let latencyReadAt = -Infinity;

  function readLatency() {
    const now = context.currentTime;
    if (context.state !== 'running' || now < LATENCY_SETTLE || now - latencyReadAt < LATENCY_REFRESH) return;
    const { baseLatency = 0, outputLatency = 0 } = context as Partial<AudioContext>;
    latency = baseLatency + outputLatency;
    latencyReadAt = now;
  }

  // The clock time reaching the speakers: the context clock less the latency.
  // When a fresh read of the latency is higher, it waits rather than going
  // back, so the step display does not flick back to the step before.
  let heardTime = -Infinity;

  function heardAt(now: number): number {
    heardTime = Math.max(heardTime, now - latency);
    return heardTime;
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
    tick('loop');
  }

  function tick(source: WakeSource) {
    readLatency();
    const now = context.currentTime;
    let overdue = 0;
    let maxLate = 0;
    for (const step of transport.stepsBefore(now + tunables.lookahead)) {
      if (step.time < now) {
        overdue++;
        maxLate = Math.max(maxLate, now - step.time);
      }
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
      for (const hit of step.hits) kit.trigger(hit.drum, step.time, hit.velocity, sound[hit.drum], hit.accent);
    }
    probe?.({ source, wall: performance.now(), now, state: context.state, overdue, maxLate });
  }

  return {
    play() {
      if (transport.playing) return;
      transport.start(context.currentTime + START_DELAY);
      tick('play');
      timer = setInterval(() => tick('page'), TICK_MS);
      worker?.start(TICK_MS, () => tick('worker'));
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
      worker?.stop();
      const returning = transport.returnPending;
      transport.stop();
      kit.cancelScheduled();
      if (returning) store.applyAnchor();
    },
    hold(steps) {
      changeLoop((now) => transport.hold(steps, { now, heard: heardAt(now) }));
    },
    release() {
      changeLoop((now) => transport.release(now));
    },
    heard() {
      return transport.stepHeardAt(heardAt(context.currentTime));
    },
  };
}
