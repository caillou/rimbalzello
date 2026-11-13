# rimbalzello

A drum machine for the browser that you play by moving through a map of drum patterns. Phone first, a live instrument, a static site at [rimbalzello.caillou.ch](https://rimbalzello.caillou.ch/).

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
| `pnpm icons` | Redraws the icon (`public/icon.svg`) and its PNGs from `scripts/render-icons.ts` |

Every push runs the checks in GitHub Actions. On `main`, a green run deploys `dist/` to GitHub Pages; a red run does not deploy.

`BASE_PATH` sets the path the site is served under. It is `/` by default and in CI, which is how [rimbalzello.caillou.ch](https://rimbalzello.caillou.ch/) serves it. To check a build served under a path, run for example `BASE_PATH=/rimbalzello/ pnpm test:e2e`. It leaves `dist/` built for that path, so a later bare `pnpm preview` serves a page whose assets 404 until the next build.

## Setup outside the repo

These steps are manual and done once, in this order:

1. Create the public GitHub repo and push `main`.
2. Verify `caillou.ch` for the account under GitHub Settings, Pages, Verified domains. It adds a TXT record. Keep it.
3. Enable Pages with GitHub Actions as the source: `gh api -X POST repos/caillou/rimbalzello/pages -f build_type=workflow`.
4. Set the custom domain: `gh api -X PUT repos/caillou/rimbalzello/pages -f cname=rimbalzello.caillou.ch -f build_type=workflow`.
5. Only then add the DNS record, a CNAME from `rimbalzello` to `caillou.github.io`.
6. Run `gh variable set DEPLOY_PAGES -b true -R caillou/rimbalzello` so the deploy job runs, then push or re-run CI.
7. Once GitHub issues the certificate, turn on Enforce HTTPS with `gh api -X PUT repos/caillou/rimbalzello/pages -F https_enforced=true`.

The order guards against a subdomain takeover. The verified domain keeps other accounts from claiming `rimbalzello.caillou.ch`, and the DNS record only goes in once this repo holds the name. If Pages is ever turned off, remove the DNS record. The domain lives only in the Pages settings. There is no `CNAME` file, because GitHub ignores it when an Actions workflow publishes the site.

## Licence

rimbalzello is licensed under the GNU General Public License, version 3 or (at your option) any later version (GPL-3.0-or-later); see `LICENSE`. It has to be, because the drum map and the pattern generator come from Grids by Émilie Gillet (Mutable Instruments), which is GPL. The third-party notices ship with the site as `third-party-notices.txt`.

MIT is a possible later step: everything apart from the Grids map is written by the author, so the project can be relicensed once the map is replaced or Émilie Gillet allows it.

Dependency rule: dependencies must be under a permissive, LGPL or GPL-3-compatible licence. No GPL-2.0-only, no unlicensed and no non-commercial code or assets; the rule covers future sample packs too. `pnpm licences:check` enforces it in CI.

## Credits

The drum map and the pattern generator are based on Grids, and the drum voices take their structure and parameter names from Peaks, both by Émilie Gillet (Mutable Instruments). rimbalzello is not affiliated with Mutable Instruments; "Mutable Instruments" is a registered trademark. The font is IBM Plex Mono.
