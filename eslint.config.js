import js from '@eslint/js';
import solid from 'eslint-plugin-solid/configs/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist', 'docs', 'test-results', 'playwright-report', 'blob-report']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.tsx'],
    ...solid,
  },
  {
    // The engine stays framework-free so the UI can be swapped without touching it.
    files: ['src/engine/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['solid-js', 'solid-js/*'], message: 'The engine never imports Solid.' },
            { group: ['**/ui', '**/ui/*'], message: 'The engine never imports UI code.' },
          ],
        },
      ],
    },
  },
);
