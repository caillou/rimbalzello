import type { Page } from '@playwright/test';

/** The pad's X/Y readout as numbers, 0–100. */
export async function readout(page: Page): Promise<{ x: number; y: number }> {
  const text = await page.getByText(/^x \d+ · y \d+$/).textContent();
  const [, x, y] = /^x (\d+) · y (\d+)$/.exec(text ?? '') ?? [];
  return { x: Number(x), y: Number(y) };
}
