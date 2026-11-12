import { afterEach, expect, test, vi } from 'vitest';
import { defaultSetup, type Setup } from './setup';
import { createSetupStore, type SetupStorage } from './setup-store';
import { decodeSetup, encodeSetup } from './url-codec';
import { startingSetup, syncUrlHash, type UrlHashHost } from './url-hash';

afterEach(() => void vi.useRealTimers());

function memoryStorage(): SetupStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

/** A device that remembers `setup`, as a visit leaves it. */
function deviceRemembering(setup: Setup): SetupStorage {
  const storage = memoryStorage();
  createSetupStore({ setup, storage });
  return storage;
}

const REMEMBERED: Setup = { ...defaultSetup(), chaos: 200, bpm: 140 };
const LINKED: Setup = { ...defaultSetup(), x: 10, y: 240, bpm: 90 };

test('a hash wins over the setup the device remembers, even one that cannot be read', () => {
  const device = deviceRemembering(REMEMBERED);
  expect(startingSetup(`#${encodeSetup(LINKED)}`, device)).toEqual(LINKED);
  expect(startingSetup('#v1.not-a-setup', device)).toEqual(defaultSetup());
});

test('without a hash, or with a bare #, the setup the device remembers comes back, else the default', () => {
  const device = deviceRemembering(REMEMBERED);
  expect(startingSetup('', device)).toEqual(REMEMBERED);
  expect(startingSetup('#', device)).toEqual(REMEMBERED);
  expect(startingSetup('', memoryStorage())).toEqual(defaultSetup());
});

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
  const store = createSetupStore({ storage: memoryStorage() });
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
