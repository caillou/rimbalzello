import { expect, test, type Page } from './fixtures.ts';

// The audio session on a desktop browser: the browser APIs a phone needs are
// stubbed, removed or driven from the page. A real iPhone (silent switch,
// calls, lock) is checked in the device acceptance run.

declare global {
  interface Window {
    /** The app's AudioContext, captured as it is created. */
    audioContext?: AudioContext;
    /** While true, every AudioContext resume is refused, as a browser does after an interruption. */
    refuseResume: boolean;
    wakeLocks: { released: boolean }[];
  }
}

/** Removes browser APIs before the app loads, as on a browser that lacks them. */
function withoutApis(page: Page, ...names: ('audioSession' | 'wakeLock')[]) {
  return page.addInitScript((names) => {
    for (const name of names) {
      Reflect.deleteProperty(Navigator.prototype, name);
      Reflect.deleteProperty(navigator, name);
    }
  }, names);
}

const tapToPlay = (page: Page) => page.getByRole('button', { name: '▶ tap to play' }).click();

test('a refused resume shows tap to resume; one tap resumes and hides it', async ({ page }) => {
  await page.addInitScript(() => {
    window.refuseResume = false;
    const Native = window.AudioContext;
    const { resume } = Native.prototype;
    Native.prototype.resume = function (this: AudioContext) {
      if (window.refuseResume) return Promise.reject(new DOMException('resume refused', 'NotAllowedError'));
      return Reflect.apply(resume, this, []) as Promise<void>;
    };
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        window.audioContext = this;
      }
    };
  });
  await page.goto('./');
  const contextState = () => page.evaluate(() => window.audioContext?.state);

  await tapToPlay(page);
  await expect.poll(contextState).toBe('running');

  await page.evaluate(() => {
    window.refuseResume = true;
    return window.audioContext?.suspend();
  });
  const tapToResume = page.getByRole('button', { name: 'tap to resume' });
  await expect(tapToResume).toBeVisible();

  await page.evaluate(() => (window.refuseResume = false));
  await tapToResume.click();
  await expect(tapToResume).toBeHidden();
  await expect.poll(contextState).toBe('running');
});

test('a wake lock is held while playing and released on stop', async ({ page }) => {
  await page.addInitScript(() => {
    window.wakeLocks = [];
    const wakeLock = {
      request: () => {
        const lock = {
          released: false,
          release: () => {
            lock.released = true;
            return Promise.resolve();
          },
        };
        window.wakeLocks.push(lock);
        return Promise.resolve(lock);
      },
    };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: wakeLock });
  });
  await page.goto('./');
  const locks = () => page.evaluate(() => window.wakeLocks.map((lock) => (lock.released ? 'released' : 'held')));

  await tapToPlay(page);
  await expect.poll(locks).toEqual(['held']);

  await page.getByRole('button', { name: 'stop' }).click();
  await expect.poll(locks).toEqual(['released']);
});

test('the tap sets a playback audio session where the browser has one', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'audioSession', { configurable: true, value: { type: 'auto' } });
  });
  await page.goto('./');

  await tapToPlay(page);
  const type = await page.evaluate(() => (navigator as Navigator & { audioSession: { type: string } }).audioSession.type);
  expect(type).toBe('playback');
  await expect(page.locator('audio'), 'no silent audio needed').toHaveCount(0);
});

test('without an audio session API, the tap starts a looping silent audio element', async ({ page }) => {
  await withoutApis(page, 'audioSession');
  await page.goto('./');

  await tapToPlay(page);
  const playing = () =>
    page.evaluate(() => {
      const audio = document.querySelector('audio');
      return !!audio && audio.loop && !audio.paused && audio.currentTime > 0;
    });
  await expect.poll(playing).toBe(true);
});

test('a browser without audioSession or wakeLock plays and stops without errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`));
  await withoutApis(page, 'audioSession', 'wakeLock');
  await page.goto('./');

  await tapToPlay(page);
  await page.getByRole('button', { name: 'stop' }).click();
  await page.getByRole('button', { name: 'play' }).click();
  await page.getByRole('button', { name: 'stop' }).click();

  expect(problems).toEqual([]);
});
