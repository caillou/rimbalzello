# rimbalzello

A drum machine for the browser that you play by moving through a map of drum patterns. Phone first, a live instrument, a static site at [rimbalzello.caillou.ch](https://rimbalzello.caillou.ch).

## Development

Node comes from `.nvmrc` (asdf in legacy mode). pnpm is pinned in `package.json` `packageManager` and managed by corepack:

```sh
npm install --global corepack   # Node 25 and later no longer bundle it
corepack enable pnpm
pnpm install
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Static site in `dist/` |
| `pnpm preview` | Serves `dist/` |
| `pnpm typecheck` | TypeScript, app and tooling |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | Browser checks (Playwright: Chromium, WebKit, Firefox) against a fresh build |
| `pnpm licences:check` | Fails on any dependency that breaks the licence rule below |

Every push runs the checks in GitHub Actions. On `main`, a green run deploys `dist/` to GitHub Pages; a red run does not deploy.

## Setup outside the repo

These steps are manual and done once:

1. Create the public GitHub repo and push `main`.
2. In the repo settings, under Pages, set the source to "GitHub Actions".
3. Add a DNS record for `rimbalzello.caillou.ch`: a `CNAME` pointing at `caillou.github.io`. The `CNAME` file in the build output tells Pages which domain to serve.

## Licence

rimbalzello is licensed under the GNU General Public License, version 3 or (at your option) any later version (GPL-3.0-or-later); see `LICENSE`. It has to be, because the drum map and the pattern generator come from Grids by Émilie Gillet (Mutable Instruments), which is GPL. The third-party notices ship with the site as `third-party-notices.txt`.

MIT is a possible later step: everything apart from the Grids map is written by the author, so the project can be relicensed once the map is replaced or Émilie Gillet allows it.

Dependency rule: dependencies must be under a permissive, LGPL or GPL-3-compatible licence. No GPL-2.0-only, no unlicensed and no non-commercial code or assets; the rule covers future sample packs too. `pnpm licences:check` enforces it in CI.

## Credits

The drum map and the pattern generator are based on Grids, and the drum voices take their structure and parameter names from Peaks, both by Émilie Gillet (Mutable Instruments). rimbalzello is not affiliated with Mutable Instruments; "Mutable Instruments" is a registered trademark. The font is IBM Plex Mono.
