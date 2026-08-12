import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  readProductionCurrentPointer,
  switchProductionCurrentPointer,
} from './lib/production-runtime.mjs';

test('production current adapter reads a legacy file pointer and replaces it with the requested release directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'room-production-pointer-'));
  const legacy = join(root, 'releases', 'legacy');
  const candidate = join(root, 'releases', 'candidate');
  try {
    mkdirSync(legacy, { recursive: true });
    mkdirSync(candidate, { recursive: true });
    writeFileSync(join(root, 'current'), 'legacy\n', 'utf8');

    assert.equal(readProductionCurrentPointer(root), legacy);
    switchProductionCurrentPointer({ targetRoot: root, releaseDirectory: candidate });
    assert.equal(readProductionCurrentPointer(root), candidate);
    assert.equal(existsSync(join(root, 'current')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
