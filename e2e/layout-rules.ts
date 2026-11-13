import { expect, type Page } from '@playwright/test';

// The play screen's layout rules, checked at the page's current viewport:
// it never scrolls, every control lies inside the viewport and is at least
// 44 px, no two controls overlap, and every step line ends inside its step
// display. Reused at every layout's viewports.

/** Controls: buttons, links, inputs and sliders, plus touch surfaces marked `data-control` (the pad). */
export const CONTROLS = 'button, a[href], input, select, textarea, [role="slider"], [data-control]';

/**
 * The step display's drum labels (the mute toggles) sit one per text line,
 * so three stacked 44 px squares would take 132 px of pad height. They are
 * checked at 44 px wide and at least this tall instead (the WCAG minimum),
 * until https://github.com/caillou/rimbalzello/issues/3 settles their size.
 */
const STEP_DISPLAY = '[aria-label="step display"]';
const ROW_TARGETS = `${STEP_DISPLAY} button`;
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
    ({ controls, rowTargets, stepDisplay }) => {
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
      // The last step of each line against its step display's content box:
      // steps running past it would sit under the loop strip or off the
      // column, where the play screen's own overflow does not see them.
      const display = document.querySelector(stepDisplay);
      const lines = display ? [...display.querySelectorAll('.step-line')] : [];
      const spilledSteps = lines.flatMap((line) => {
        const last = line.lastElementChild;
        if (!display || !last) return [];
        const edge = display.getBoundingClientRect().right - parseFloat(getComputedStyle(display).paddingRight);
        const over = last.getBoundingClientRect().right - edge;
        return over > 0.5 ? [`${line.closest('[data-drum]')?.getAttribute('data-drum')} by ${over.toFixed(1)} px`] : [];
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
        spilledSteps,
      };
    },
    { controls: CONTROLS, rowTargets: ROW_TARGETS, stepDisplay: STEP_DISPLAY },
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
  expect(layout.spilledSteps, 'step lines running past their step display').toEqual([]);
  expect(boxes.length, 'controls found').toBeGreaterThan(0);
}
