import { expect, type Page } from './fixtures.ts';

/** Checks that `src` loads as a PNG and decodes to `sizes` (`512x512`). */
export async function expectPng(page: Page, src: string, sizes: string | null | undefined) {
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
