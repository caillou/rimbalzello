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
function prerenderCredits(commit: string): Plugin {
  return {
    name: 'prerender-credits',
    // A function, so `$` in the credits stays text rather than a replacement pattern.
    transformIndexHtml: (html) => html.replace(CREDITS_SLOT, () => creditsHtml({ commitHash: commit, repositoryUrl })),
  };
}

const commit = commitHash();

export default defineConfig({
  plugins: [solid(), prerenderCredits(commit)],
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
