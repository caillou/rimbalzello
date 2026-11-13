import { afterEach, expect, test, vi } from 'vitest';
import { createSetupStore } from './setup-store';
import { decodeSetup } from './url-codec';
import { syncUrlHash, type UrlHashHost } from './url-hash';

afterEach(() => void vi.useRealTimers());

test('a drag writes the hash at most once a second, and its last setup lands', () => {
  vi.useFakeTimers();
  const location = { hash: '' };
  const writes: number[] = [];
  const host: UrlHashHost = {
    location,
    history: {
      state: null,
      replaceState(_state, _unused, url) {
        location.hash = String(url);
        writes.push(Date.now());
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const store = createSetupStore();
  syncUrlHash(store, host);

  // Three seconds of drag on the chaos strip, a change every 50 ms.
  for (let chaos = 0; chaos < 60; chaos++) {
    store.change((setup) => void (setup.chaos = chaos));
    vi.advanceTimersByTime(50);
  }
  vi.advanceTimersByTime(1000);

  const gaps = writes.slice(1).map((at, i) => at - (writes[i] as number));
  expect(gaps.every((gap) => gap >= 1000)).toBe(true);
  expect(decodeSetup(location.hash).chaos).toBe(59);
});
