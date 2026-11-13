import { DRUM_NAMES, DRUMS } from './drums.ts';
import { expect, test, type Locator, type Page } from './fixtures.ts';

// The drums' names, written out where src/ui/drum-names.ts says (design.md,
// "Drum names"). Each control is found by the name it shows: its accessible
// name holds its label, so voice control finds it by what it says.

/** The names whose text runs out of their box or onto a second line. */
async function spilled(names: Locator[]): Promise<string[]> {
  const found: string[] = [];
  for (const name of names) {
    const problem = await name.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const text = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      if (!text) return `no text in ${element.outerHTML}`;
      const range = document.createRange();
      range.selectNodeContents(text);
      const lines = range.getClientRects().length;
      const { left, right } = range.getBoundingClientRect();
      const inside = left >= box.left - 0.5 && right <= box.right + 0.5;
      return lines === 1 && inside ? undefined : `"${text.textContent}": ${lines} lines, ${inside ? '' : 'not '}inside`;
    });
    if (problem) found.push(problem);
  }
  return found;
}

const muteLabel = (page: Page, label: string) => page.getByRole('button', { name: `mute ${label}`, exact: true });

for (const { viewport, steps, sound, keycaps } of [
  // Tablets: the narrowest, and an iPad.
  { viewport: { width: 700, height: 900 }, steps: 'short', sound: 'tabs', keycaps: false },
  { viewport: { width: 820, height: 1106 }, steps: 'short', sound: 'tabs', keycaps: false },
  // Laptops, with the keycaps after the mute labels: 1024×768 has the
  // narrowest right column (520 px), as have the short windows at 800 and
  // 700 px, whose sound folds into the drum tabs, like 1280×580's.
  { viewport: { width: 1280, height: 800 }, steps: 'full', sound: 'headings', keycaps: true },
  { viewport: { width: 1024, height: 768 }, steps: 'full', sound: 'headings', keycaps: true },
  { viewport: { width: 800, height: 600 }, steps: 'full', sound: 'tabs', keycaps: true },
  { viewport: { width: 700, height: 600 }, steps: 'full', sound: 'tabs', keycaps: true },
  { viewport: { width: 1280, height: 580 }, steps: 'full', sound: 'tabs', keycaps: true },
] as const) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test(`the strips and the ${sound === 'tabs' ? 'drum tabs' : 'sound headings'} write the names out${steps === 'full' ? ', the mute labels too,' : ''} each whole on its line`, async ({
      page,
    }) => {
      await page.goto('./');
      // Measured in the app's own font, not a fallback.
      await page.evaluate(() => document.fonts.ready);
      if (keycaps) await page.keyboard.press('KeyH');

      const names: Locator[] = [];
      for (const drum of DRUMS) {
        const name = DRUM_NAMES[drum];
        const strip = page.getByRole('slider', { name, exact: true }).getByText(name, { exact: true });
        const soundName =
          sound === 'tabs' ? page.getByRole('tab', { name, exact: true }) : page.getByRole('heading', { name, exact: true });
        await expect(strip).toBeVisible();
        await expect(soundName).toContainText(name);
        names.push(strip, soundName);

        if (steps === 'full') {
          const mute = muteLabel(page, name);
          if (keycaps) await expect(mute.locator('kbd')).toBeVisible();
          await expect(mute).toContainText(name);
          names.push(mute);
        } else {
          await expect(muteLabel(page, drum)).toHaveText(drum, { useInnerText: true });
        }
      }
      expect(await spilled(names)).toEqual([]);
    });
  });
}

test.describe('at 1024×768, the narrowest laptop column', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('a click on the end of a written-out mute label mutes its drum and strikes the name through; another unmutes it', async ({
    page,
  }) => {
    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);
    const mute = muteLabel(page, 'snare drum');
    await expect(mute).toContainText('snare drum');

    // On the `m` of `drum`, the far end of the name.
    const end = await mute.evaluate((label) => {
      const range = document.createRange();
      range.selectNodeContents([...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!);
      const { right, top, height } = range.getBoundingClientRect();
      return { x: Math.round(right - 4), y: Math.round(top + height / 2) };
    });

    await page.mouse.click(end.x, end.y);
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await expect(mute).toHaveCSS('text-decoration-line', 'line-through');

    await page.mouse.click(end.x, end.y);
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await expect(mute).not.toHaveCSS('text-decoration-line', 'line-through');
  });
});

test.describe('an iPad in portrait', () => {
  test.use({ viewport: { width: 820, height: 1106 } });

  test('turned to landscape writes the mute labels out, and back shortens them; the step lines stay', async ({
    page,
  }) => {
    await page.goto('./');
    const mute = page.getByRole('group', { name: 'step display' }).getByRole('button').first();
    const lines = page.locator('.step-line');
    /** The bd mute label shows `label`, and its name follows; each step line keeps its 32 steps. */
    async function expectSteps(label: string) {
      await expect(mute).toHaveText(label, { useInnerText: true });
      await expect(mute).toHaveAccessibleName(`mute ${label}`);
      await expect(lines).toHaveCount(3);
      for (const line of await lines.all()) await expect(line).toHaveText(/^[x·]{32}$/);
    }

    await expectSteps('bd');
    await page.setViewportSize({ width: 1106, height: 820 });
    await expectSteps('bass drum');
    await page.setViewportSize({ width: 820, height: 1106 });
    await expectSteps('bd');
  });
});
