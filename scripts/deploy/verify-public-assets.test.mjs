import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { collectReferencedPublicAssetPaths } from './verify-public-assets.mjs';

test('collects referenced local public image assets without treating routes as assets', () => {
  const root = mkdtempSync(join(tmpdir(), 'room-public-assets-'));
  try {
    const source = join(root, 'apps', 'web', 'src');
    mkdirSync(source, { recursive: true });
    writeFileSync(
      join(source, 'assets.ts'),
      "export const hero = '/images/hospitality/hero-suite.png'; export const icon = '/icon.svg'; export const route = '/booking/search';",
    );

    assert.deepEqual(collectReferencedPublicAssetPaths(root), [
      '/icon.svg',
      '/images/hospitality/hero-suite.png',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
