import { expect, type Page } from '@playwright/test';

// The play screen's layout rules, checked at the page's current viewport:
// it never scrolls, every control lies inside the viewport and is at least
// 44 px, and no two controls overlap. Reused at every layout's viewports.

/** Controls: buttons, links, inputs and sliders, plus touch surfaces marked `data-control` (the pad). */
const CONTROLS = 'button, a[href], input, select, textarea, [role="slider"], [data-control]';

/**
 * The step display's drum labels (the mute toggles) sit one per text line,
 * so three stacked 44 px squares would take 132 px of pad height. They are
 * checked at 44 px wide and at least this tall instead (the WCAG minimum),
 * until https://github.com/caillou/rimbalzello/issues/3 settles their size.
 */
const ROW_TARGETS = '[aria-label="step display"] button';
const ROW_TARGET_HEIGHT = 24;

const MIN_TARGET = 44;

interface Box {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export async function expectLayoutRules(page: Page): Promise<void> {
  const layout = await page.evaluate(
    ({ controls, rowTargets }) => {
      const screen = document.querySelector('main');
      const rows = new Set(document.querySelectorAll(rowTargets));
      const elements = [...document.querySelectorAll(controls)].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
      });
      const box = (element: Element): Box & { row: boolean } => {
        const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
        const label = element.getAttribute('aria-label') ?? element.textContent?.replace(/\s+/g, ' ').trim();
        return {
          name: `${element.tagName.toLowerCase()} "${label}"`,
          left,
          top,
          right,
          bottom,
          width,
          height,
          row: rows.has(element),
        };
      };
      const boxes = elements.map(box);
      // Pairs where one control sits inside the other (an overlay on the pad) are left out.
      const pairs: [string, string, number][] = [];
      elements.forEach((a, i) => {
        elements.slice(i + 1).forEach((b, j) => {
          if (a.contains(b) || b.contains(a)) return;
          const p = boxes[i]!;
          const q = boxes[i + 1 + j]!;
          const width = Math.min(p.right, q.right) - Math.max(p.left, q.left);
          const height = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
          if (width > 0.5 && height > 0.5) pairs.push([p.name, q.name, Math.round(width * height)]);
        });
      });
      const page = document.scrollingElement!;
      return {
        viewport: { width: innerWidth, height: innerHeight },
        page: { width: page.scrollWidth, height: page.scrollHeight },
        // Content cut off by the play screen itself counts as not fitting too.
        screen: screen && {
          overflowX: screen.scrollWidth - screen.clientWidth,
          overflowY: screen.scrollHeight - screen.clientHeight,
        },
        boxes,
        overlapping: pairs,
      };
    },
    { controls: CONTROLS, rowTargets: ROW_TARGETS },
  );

  const { viewport, boxes } = layout;
  expect(layout.page, 'the page does not scroll').toEqual(viewport);
  expect(layout.screen, 'the play screen fits its content').toEqual({ overflowX: 0, overflowY: 0 });

  const outside = boxes.filter(
    (b) => b.left < 0 || b.top < 0 || b.right > viewport.width + 0.5 || b.bottom > viewport.height + 0.5,
  );
  expect(outside.map((b) => b.name), 'controls outside the viewport').toEqual([]);

  const small = boxes
    .filter((b) => b.width < MIN_TARGET || b.height < (b.row ? ROW_TARGET_HEIGHT : MIN_TARGET))
    .map((b) => `${b.name} ${Math.round(b.width)}×${Math.round(b.height)}`);
  expect(small, 'controls under 44 px').toEqual([]);

  expect(layout.overlapping, 'overlapping controls').toEqual([]);
  expect(boxes.length, 'controls found').toBeGreaterThan(0);
}
