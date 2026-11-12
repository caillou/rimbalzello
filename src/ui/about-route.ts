// About as an app state with its own URL (design.md, About). Opening it from
// the play screen pushes /about/; `← back to play`, `×`, `esc` and the
// browser's back button return to /. Both URLs carry the setup hash, so the
// music never changes on the way in or out.

import { createSignal, onCleanup, type Accessor } from 'solid-js';
import type { SetupStore } from '../engine/setup-store';
import { encodeSetup } from '../engine/url-codec';

const PLAY_PATH = '/';
const ABOUT_PATH = '/about/';

/** /about/, also without the slash or with its index.html. */
const isAboutPath = (path: string) => /^\/about(\/(index\.html)?)?$/.test(path);

/** The history state of the about entry pushed from the play screen. */
const OPENED_FROM_PLAY = { about: 'opened from play' } as const;

const openedFromPlay = (state: unknown) =>
  typeof state === 'object' && state !== null && 'about' in state && state.about === OPENED_FROM_PLAY.about;

export interface AboutRoute {
  /** Whether the about view is open. */
  open: Accessor<boolean>;
  /** Opens the about view over the play screen. */
  show(): void;
  /** Returns to the play screen. */
  close(): void;
}

export function createAboutRoute(store: SetupStore): AboutRoute {
  const [open, setOpen] = createSignal(isAboutPath(location.pathname));
  const setupHash = () => `#${encodeSetup(store.setup())}`;
  /** Set while a step back to the play screen is under way, so a second close doesn't step past it. */
  let steppingBack = false;

  // Back or forward between the play screen and about. The entry stepped to
  // still holds the hash it was left with, while the setup may have changed
  // since (a return, or a hash write still pending when about opened). It
  // gets the current setup's hash, so neither the address bar nor a later
  // reload brings an older setup back. Browsers fire no `hashchange` for a
  // step that also changes the path.
  function onPopState() {
    steppingBack = false;
    const about = isAboutPath(location.pathname);
    if (about === open()) return;
    history.replaceState(history.state, '', location.pathname + location.search + setupHash());
    setOpen(about);
  }
  window.addEventListener('popstate', onPopState);
  onCleanup(() => window.removeEventListener('popstate', onPopState));

  return {
    open,
    show() {
      if (open()) return;
      history.pushState(OPENED_FROM_PLAY, '', ABOUT_PATH + setupHash());
      setOpen(true);
    },
    close() {
      if (!open() || steppingBack) return;
      if (openedFromPlay(history.state)) {
        // Step back to the play screen's entry, as the back button does,
        // rather than piling up entries.
        steppingBack = true;
        history.back();
      } else {
        // Visited directly: go on to the play screen, as the link does without JavaScript.
        history.pushState(null, '', PLAY_PATH + setupHash());
        setOpen(false);
      }
    },
  };
}

/**
 * Takes over a plain click on a link: stops the link's own navigation and
 * returns true. A click that asks for a new tab or window is left to the link.
 */
export function claimLinkClick(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  event.preventDefault();
  return true;
}
