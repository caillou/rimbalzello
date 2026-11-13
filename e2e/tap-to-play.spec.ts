import { expect, test } from '@playwright/test';
import { countStartedVoices, expectGrooveRunning, startedVoices } from './started-voices.ts';

test.beforeEach(async ({ page }) => {
  await countStartedVoices(page);
  await page.goto('./');
});

test('one tap on the overlay starts the groove and the overlay goes away', async ({ page }) => {
  const overlay = page.getByRole('button', { name: '▶ tap to play' });
  await overlay.click();

  await expect(overlay).toBeHidden();
  await expect(page.getByRole('button', { name: 'stop' })).toBeVisible();
  await expectGrooveRunning(page);
});

test('stop silences the groove and play starts it again', async ({ page }) => {
  await page.getByRole('button', { name: '▶ tap to play' }).click();
  await expectGrooveRunning(page);

  await page.getByRole('button', { name: 'stop' }).click();
  const atStop = await startedVoices(page);
  // Longer than the lookahead plus several steps at 128 bpm.
  await page.waitForTimeout(400);
  expect(await startedVoices(page)).toBe(atStop);

  await page.getByRole('button', { name: 'play' }).click();
  await expectGrooveRunning(page);
});
