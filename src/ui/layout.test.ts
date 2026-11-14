import { describe, expect, test } from 'vitest';
import { laptopZoom, type Size } from './layout';

// The laptop zoom in the windows not worth a browser for: a missing outer
// size, Firefox's zoomed outer size, Cmd − and the panels and toolbars that
// make the outer window differ from the page. Sizes in px as the page reads
// them; the desktop has no safe area, so the play screen is the inner size.
// Expected values follow tunables.layouts.laptopZoom: 1280×800, fit box
// 1024×700.

const desktop = (inner: Size, outer: Size) => laptopZoom({ screen: inner, inner, outer });

describe('the laptop zoom', () => {
  test.each([
    ['0×0', { width: 0, height: 0 }],
    ['NaN', { width: NaN, height: NaN }],
    ['0 wide', { width: 0, height: 1160 }],
  ])('without a usable outer size (%s), is the play screen’s own zoom', (_, outer) => {
    expect(desktop({ width: 1920, height: 1080 }, outer)).toBe(1.35);
  });

  test('in fullscreen at 100 %, takes no toolbar off', () => {
    expect(desktop({ width: 1920, height: 1080 }, { width: 1920, height: 1080 })).toBe(1.35);
  });

  test('in fullscreen under Cmd + (110 %), keeps the zoom the window wants', () => {
    // A 1760×1100 screen: 1100 ÷ 800, where the play screen's own would be 1000 ÷ 800.
    expect(desktop({ width: 1600, height: 1000 }, { width: 1760, height: 1100 })).toBeCloseTo(1.375, 10);
  });

  test('under Cmd − (80 %), shrinks with the page instead of growing to fill it', () => {
    // 1920×1080 under an 80 px toolbar: 1.35, where the play screen's own would be 1.6875.
    expect(desktop({ width: 2400, height: 1350 }, { width: 1920, height: 1160 })).toBeCloseTo(1.35, 10);
  });

  test('in Firefox, whose outer size scales with browser zoom, is the play screen’s own zoom (125 %)', () => {
    expect(desktop({ width: 1536, height: 864 }, { width: 1536, height: 928 })).toBeCloseTo(1.08, 10);
  });

  test('with a side panel open, grows to what the play screen holds, no further', () => {
    // A 600 px panel takes the inner width to 1320: the fit cap, 1320 ÷ 1024,
    // binds before the window's 1.45.
    expect(desktop({ width: 1320, height: 1080 }, { width: 1920, height: 1160 })).toBeCloseTo(1320 / 1024, 10);
  });

  test('under a tall toolbar (bookmarks bar, 115 px), takes all of it off', () => {
    expect(desktop({ width: 1920, height: 1000 }, { width: 1920, height: 1115 })).toBe(1.25);
  });

  test('with DevTools docked at the bottom, Cmd + (110 %) still enlarges the layout', () => {
    // A 2640×1400 window, 300 px of it toolbar and DevTools: the page is
    // 1100 high in outer px, 1.375, as at 100 %, and 1.1 times that on screen.
    expect(desktop({ width: 2640, height: 1100 }, { width: 2640, height: 1400 })).toBeCloseTo(1.375, 10);
    expect(desktop({ width: 2400, height: 1000 }, { width: 2640, height: 1400 })).toBeCloseTo(1.375, 10);
  });
});
