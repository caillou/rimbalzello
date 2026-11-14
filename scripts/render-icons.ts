// Draws the site's icon, three lines of the step display (`x` a hit, `·` a
// rest, in the drums' colours), and writes it to public/:
// - icon.svg: the favicon;
// - favicon-32.png: the favicon for browsers without SVG favicons;
// - apple-touch-icon.png: the iPhone home screen, and Safari's fallback artwork;
// - icon-512.png, icon-256.png: the lock-screen artwork (src/engine/media-session.ts);
// - icon-192.png, icon-512.png, icon-maskable-512.png: the web app manifest
//   (public/manifest.webmanifest), for browsers that install from it.
// Run by hand after changing the drawing, with `pnpm icons`, and commit what
// it writes. The PNGs are rendered by Playwright's Chromium, muted, from a
// page that holds only the image.

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The three lines, top to bottom: `x` a hit, `·` a rest, and the colour of the hits (base.css). */
const ROWS = [
  { pattern: 'xxxx', colour: '#ffd866' }, // bd
  { pattern: '·x·x', colour: '#ff61ef' }, // sd
  { pattern: '··x·', colour: '#bef289' }, // hh
];

const BACKGROUND = '#202322';
/**
 * The rests' grey: darker on purpose than the app's rests (--text-tertiary,
 * #757575), so the hits' colours carry the icon at 32 px.
 */
const REST = '#4a4f4c';

/** The SVG's size; the PNGs scale it. */
const SIZE = 512;
/** The favicon's corner radius. The PNGs for the phone are full-bleed squares: iOS rounds them itself. */
const CORNER = 112;

// The cells are measured in font units of IBM Plex Mono Bold, the app's font:
// 600 wide, x-height 516, y up from the baseline. The `x` is the outline of
// IBM Plex Mono Bold's `x`, Copyright 2017 IBM Corp., OFL-1.1
// (public/third-party-notices.txt).
const ADVANCE = 600;
const X_HEIGHT = 516;
const X_OUTLINE = [
  [23, 0], [216, 262], [36, 516], [205, 516], [260, 433], [302, 366], [310, 366], [353, 433], [409, 516],
  [564, 516], [384, 270], [577, 0], [407, 0], [342, 97], [297, 166], [289, 166], [245, 97], [179, 0],
] as const;
const X_LEFT = Math.min(...X_OUTLINE.map(([u]) => u));
const X_RIGHT = Math.max(...X_OUTLINE.map(([u]) => u));
/**
 * The rest's dot: a square with sharp corners, like the app's slider thumbs,
 * centred on the `x`. A little smaller than the font's `·` (210 wide), so the
 * corners do not outweigh the `x`.
 */
const DOT = 194;

/** Pixels per font unit on the 512 px drawing. */
const SCALE = 0.13;
/** From one line's x-height top to the next, in px. */
const LINE_PITCH = 117;
/**
 * Moves the grid from the drawing's centre, in px: the full top line weighs
 * more than the rests below it.
 */
const OPTICAL_SHIFT_Y = 4;

/** A coordinate as the SVG writes it: at most two decimals. */
const svgNumber = (value: number) => String(Math.round(value * 100) / 100);

/** The icon, as an SVG document. */
function drawIcon(): string {
  const columns = Math.max(...ROWS.map((row) => [...row.pattern].length));
  const inkWidth = ((columns - 1) * ADVANCE + X_RIGHT - X_LEFT) * SCALE;
  const inkHeight = (ROWS.length - 1) * LINE_PITCH + X_HEIGHT * SCALE;
  // The top left of the first cell: its advance box at the x-height.
  const left = (SIZE - inkWidth) / 2 - X_LEFT * SCALE;
  const top = (SIZE - inkHeight) / 2 + OPTICAL_SHIFT_Y;

  const hits: string[] = [];
  const rests: string[] = [];
  ROWS.forEach((row, line) => {
    const cellTop = top + line * LINE_PITCH;
    const xs: string[] = [];
    [...row.pattern].forEach((step, column) => {
      const cellLeft = left + column * ADVANCE * SCALE;
      if (step === 'x') {
        const points = X_OUTLINE.map(([u, v]) => `${svgNumber(cellLeft + u * SCALE)} ${svgNumber(cellTop + (X_HEIGHT - v) * SCALE)}`);
        xs.push(`M${points.join('L')}Z`);
      } else {
        const size = DOT * SCALE;
        const x = cellLeft + (ADVANCE * SCALE - size) / 2;
        const y = cellTop + (X_HEIGHT * SCALE - size) / 2;
        rests.push(
          `<rect x="${svgNumber(x)}" y="${svgNumber(y)}" width="${svgNumber(size)}" height="${svgNumber(size)}"/>`,
        );
      }
    });
    if (xs.length) hits.push(`<path fill="${row.colour}" d="${xs.join('')}"/>`);
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
    '<!-- rimbalzello, GPL-3.0-or-later. Drawn by scripts/render-icons.ts: edit it there. -->',
    `<rect width="${SIZE}" height="${SIZE}" rx="${CORNER}" fill="${BACKGROUND}"/>`,
    `<g fill="${REST}">${rests.join('')}</g>`,
    ...hits,
    '</svg>',
    '',
  ].join('\n');
}

/**
 * The PNGs: `round` keeps the favicon's transparent corners, `square` fills
 * them. `scale` shrinks the drawing about the centre: the maskable icon's
 * grid has to fit the safe zone, a circle of radius 40 % (205 px at 512).
 * The grid's corners reach about 212 px from the centre; at 0.85, 180 px.
 */
const PNGS: readonly { file: string; size: number; corners: 'round' | 'square'; scale?: number }[] = [
  { file: 'favicon-32.png', size: 32, corners: 'round' },
  { file: 'apple-touch-icon.png', size: 180, corners: 'square' },
  { file: 'icon-192.png', size: 192, corners: 'square' },
  { file: 'icon-256.png', size: 256, corners: 'square' },
  { file: 'icon-512.png', size: SIZE, corners: 'square' },
  { file: 'icon-maskable-512.png', size: SIZE, corners: 'square', scale: 0.85 },
];

const publicDir = resolve(import.meta.dirname, '../public');
const svg = drawIcon();
writeFileSync(resolve(publicDir, 'icon.svg'), svg);

const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
  for (const { file, size, corners, scale = 1 } of PNGS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const background = corners === 'square' ? BACKGROUND : 'transparent';
    const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const drawn = size * scale;
    const offset = (size - drawn) / 2;
    await page.setContent(
      `<body style="margin:0;background:${background}"><img style="display:block;width:${drawn}px;height:${drawn}px;margin:${offset}px" src="${source}"></body>`,
    );
    await page.locator('img').evaluate((image: HTMLImageElement) => image.decode());
    await page.screenshot({ path: resolve(publicDir, file), omitBackground: corners === 'round' });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`wrote icon.svg and ${PNGS.map(({ file }) => file).join(', ')} to public/`);
