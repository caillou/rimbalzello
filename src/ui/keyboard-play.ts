// Keyboard play: the keyboard bindings listening on the window. Key events go
// through the bindings and their intents to `onIntent`. A key the bindings
// play has its browser default prevented, so the page never scrolls; any
// other key keeps it, so a focused strip still moves on the arrows.

import { onCleanup } from 'solid-js';
import { tunables } from '../engine/tunables';
import type { Keyboard, KeyIntent } from './keyboard';

export interface KeyboardPlayOptions {
  keyboard: Keyboard;
  /**
   * Keys play nothing while this is true: about is open, or the rotate hint
   * shows. Window listeners still hear keys while the play screen is inert.
   * Releases still count, so a key held as it turns true lets go.
   */
  blocked(): boolean;
  onIntent(intent: KeyIntent): void;
}

export function listenToKeys({ keyboard, blocked, onIntent }: KeyboardPlayOptions): void {
  let runOpen = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function apply(intents: KeyIntent[]) {
    for (const intent of intents) {
      if (intent.type === 'begin') runOpen = true;
      if (intent.type === 'commit') runOpen = false;
      onIntent(intent);
    }
    // A run of arrow nudges ends once no arrow has been down for the idle
    // gap: ask again a gap after the last key, as long as the run is open.
    clearTimeout(timer);
    if (runOpen) timer = setTimeout(() => apply(keyboard.tick(performance.now())), tunables.keyboard.nudgeRunGap);
  }

  function keyDown(event: KeyboardEvent) {
    if (blocked()) return;
    const intents = keyboard.keyDown(event);
    if (intents.length > 0) event.preventDefault();
    apply(intents);
  }

  function keyUp(event: KeyboardEvent) {
    // macOS drops the keyup of a key let go while Cmd is down, which would
    // leave a loop held or a nudge run open. Letting go of Cmd lets go of
    // every key.
    apply(event.key === 'Meta' ? keyboard.releaseAll() : keyboard.keyUp(event));
  }

  // Switching away from the window: no keyup will come for the keys held.
  function blur() {
    apply(keyboard.releaseAll());
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  onCleanup(() => {
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    window.removeEventListener('blur', blur);
    clearTimeout(timer);
  });
}
