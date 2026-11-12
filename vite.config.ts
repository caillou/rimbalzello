import { execFileSync } from 'node:child_process';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

/** The commit being built: GITHUB_SHA in CI, the checked-out HEAD locally. */
function commitHash(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [solid()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash()),
  },
  test: {
    include: ['src/**/*.test.ts'],
    // vite-plugin-solid defaults tests to jsdom; engine tests need no DOM.
    environment: 'node',
  },
});
