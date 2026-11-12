import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { build } from 'vite';

// Renders one bar of the groove through the kit in each browser's
// OfflineAudioContext. The engine is bundled from source for the page,
// so nothing test-only ships in the app.

const engineDir = resolve(import.meta.dirname, '../src/engine');
const sampleRate = 48000;
/** Web Audio renders in blocks of this many samples; hits may land up to one block off. */
const renderQuantum = 128;

/** Just enough of the engine's shape for the page script. */
interface Engine {
  createNativeKit(context: BaseAudioContext): {
    trigger(drum: string, time: number, velocity: number, sound: unknown): void;
  };
  createTransport(bpm: number): {
    start(time: number): void;
    hitsBefore(until: number): { drum: string; step: number; time: number; velocity: number }[];
  };
  defaultSetup(): { bpm: number; sound: Record<string, unknown> };
  grooveHits(step: number): Record<string, { hit: boolean }>;
}

/** The kit, transport, groove and default setup as one script that sets `window.engine`. */
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
            ? ['kit', 'transport', 'groove', 'setup'].map((name) => `export * from '${engineDir}/${name}.ts';`).join('\n')
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

/**
 * Sample indices where a new hit starts: the level jumps to twice what the
 * 25 ms before it held. The last 2 ms are left out of that window, so the
 * rising attack itself does not raise the bar.
 */
function onsets(samples: number[]): number[] {
  const window = Math.round(0.025 * sampleRate);
  const gap = Math.round(0.002 * sampleRate);
  const found: number[] = [];
  for (let n = 0; n < samples.length; n++) {
    const level = Math.abs(samples[n] ?? 0);
    if (level < 0.01 || n - (found.at(-1) ?? -Infinity) < window) continue;
    let before = 0;
    for (let k = Math.max(0, n - gap - window); k < n - gap; k++) before = Math.max(before, Math.abs(samples[k] ?? 0));
    if (level > 2 * before) found.push(n);
  }
  return found;
}

let engineScript = '';
test.beforeAll(async () => {
  engineScript = await bundleEngine();
});

test('one bar of the groove through the kit is audible, does not clip, and puts bd on its steps', async ({ page }) => {
  await page.setContent('<!doctype html><title>kit render</title>');
  await page.addScriptTag({ content: engineScript });

  const { all, bdOnly, bdSteps, bpm } = await page.evaluate(async (sampleRate) => {
    const engine = (window as unknown as { engine: Engine }).engine;
    const setup = engine.defaultSetup();
    const bar = (60 / setup.bpm / 8) * 32;

    async function render(drums: string[]): Promise<number[]> {
      const context = new OfflineAudioContext(1, Math.ceil(bar * sampleRate), sampleRate);
      const kit = engine.createNativeKit(context);
      const transport = engine.createTransport(setup.bpm);
      transport.start(0);
      for (const hit of transport.hitsBefore(bar)) {
        if (drums.includes(hit.drum)) kit.trigger(hit.drum, hit.time, hit.velocity, setup.sound[hit.drum]);
      }
      const buffer = await context.startRendering();
      return Array.from(buffer.getChannelData(0));
    }

    return {
      all: await render(['bd', 'sd', 'hh']),
      bdOnly: await render(['bd']),
      bdSteps: [...Array(32).keys()].filter((step) => engine.grooveHits(step).bd?.hit),
      bpm: setup.bpm,
    };
  }, sampleRate);

  const peak = Math.max(...all.map(Math.abs));
  expect(peak, 'peak of the full bar').toBeGreaterThan(0.1);
  expect(peak, 'peak of the full bar').toBeLessThan(1);

  const expected = bdSteps.map((step) => Math.round(((step * 60) / bpm / 8) * sampleRate));
  const found = onsets(bdOnly);
  expect(found).toHaveLength(expected.length);
  found.forEach((sample, i) => expect(Math.abs(sample - (expected[i] ?? 0)), `bd onset ${i}`).toBeLessThanOrEqual(renderQuantum));
});
