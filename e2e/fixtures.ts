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

export interface BrowserWindowOptions {
  /**
   * The browser window's outer size, `outerWidth × outerHeight`, in whole px.
   * Unset, it is the viewport's, following its resizes, which the laptop zoom
   * reads as no toolbar and no browser zoom: today's zoom. Each engine's
   * headless mode reports its own outer size (the viewport's, a fixed
   * window's or 0), so every spec gets this pin. A test emulates Cmd + at
   * 110 % in a 1760×1180 window with 80 px of toolbar by a 1600×1000
   * viewport (1760×1100 ÷ 1.1) and this at 1760×1180.
   */
  browserWindow: { width: number; height: number } | undefined;
}

// outerWidth and outerHeight are replaceable attributes on window, so an own
// getter shadows them in every engine.
function pinBrowserWindow(outer: BrowserWindowOptions['browserWindow']) {
  for (const [name, inner, pinned] of [
    ['outerWidth', 'innerWidth', outer?.width],
    ['outerHeight', 'innerHeight', outer?.height],
  ] as const) {
    Object.defineProperty(window, name, {
      configurable: true,
      enumerable: true,
      get: () => Math.round(pinned ?? window[inner]),
    });
  }
}

/** Every spec imports `test` from here, so the silence and window options reach it. */
export const test = base.extend<SilenceOptions & BrowserWindowOptions>({
  silenceOutput: [false, { option: true }],
  browserWindow: [undefined, { option: true }],
  context: async ({ context, silenceOutput, browserWindow }, use) => {
    if (silenceOutput) await context.addInitScript(shadowDestination);
    await context.addInitScript(pinBrowserWindow, browserWindow);
    await use(context);
  },
});
