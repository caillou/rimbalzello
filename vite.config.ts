import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';
import { repositoryUrl } from './src/repository.ts';
import { creditsHtml } from './src/ui/about-credits.ts';

/** The commit being built: GITHUB_SHA in CI, the checked-out HEAD locally. */
function commitHash(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** Where about/index.html takes the credits. */
const CREDITS_SLOT = '<!-- credits: prerendered by vite.config.ts -->';

/** Prerenders the credits into about/index.html, so /about/ shows them before any JavaScript runs. */
function prerenderCredits(commit: string, basePath: string): Plugin {
  return {
    name: 'prerender-credits',
    // A function, so `$` in the credits stays text rather than a replacement pattern.
    transformIndexHtml: (html) =>
      html.replace(CREDITS_SLOT, () => creditsHtml({ commitHash: commit, repositoryUrl, basePath })),
  };
}

/**
 * The path the site is served under: '/' by default, as rimbalzello.caillou.ch
 * serves it. Set BASE_PATH (e.g. '/rimbalzello/') to build for a path instead.
 * The app's own links and the HTML pages read it as import.meta.env.BASE_URL
 * and %BASE_URL%.
 */
const base = process.env.BASE_PATH || '/';
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error(`BASE_PATH must start and end with a slash, got ${base}`);
}

const commit = commitHash();

export default defineConfig({
  base,
  plugins: [solid(), prerenderCredits(commit, base)],
  define: {
    __COMMIT_HASH__: JSON.stringify(commit),
  },
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        // The same app starting with about open, its credits prerendered.
        about: resolve(import.meta.dirname, 'about/index.html'),
        // Static page with the shared stylesheet only, served by GitHub Pages for unknown URLs.
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // vite-plugin-solid defaults tests to jsdom; engine tests need no DOM.
    environment: 'node',
  },
});
