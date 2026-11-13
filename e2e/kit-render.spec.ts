import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';

// Renders the kit in each browser's OfflineAudioContext. The engine is
// bundled from source for the page, so nothing test-only ships in the app.

const engineDir = resolve(import.meta.dirname, '../src/engine');
const sampleRate = 48000;

type Drum = 'bd' | 'sd' | 'hh';
const drums: Drum[] = ['bd', 'sd', 'hh'];

/** Just enough of the engine's shape for the page script. */
interface Engine {
  createNativeKit(
    context: BaseAudioContext,
    options: { drift: number; drive: number },
  ): {
    trigger(drum: Drum, time: number, velocity: number, sound: unknown, accent?: boolean): void;
    cancelScheduled(from?: number): void;
    setMuted(drum: Drum, muted: boolean): void;
  };
  defaultSetup(): {
    x: number;
    y: number;
    bpm: number;
    density: Record<Drum, number>;
    sound: Record<Drum, { level: number }> & { hh: { accent: number } };
  };
  hitsAt(input: unknown, step: number): Record<Drum, { hit: boolean; accent: boolean }>;
  tunables: {
    kit: {
      drift: { timing: number };
      drive: { loudnessToleranceDb: number };
      hh: { decay: number; chokeFade: number };
    };
  };
}

/** The kit, the pattern generator, the default setup and the tunables as one script that sets `window.engine`. */
async function bundleEngine(): Promise<string> {
  const entry = '\0engine-entry';
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'engine-entry',
        resolveId: (id) => (id === entry ? id : undefined),
        load: (id) =>
          id === entry
            ? ['kit', 'pattern', 'setup', 'tunables'].map((name) => `export * from '${engineDir}/${name}.ts';`).join('\n')
            : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      // An app build drops the entry's exports by default; the page needs them.
      rolldownOptions: { input: entry, preserveEntrySignatures: 'strict', output: { format: 'iife', name: 'engine' } },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => ('output' in output ? output.output : [])).find((file) => file.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('engine bundle has no chunk');
  return chunk.code;
}

/** A hit at full velocity, plain unless marked as an accent. */
interface Hit {
  drum: Drum;
  time: number;
  accent?: boolean;
}

/** What to render: everything is triggered before rendering starts, at the default sound. */
interface Render {
  sampleRate: number;
  /** Length in seconds; one bar at the default tempo when left out. */
  seconds?: number;
  drift: number;
  drive: number;
  /** One bar of the default setup's pattern, a plain hit at 0.7 and an accent at 1, as the transport plays them. */
  bar?: boolean;
  hits?: Hit[];
  /** Every drum's level at 255 instead of the default, and hh accent at 255: accents open the hat fully. */
  loud?: boolean;
  /** The hh sound's accent byte instead of the default. */
  hhAccent?: number;
  /** Cancels after triggering the hits above, then triggers these. */
  afterCancel?: Hit[];
  /** Cancels the hits triggered for after this time instead of every hit. */
  cancelFrom?: number;
  /** Mutes a drum at a time mid-render. Needs `OfflineAudioContext.suspend`. */
  mute?: { drum: Drum; time: number };
}

/** Runs in the page: renders the kit as `spec` describes and returns the samples. */
async function renderInPage(spec: Render): Promise<number[]> {
  const engine = (window as unknown as { engine: Engine }).engine;
  const setup = engine.defaultSetup();
  const step = 60 / setup.bpm / 8;
  const seconds = spec.seconds ?? 32 * step;
  const { sound } = setup;
  if (spec.loud) {
    for (const parameters of Object.values(sound)) parameters.level = 255;
    sound.hh.accent = 255;
  }
  if (spec.hhAccent !== undefined) sound.hh.accent = spec.hhAccent;
  const context = new OfflineAudioContext(1, Math.ceil(seconds * spec.sampleRate), spec.sampleRate);
  const kit = engine.createNativeKit(context, { drift: spec.drift, drive: spec.drive });
  if (spec.bar) {
    const input = { x: setup.x, y: setup.y, density: setup.density, perturbation: { bd: 0, sd: 0, hh: 0 } };
    for (let n = 0; n < 32; n++) {
      const hits = engine.hitsAt(input, n);
      for (const drum of ['bd', 'sd', 'hh'] as const) {
        const { hit, accent } = hits[drum];
        if (hit) kit.trigger(drum, n * step, accent ? 1 : 0.7, sound[drum], accent);
      }
    }
  }
  for (const hit of spec.hits ?? []) kit.trigger(hit.drum, hit.time, 1, sound[hit.drum], hit.accent);
  if (spec.afterCancel) {
    kit.cancelScheduled(spec.cancelFrom);
    for (const hit of spec.afterCancel) kit.trigger(hit.drum, hit.time, 1, sound[hit.drum], hit.accent);
  }
  const { mute } = spec;
  if (mute) {
    void context.suspend(mute.time).then(() => {
      kit.setMuted(mute.drum, true);
      return context.resume();
    });
  }
  const buffer = await context.startRendering();
  return Array.from(buffer.getChannelData(0));
}

/** Renders the kit in the page at the test's sample rate. */
function render(page: Page, spec: Omit<Render, 'sampleRate'>): Promise<number[]> {
  return page.evaluate(renderInPage, { ...spec, sampleRate });
}

function peak(samples: number[]): number {
  return samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
}

function rmsDb(samples: number[]): number {
  return 10 * Math.log10(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
}

function rootMeanSquare(samples: number[]): number {
  return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
}

function seconds(from: number, to: number, samples: number[]): number[] {
  return samples.slice(Math.round(from * sampleRate), Math.round(to * sampleRate));
}

/** First sample of a hit: the first one above a small threshold within ± `window` seconds of `time`. */
function onset(samples: number[], time: number, window: number): number {
  const from = Math.max(0, Math.round((time - window) * sampleRate));
  const index = samples.slice(from, Math.round((time + window) * sampleRate)).findIndex((sample) => Math.abs(sample) > 0.001);
  return index < 0 ? NaN : from + index;
}

let engineScript = '';
test.beforeAll(async () => {
  engineScript = await bundleEngine();
});

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><title>kit render</title>');
  await page.addScriptTag({ content: engineScript });
});

test('each drum sounds at the default sound', async ({ page }) => {
  for (const drum of drums) {
    const samples = await render(page, { seconds: 0.5, drift: 0, drive: 0, hits: [{ drum, time: 0.05 }] });
    expect(peak(samples), `${drum} peak`).toBeGreaterThan(0.05);
  }
});

test('one bar does not clip at drive 0 or 255, even with every level up, and drive barely changes its loudness', async ({ page }) => {
  const { kit } = await page.evaluate(() => (window as unknown as { engine: Engine }).engine.tunables);
  const rms: Record<number, number> = {};
  for (const drive of [0, 255]) {
    const clean = await render(page, { drift: 0, drive, bar: true });
    expect(peak(clean), `peak at drive ${drive}`).toBeGreaterThan(0.05);
    expect(peak(clean), `peak at drive ${drive}`).toBeLessThan(1);
    rms[drive] = rmsDb(clean);

    const loud = await render(page, { drift: 255, drive, bar: true, loud: true });
    expect(peak(loud), `peak at every level 255, the hh open, drift 255, drive ${drive}`).toBeLessThan(1);
  }
  const change = (rms[255] ?? NaN) - (rms[0] ?? NaN);
  expect(Math.abs(change), `RMS change from drive 0 to 255, dB`).toBeLessThanOrEqual(kit.drive.loudnessToleranceDb);
});

test('hits start at their scheduled times: exactly at drift 0, at most the drift bound late at drift 255', async ({ page }) => {
  const { kit } = await page.evaluate(() => (window as unknown as { engine: Engine }).engine.tunables);
  // Off the sample grid on purpose; far enough apart that each hit has ended before the next.
  const times = [0.05, 0.6731, 1.29507];
  // The drive's oversampling filter delays the whole kit by a fixed few ms in some browsers (about 4 ms in Chromium).
  const maxLatency = 0.005 * sampleRate;
  // A hit can start between two samples, so its first loud sample moves by one.
  const slack = 2;
  // Pitch and cutoff drift move where the attack crosses the onset threshold a little.
  const driftSlack = 0.00025 * sampleRate;
  const late = kit.drift.timing * sampleRate;

  for (const drum of drums) {
    const hits = times.map((time) => ({ drum, time }));
    const steady = await render(page, { seconds: 1.9, drift: 0, drive: 0, hits });
    const offsets = times.map((time) => onset(steady, time, 0.2) - time * sampleRate);
    const latency = offsets[0] ?? NaN;
    expect(latency, `${drum} latency in samples`).toBeGreaterThanOrEqual(-slack);
    expect(latency, `${drum} latency in samples`).toBeLessThanOrEqual(maxLatency);
    offsets.forEach((offset, i) => expect(Math.abs(offset - latency), `${drum} hit ${i} at drift 0`).toBeLessThanOrEqual(slack));

    const drifting = await render(page, { seconds: 1.9, drift: 255, drive: 0, hits });
    times.forEach((time, i) => {
      const offset = onset(drifting, time, 0.2) - time * sampleRate - latency;
      expect(offset, `${drum} hit ${i} at drift 255`).toBeGreaterThanOrEqual(-slack - driftSlack);
      expect(offset, `${drum} hit ${i} at drift 255`).toBeLessThanOrEqual(late + slack + driftSlack);
    });
  }
});

/** The largest difference between two renders. */
function difference(a: number[], b: number[]): number {
  return peak(a.map((sample, i) => sample - (b[i] ?? 0)));
}

test('at drift 0 a hit renders the same every time; at drift 255 every hit is different', async ({ page }) => {
  for (const drum of drums) {
    const hit = (drift: number) => render(page, { seconds: 0.5, drift, drive: 0, hits: [{ drum, time: 0.05 }] });
    // Chromium's filters sometimes round differently in the last bits (about 1e-6); that is still the same hit.
    expect(difference(await hit(0), await hit(0)), `${drum} at drift 0`).toBeLessThan(0.00001);
    expect(difference(await hit(255), await hit(255)), `${drum} at drift 255`).toBeGreaterThan(0.001);
  }
});

test('a muted drum is silent from the mute onward while the others play', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', "Firefox's OfflineAudioContext cannot suspend mid-render");
  // bd would ring past 0.25 s; hh comes in at 0.5 s.
  const hits: Hit[] = [
    { drum: 'bd', time: 0 },
    { drum: 'hh', time: 0.5 },
    { drum: 'bd', time: 0.75 },
  ];
  const muted = await render(page, { seconds: 1, drift: 0, drive: 0, hits, mute: { drum: 'bd', time: 0.25 } });
  const hhOnly = await render(page, { seconds: 1, drift: 0, drive: 0, hits: hits.filter((hit) => hit.drum === 'hh') });

  expect(peak(seconds(0, 0.25, muted)), 'bd before the mute').toBeGreaterThan(0.05);
  // From the mute (plus the few ms the mute gain takes to close) only hh is left.
  const after = seconds(0.28, 1, muted);
  const hhAfter = seconds(0.28, 1, hhOnly);
  expect(peak(hhAfter), 'hh after the mute').toBeGreaterThan(0.05);
  expect(difference(after, hhAfter), 'bd after the mute').toBeLessThan(0.001);
});

test('a cancelled hit does not sound; a hit triggered after cancelling does', async ({ page }) => {
  const samples = await render(page, {
    seconds: 1,
    drift: 0,
    drive: 0,
    hits: [
      { drum: 'bd', time: 0.1 },
      { drum: 'sd', time: 0.3 },
    ],
    afterCancel: [{ drum: 'hh', time: 0.5 }],
  });
  expect(peak(seconds(0, 0.49, samples)), 'cancelled bd and sd').toBeLessThan(0.001);
  expect(peak(seconds(0.49, 1, samples)), 'hh after cancelling').toBeGreaterThan(0.05);
});

test('at hh accent 0 an accented hh sounds like a plain one: the accent is only louder, as before', async ({ page }) => {
  const hh = (accent: boolean) =>
    render(page, { seconds: 0.5, drift: 0, drive: 0, hhAccent: 0, hits: [{ drum: 'hh', time: 0.05, accent }] });
  expect(difference(await hh(true), await hh(false))).toBeLessThan(0.00001);
});

test('at hh accent 100 an accented hh rings well past the closed decay; a plain hh does not', async ({ page }) => {
  const { kit } = await page.evaluate(() => (window as unknown as { engine: Engine }).engine.tunables);
  const time = 0.05;
  const hh = (accent: boolean) =>
    render(page, { seconds: 0.6, drift: 0, drive: 0, hhAccent: 255, hits: [{ drum: 'hh', time, accent }] });
  // From twice to three times the closed decay, against the hit's own peak.
  const ringing = (samples: number[]) =>
    peak(seconds(time + 2 * kit.hh.decay, time + 3 * kit.hh.decay, samples)) / peak(samples);
  expect(ringing(await hh(true)), 'the open hh, against its peak').toBeGreaterThan(0.001);
  expect(ringing(await hh(false)), 'the plain hh, against its peak').toBeLessThan(0.0001);
});

test('the next hh hit cuts an open hh within about 10 ms, fading it out instead of dropping it at once', async ({
  page,
}) => {
  const { kit } = await page.evaluate(() => (window as unknown as { engine: Engine }).engine.tunables);
  const open: Hit = { drum: 'hh', time: 0.05, accent: true };
  const next: Hit = { drum: 'hh', time: 0.2 };
  const spec = { seconds: 0.5, drift: 0, drive: 0, hhAccent: 255 };
  const openOnly = await render(page, { ...spec, hits: [open] });
  const nextOnly = await render(page, { ...spec, hits: [next] });
  // Below the drive's knee the kit sums linearly, so taking the next hit
  // away leaves the open hh as the next hit cut it.
  const both = await render(page, { ...spec, hits: [open, next] });
  const cutOpen = both.map((sample, i) => sample - (nextOnly[i] ?? 0));
  // Where the next hit reaches the output, after the drive's oversampling delay.
  const cut = onset(nextOnly, next.time, 0.01) / sampleRate;

  const before = (samples: number[]) => seconds(0, next.time, samples);
  expect(difference(before(cutOpen), before(openOnly)), 'the open hh before the next hit').toBeLessThan(0.00001);
  const tenMsOn = (samples: number[]) => peak(seconds(cut + 0.01, spec.seconds, samples));
  expect(tenMsOn(openOnly), 'the open hh left alone, from 10 ms after the next hit').toBeGreaterThan(0.001);
  expect(tenMsOn(cutOpen), 'the open hh from 10 ms after the next hit').toBeLessThan(tenMsOn(openOnly) / 100);

  // Its level against the open hh alone, which takes out the beating of the
  // squares, per fifth of the fade: 1 before the cut, then down to 0. A cut
  // at once, a click, drops by half or more within one fifth wherever it
  // lands; an even fade drops by about a fifth.
  const fifth = kit.hh.chokeFade / 5;
  const levels = Array.from({ length: 12 }, (_, k) => {
    const from = cut + (k - 2) * fifth;
    return rootMeanSquare(seconds(from, from + fifth, cutOpen)) / rootMeanSquare(seconds(from, from + fifth, openOnly));
  });
  expect(levels[0], 'level before the cut').toBeCloseTo(1, 3);
  expect(levels.at(-1), 'level after the fade').toBeLessThan(0.01);
  levels.forEach((level, k) => {
    if (k > 0) expect((levels[k - 1] ?? NaN) - level, `drop ${k - 2} fifths of the fade from the cut`).toBeLessThan(0.4);
  });
});

test('a cancelled hh hit no longer cuts the open hh before it; the next hh hit triggered does', async ({ page }) => {
  // As when the looper hands steps out again: the hit at 0.15 s is cancelled, the one at 0.3 s queued instead.
  const open: Hit = { drum: 'hh', time: 0.05, accent: true };
  const spec = { seconds: 0.6, drift: 0, drive: 0, hhAccent: 255 };
  const cancelled = await render(page, {
    ...spec,
    hits: [open, { drum: 'hh', time: 0.15 }],
    cancelFrom: 0.1,
    afterCancel: [{ drum: 'hh', time: 0.3 }],
  });
  const neverTriggered = await render(page, { ...spec, hits: [open, { drum: 'hh', time: 0.3 }] });
  expect(difference(cancelled, neverTriggered)).toBeLessThan(0.00001);
});
