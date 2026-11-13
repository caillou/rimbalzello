import { test as base } from '@playwright/test';

export { expect, type Locator, type Page } from '@playwright/test';

export interface SilenceOptions {
  /** Feeds every AudioContext's output through a gain of 0. playwright.config.ts sets it. */
  silenceOutput: boolean;
}

// WebKit has no mute flag or pref, so a local WebKit run silences the app
// from the page side. Each AudioContext's `destination` becomes a gain of 0
// in front of the real one: the graph is still pulled and the clock runs, but
// nothing reaches the speakers. OfflineAudioContext keeps its own destination,
// so rendered buffers stay real. Blind spot: the app reading a property of
// `destination`, such as `channelCount`, gets the gain node's value in a local
// WebKit run. CI runs unpatched and still sees it.
function shadowDestination() {
  const destination = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination')?.get;
  if (!destination) return;
  const silent = new WeakMap<AudioContext, GainNode>();
  Object.defineProperty(AudioContext.prototype, 'destination', {
    configurable: true,
    enumerable: true,
    get(this: AudioContext) {
      let gain = silent.get(this);
      if (!gain) {
        gain = new GainNode(this, { gain: 0 });
        gain.connect(destination.call(this) as AudioDestinationNode);
        silent.set(this, gain);
      }
      return gain;
    },
  });
}

/** Every spec imports `test` from here, so the silence option reaches it. */
export const test = base.extend<SilenceOptions>({
  silenceOutput: [false, { option: true }],
  context: async ({ context, silenceOutput }, use) => {
    if (silenceOutput) await context.addInitScript(shadowDestination);
    await use(context);
  },
});
