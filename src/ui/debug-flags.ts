// Flags in the URL's query for measuring the scheduler's timers on a device
// (#22). They sit in the query because the hash holds the setup. A copied
// URL carries them along, so strip them before sharing a groove.
//
// `?debug` shows the debug readout. `?clock=interval` leaves the worker
// timer out, so only the page's timer wakes the scheduler, as before #22.
// Both together: `?debug&clock=interval`.

export interface DebugFlags {
  debug: boolean;
  /** Whether the worker timer wakes the scheduler beside the page's. */
  worker: boolean;
}

export function readDebugFlags(search: string): DebugFlags {
  const params = new URLSearchParams(search);
  return { debug: params.has('debug'), worker: params.get('clock') !== 'interval' };
}
