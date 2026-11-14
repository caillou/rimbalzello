import { expect, test, type Page } from './fixtures.ts';

// iOS 26 and 27 blur whatever scrolls under the status bar and Safari's bars
// (the Liquid Glass scroll edge), unless a pinned, opaque, full-width box
// sits at the top: then they paint its colour instead. Every page keeps one,
// at the top and scrolled to the bottom (design.md, Home screen).

/**
 * The top edge iOS paints as a solid colour extension, checked at the
 * page's current scroll position. A stricter version of WebKit's rule
 * (LocalFrameView::fixedContainerEdges): from the element 4 px inside the
 * top centre, up through its ancestors, the fixed or sticky boxes are the
 * candidates. One under 90 % of the viewport wide is passed over; the first
 * one at least that wide decides, and must start at the top, be more than
 * 10 px and at most 1.05 viewports tall, show (opacity of at least 0.1) and
 * have an opaque background (alpha above 0.75), here the page's `--bg`.
 * WebKit is looser: it walks past a box that is too tall or hidden and
 * blends a translucent background. It is also stricter in one case this
 * check ignores: it stops at a narrow but tall box (a sidebar).
 */
async function expectSolidTopEdge(page: Page): Promise<void> {
  const found = await page.evaluate(() => {
    const name = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.classList.length ? `.${[...element.classList].join('.')}` : ''}`;
    const hit = document.elementFromPoint(innerWidth / 2, 4);
    const passedOver: string[] = [];
    for (let element = hit; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (!['fixed', 'sticky', '-webkit-sticky'].includes(style.position)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 0.9 * innerWidth) {
        passedOver.push(`${name(element)} ${Math.round(rect.width)} px wide`);
        continue;
      }
      return {
        hit: hit && name(hit),
        passedOver,
        candidate: {
          name: name(element),
          top: rect.top,
          height: rect.height,
          opacity: Number(style.opacity),
          background: style.backgroundColor,
        },
        viewportHeight: innerHeight,
        pageBackground: getComputedStyle(document.body).backgroundColor,
      };
    }
    return { hit: hit && name(hit), passedOver, candidate: null, viewportHeight: innerHeight, pageBackground: '' };
  });

  const where = `hit ${found.hit}, passed over [${found.passedOver.join(', ')}]`;
  const { candidate: box } = found;
  if (!box) throw new Error(`no fixed or sticky box at least 90 % wide over the top edge (${where})`);
  const label = `${box.name} (${where})`;
  const rgb = /^rgba?\([^,]+,[^,]+,[^,)]+(?:,\s*([\d.]+))?\)$/.exec(box.background);
  if (!rgb) throw new Error(`${label}: unreadable background ${box.background}`);
  const alpha = Number(rgb[1] ?? 1);
  expect(box.top, `${label} starts at the top`).toBeLessThanOrEqual(0.5);
  expect(box.height, `${label} is more than 10 px tall`).toBeGreaterThan(10);
  expect(box.height, `${label} is at most 1.05 viewports tall`).toBeLessThanOrEqual(1.05 * found.viewportHeight);
  expect(box.opacity, `${label} shows`).toBeGreaterThanOrEqual(0.1);
  expect(alpha, `${label} has an opaque background`).toBeGreaterThan(0.75);
  expect(box.background, `${label} is on the page's background`).toBe(found.pageBackground);
}

const viewports = (...sizes: [number, number][]) => sizes.map(([width, height]) => ({ width, height }));

for (const viewport of viewports([393, 852], [1280, 800])) {
  test(`the play screen at ${viewport.width}×${viewport.height} keeps a solid top edge`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.getByRole('heading', { name: '# rimbalzello' })).toBeVisible();
    await expectSolidTopEdge(page);
  });
}

test.describe('a phone in landscape', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true });

  test('the rotate hint keeps a solid top edge', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('status').filter({ hasText: 'turn the phone upright' })).toBeVisible();
    await expectSolidTopEdge(page);
  });
});

async function scrollToBottom(page: Page, scroller: string) {
  await page.locator(scroller).evaluate((element) => element.scrollTo(0, element.scrollHeight));
}

for (const viewport of viewports([375, 667], [1024, 768])) {
  test(`/about/ at ${viewport.width}×${viewport.height} keeps a solid top edge, scrolled or not`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./about/');
    const view = page.getByRole('region', { name: 'about' });
    await expect(view.getByRole('heading', { level: 1, name: '# rimbalzello' })).toBeVisible();
    await expectSolidTopEdge(page);

    await scrollToBottom(page, '.about');
    await expect(view.getByText('not affiliated with Mutable Instruments.', { exact: false })).toBeInViewport();
    await expectSolidTopEdge(page);
  });
}

// Short enough that the back link starts below the fold: the fixed body
// has to scroll itself, as html no longer does.
test('the 404 page scrolls itself on a short window, keeping its top edge', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 220 });
  await page.goto('./404.html');
  await expect(page.getByRole('heading', { name: '# 404' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const back = page.getByRole('link', { name: 'back to rimbalzello' });
  await expect(back).not.toBeInViewport({ ratio: 1 });
  await expectSolidTopEdge(page);

  await scrollToBottom(page, 'body');
  await expect(back).toBeInViewport({ ratio: 1 });
  await expectSolidTopEdge(page);
});
