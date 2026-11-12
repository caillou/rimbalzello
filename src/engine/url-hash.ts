// The setup in the URL hash: the address bar always holds the current setup,
// so copying it shares the groove, and a link opens with the setup it holds.
// The hash is written with `replaceState`, so it never adds history entries,
// and at most once a second: Safari throws when a page calls it too often.
// A change during that second still lands when the second is over.
//
// Encoding is the URL codec's job, and remembering the setup on the device
// the setup store's. Mutes and the anchor are not part of the setup, so they
// never reach the URL.

import { defaultSetup, type Setup } from './setup';
import { rememberedSetup, type SetupStorage, type SetupStore } from './setup-store';
import { decodeSetup, encodeSetup } from './url-codec';

/** Shortest gap between two writes of the hash, in ms (PRD). */
const WRITE_GAP = 1000;

/**
 * The setup a page load starts with. A hash always wins, even one that
 * cannot be read, which gives the default setup. Without one, the setup the
 * device remembers; otherwise the default. Call it before creating the
 * store, which overwrites what the device remembers.
 */
export function startingSetup(hash: string, storage?: SetupStorage): Setup {
  return hasSetup(hash) ? decodeSetup(hash) : (rememberedSetup(storage) ?? defaultSetup());
}

/** The browser around the hash. Defaults to the page's window; tests pass fakes. */
export interface UrlHashHost {
  readonly location: { readonly hash: string };
  readonly history: Pick<History, 'state' | 'replaceState'>;
  addEventListener(type: 'hashchange', listener: () => void): void;
  removeEventListener(type: 'hashchange', listener: () => void): void;
}

/**
 * Keeps the URL hash on the store's setup from now on, starting at once.
 * A link opened in this tab changes only the hash, not the page: its setup
 * replaces the current one and becomes the anchor, as on a page load.
 * Returns the function that stops both.
 */
export function syncUrlHash(store: SetupStore, host: UrlHashHost = window): () => void {
  /** Runs from a write until WRITE_GAP later. */
  let gap: ReturnType<typeof setTimeout> | undefined;
  /** A change came during the gap: write when it ends. */
  let waiting = false;

  function write(): void {
    if (gap !== undefined) {
      waiting = true;
      return;
    }
    const hash = `#${encodeSetup(store.setup())}`;
    if (hash === host.location.hash) return;
    try {
      host.history.replaceState(host.history.state, '', hash);
    } catch {
      // The browser refused (Safari's rate limit); the next change tries again.
    }
    gap = setTimeout(() => {
      gap = undefined;
      if (waiting) {
        waiting = false;
        write();
      }
    }, WRITE_GAP);
  }

  function opened(): void {
    const hash = host.location.hash;
    if (hasSetup(hash)) {
      const linked = decodeSetup(hash);
      store.change((setup) => void Object.assign(setup, linked));
      store.setAnchor();
    }
    // A hash the setup normalised, or a bare `#`, shows the setup again.
    write();
  }

  const unsubscribe = store.subscribe(write);
  host.addEventListener('hashchange', opened);
  write();

  return () => {
    unsubscribe();
    host.removeEventListener('hashchange', opened);
    clearTimeout(gap);
  };
}

/** No hash and a bare `#` hold no setup; `location.hash` gives '' for both. */
function hasSetup(hash: string): boolean {
  return hash !== '' && hash !== '#';
}
