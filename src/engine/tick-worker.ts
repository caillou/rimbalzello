// The scheduler's second timer, in a dedicated worker. Safari runs the
// timers of a hidden page at most once a second, even while it plays sound,
// but leaves a worker's timers alone, so this one keeps waking the scheduler
// in a background tab or app (#22). The page's own timer keeps running
// beside it, so a worker that fails to start or dies costs only the hidden
// page's timing.
//
// The worker is an inline Blob rather than a module file: no build
// configuration and no file under the site's base path. A Content Security
// Policy would need `worker-src blob:` for it; the site has none.

/**
 * The worker's code. A number above 0 starts a timer that posts every that
 * many ms, replacing any running one; 0 stops it.
 */
const WORKER_SOURCE = `
let timer;
onmessage = (event) => {
  clearInterval(timer);
  timer = event.data > 0 ? setInterval(() => postMessage(0), event.data) : undefined;
};
`;

export interface TickWorker {
  /** Calls `onTick` every `ms` from the worker's timer until `stop`. A second start replaces the first. */
  start(ms: number, onTick: () => void): void;
  stop(): void;
  /** Ends the worker for good. */
  terminate(): void;
}

/** Starts the worker, or returns undefined where the browser cannot (no `Worker`, or it throws). */
export function createTickWorker(): TickWorker | undefined {
  if (typeof Worker === 'undefined') return undefined;
  let url: string | undefined;
  let worker: Worker;
  try {
    url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url);
  } catch {
    if (url !== undefined) URL.revokeObjectURL(url);
    return undefined;
  }
  // The URL stays valid while the worker lives: some WebKit versions fail
  // to load a worker whose Blob URL was revoked before it started.
  const blobUrl = url;
  let onTick: (() => void) | undefined;
  worker.onmessage = () => onTick?.();
  return {
    start(ms, tick) {
      onTick = tick;
      worker.postMessage(ms);
    },
    stop() {
      onTick = undefined;
      worker.postMessage(0);
    },
    terminate() {
      onTick = undefined;
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
    },
  };
}
