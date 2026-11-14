import { expect, test } from './fixtures.ts';
import { expectPng } from './png.ts';

// Add to Home Screen reads the web app manifest and the apple-touch-icon. A
// missing manifest, a broken icon path or a start_url carrying a setup is
// what a player sees on the home screen, and the build gives no other signal.
// The checks are HTTP-level, so one browser runs them.

interface Manifest {
  start_url: string;
  scope: string;
  icons: { src: string; sizes: string }[];
}

test('every page links a manifest that opens the bare address and loads its icons', async ({
  page,
  baseURL,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'HTTP-level: one browser is enough');
  const base = new URL(baseURL!);
  const link = (rel: string) =>
    page.locator(`link[rel="${rel}"]`).evaluate((link: HTMLLinkElement) => link.href);

  // Every page links the same manifest and apple-touch-icon.
  const pages = ['./', './about/', './404.html'];
  const links: Record<string, { manifest: string; touchIcon: string }> = {};
  for (const path of pages) {
    await page.goto(path);
    links[path] = { manifest: await link('manifest'), touchIcon: await link('apple-touch-icon') };
  }
  const { manifest: manifestUrl, touchIcon } = links['./']!;
  expect(links).toEqual(Object.fromEntries(pages.map((path) => [path, links['./']])));

  const response = await page.request.get(manifestUrl);
  expect(response.status(), manifestUrl).toBe(200);
  const manifest = (await response.json()) as Manifest;

  for (const key of ['start_url', 'scope'] as const) {
    const url = new URL(manifest[key], manifestUrl);
    expect({ origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash }, key).toEqual({
      origin: base.origin,
      pathname: base.pathname,
      search: '',
      hash: '',
    });
  }

  for (const { src, sizes } of manifest.icons) await expectPng(page, new URL(src, manifestUrl).href, sizes);
  await expectPng(page, touchIcon, await page.locator('link[rel="apple-touch-icon"]').getAttribute('sizes'));
});
