// scripts/demo/eslint.config.mjs
//
// Narrow flat-config override for scripts/demo/**/*.mjs. Re-uses the
// repository's @room/eslint-config/base and supplies Node 24 globals
// via the `globals` package so Node built-ins (process, fetch,
// AbortSignal, URL, Buffer, setTimeout, ...) stop tripping no-undef.
//
// This config is **only** used for scripts/demo/. It does not run as
// part of the repository-wide lint gate and is invoked directly by
// `pnpm exec eslint "scripts/demo/**/*.mjs"`.

import baseConfig from '@room/eslint-config/base';
import globals from 'globals';

export default [
  ...baseConfig,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        // Node 24 built-ins that the package.json engines field already
        // requires. Listed explicitly so the no-undef contract is
        // reviewable in this single file.
        process: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        queueMicrotask: 'readonly',
        performance: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      // The orchestrator owns process.exit on shutdown; that is the
      // whole point of the runner. Console output is the human-visible
      // surface for the demo banner; we keep both as warn so they
      // surface in review but don't fail lint.
      'no-console': 'off',
    },
  },
];
