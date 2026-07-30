import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  resolvePlaywrightRuntime,
  validateAdminPassword,
  validateBetterAuthSecret,
} from './playwright-runtime.mjs';

const originalEnvironment = { ...process.env };
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'room-playwright-runtime-'));

try {
  const first = resolvePlaywrightRuntime({});
  const second = resolvePlaywrightRuntime({});

  assert.equal(validateBetterAuthSecret(first.PLAYWRIGHT_BETTER_AUTH_SECRET), true);
  assert.equal(validateAdminPassword(first.PLAYWRIGHT_ADMIN_PASSWORD), true);
  assert.notEqual(first.PLAYWRIGHT_BETTER_AUTH_SECRET, second.PLAYWRIGHT_BETTER_AUTH_SECRET);
  assert.notEqual(first.PLAYWRIGHT_ADMIN_PASSWORD, second.PLAYWRIGHT_ADMIN_PASSWORD);

  const supplied = {
    PLAYWRIGHT_BETTER_AUTH_SECRET: 'a'.repeat(64),
    PLAYWRIGHT_ADMIN_PASSWORD: 'Aa1!'.concat('x'.repeat(64)),
  };
  assert.deepEqual(resolvePlaywrightRuntime(supplied), supplied);
  assert.throws(() => resolvePlaywrightRuntime({ PLAYWRIGHT_ADMIN_PASSWORD: 'too-short' }));
  assert.throws(() => resolvePlaywrightRuntime({ PLAYWRIGHT_BETTER_AUTH_SECRET: 'short' }));

  const artifact = readFileSync(new URL('./run-playwright.mjs', import.meta.url), 'utf8');
  assert.equal(artifact.includes(first.PLAYWRIGHT_BETTER_AUTH_SECRET), false);
  assert.equal(artifact.includes(first.PLAYWRIGHT_ADMIN_PASSWORD), false);
  assert.equal(process.env.PLAYWRIGHT_ADMIN_PASSWORD, originalEnvironment.PLAYWRIGHT_ADMIN_PASSWORD);
  assert.equal(process.env.PLAYWRIGHT_BETTER_AUTH_SECRET, originalEnvironment.PLAYWRIGHT_BETTER_AUTH_SECRET);
  process.stdout.write('PASS playwright runtime generated credentials remain process-local\n');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
