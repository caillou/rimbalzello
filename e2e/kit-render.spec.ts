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
    trigger(drum: Drum, time: number, velocity: number, sound: unknown): void;
    cancelScheduled(): void;
    setMuted(drum: Drum, muted: boolean): void;
  };
  defaultSetup(): { x: number; y: number; bpm: number; density: Record<Drum, number>; sound: Record<Drum, { level: number }> };
  hitsAt(input: unknown, step: number): Record<Drum, { hit: boolean; accent: boolean }>;
  tunables: { kit: { drift: { timing: number }; drive: { loudnessToleranceDb: number } } };
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

/** A hit at full velocity. */
interface Hit {
  drum: Drum;
  time: number;
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
  /** Every drum's level at 255 instead of the default. */
  loud?: boolean;
  /** Cancels after triggering the hits above, then triggers these. */
  afterCancel?: Hit[];
  /** Mutes a drum at a time mid-render. Needs `OfflineAudioContext.suspend`. */
  mute?: { drum: Drum; time: number };
}

/** Runs in the page: renders the kit as `spec` describes and returns the samples. */
async function renderInPage(spec: Render): Promise<number[]> {
  const engine = (window as unknown as { engine: Engine }).engine;
  const setup = engine.defaultSetup();
  const step = 60 / setup.bpm / 8;
  const seconds = spec.seconds ?? 32 * step;
  const sound = Object.fromEntries(
    Object.entries(setup.sound).map(([drum, parameters]) => [drum, spec.loud ? { ...parameters, level: 255 } : parameters]),
  );
  const context = new OfflineAudioContext(1, Math.ceil(seconds * spec.sampleRate), spec.sampleRate);
  const kit = engine.createNativeKit(context, { drift: spec.drift, drive: spec.drive });
  if (spec.bar) {
    const input = { x: setup.x, y: setup.y, density: setup.density, perturbation: { bd: 0, sd: 0, hh: 0 } };
    for (let n = 0; n < 32; n++) {
      const hits = engine.hitsAt(input, n);
      for (const drum of ['bd', 'sd', 'hh'] as const) {
        if (hits[drum].hit) kit.trigger(drum, n * step, hits[drum].accent ? 1 : 0.7, sound[drum]);
      }
    }
  }
  for (const hit of spec.hits ?? []) kit.trigger(hit.drum, hit.time, 1, sound[hit.drum]);
  if (spec.afterCancel) {
    kit.cancelScheduled();
    for (const hit of spec.afterCancel) kit.trigger(hit.drum, hit.time, 1, sound[hit.drum]);
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
    expect(peak(loud), `peak at every level 255, drift 255, drive ${drive}`).toBeLessThan(1);
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
