# rimbalzello

A Grids-style drum machine for the browser: a live instrument, phone first, static site on GitHub Pages.

## Git

Commit straight to `main`. Every push to `main` deploys once CI is green, so keep `main` green. Use a worktree only when trying alternative approaches side by side.

## Tooling

Node comes from asdf in legacy mode: the version lives in `.nvmrc` (asdf reads it via `legacy_version_file`); keep `.tool-versions` out of the repo. pnpm is the package manager, pinned in `package.json` `packageManager` as `pnpm@<version>` and run through corepack. Node 25 and later no longer bundle corepack: install it with `npm install --global corepack`, then `corepack enable pnpm`. Use `pnpm` for every install and script, in CI too; CI reads Node from `.nvmrc` and enables pnpm the same way. TypeScript stays on 6.0 until typescript-eslint supports 7.

## Vocabulary

Name things with the terms in `CONTEXT.md` (setup, anchor, return, looper, slip, drift, drive, map, strips, …). Read it before naming a module, type, test or UI label.

## Specs

- v1: `docs/PRDs/2026-11-12-rimbalzello-v1/`. `prd.md` holds stories, modules and testing decisions; `design.md` and `designs/` hold the visual and interaction spec. Read `design.md` before any UI work. `reviews/` holds the review round behind v1; `reviews/summary.md` lists its decisions.

## Licence and naming

GPL-3.0-or-later for everything, because the Grids drum map is GPL. Dependencies must be permissive, LGPL or GPL-3-compatible: no GPL-2.0-only, no unlicensed or non-commercial code or assets. The product is called rimbalzello; Grids, Peaks and Émilie Gillet appear as credits (about page, README, source file headers).

## Tests

Write a test only where it would catch a regression a player would notice: pattern generator, transport and looper timing, URL round-trip, gestures, keyboard bindings, layout rules. Test through public interfaces. Leave out ceremonial tests: ones that restate the implementation, only check that something renders, or exist for coverage.
