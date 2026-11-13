import { expect, test, type Page } from './fixtures.ts';

// The lock screen's tile (media-session.ts), as the page hands it to the
// browser. What a phone makes of it is checked on the device.
test.use({ viewport: { width: 393, height: 659 }, hasTouch: true });

/** The tile's subtitle and artwork, from the page's Media Session metadata. */
function tile(page: Page) {
  return page.evaluate(() => {
    const metadata = navigator.mediaSession.metadata;
    return {
      subtitle: metadata?.artist,
      artwork: (metadata?.artwork ?? []).map(({ src, sizes, type }) => ({ src, sizes, type })),
    };
  });
}

const readout = (page: Page) => page.getByRole('button', { name: /^\d+ bpm$/ });

test('the lock-screen artwork loads: a PNG of the size it declares', async ({ page }) => {
  await page.goto('./');
  const { artwork } = await tile(page);
  expect(artwork.length).toBeGreaterThan(0);
  for (const { src, sizes, type } of artwork) {
    expect(type).toBe('image/png');
    const response = await page.request.get(src);
    expect(response.status(), src).toBe(200);
    expect(response.headers()['content-type'], src).toBe('image/png');
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, src);
    expect(size, src).toBe(sizes);
  }
});

test('the lock-screen subtitle follows the tempo', async ({ page }) => {
  await page.goto('./');
  const subtitle = async () => (await tile(page)).subtitle;
  const before = await readout(page).textContent();
  expect(await subtitle()).toBe(before);

  await page.getByRole('button', { name: 'tempo up', exact: true }).tap();
  await expect(readout(page)).not.toHaveText(before ?? '');
  await expect.poll(subtitle).toBe(await readout(page).textContent());
});
