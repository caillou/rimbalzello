import type { Locator } from './fixtures.ts';

export interface FingerAt {
  /** Where along the control, 0 to 1: along its strip track when it has one, else along the control. */
  at?: number;
  /** Then this many px further right (left when negative). */
  dx?: number;
  pointerId?: number;
}

/**
 * A finger on a control, as a synthetic touch pointer: landing, moving or
 * lifting at `at` along the control's track (or the control itself), `dx` px
 * further, halfway down the control. Synthetic, because Playwright's touch
 * has no moves.
 */
export function finger(
  control: Locator,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  { at = 0.5, dx = 0, pointerId = 41 }: FingerAt = {},
) {
  return control.evaluate(
    (element, { type, at, dx, pointerId }) => {
      const box = element.getBoundingClientRect();
      const along = (element.querySelector('.strip-track') ?? element).getBoundingClientRect();
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId,
          pointerType: 'touch',
          isPrimary: true,
          clientX: along.left + at * along.width + dx,
          clientY: box.top + box.height / 2,
        }),
      );
    },
    { type, at, dx, pointerId },
  );
}
