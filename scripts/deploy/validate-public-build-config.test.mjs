import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { validatePublicBuildConfig } from './validate-public-build-config.mjs';

const VALID = {
  apiBaseUrl: 'https://peacenest.vn/api/v1',
  publicDomain: 'peacenest.vn',
  webOrigin: 'https://peacenest.vn',
};

test('public production build config accepts the canonical public API origin', () => {
  const result = validatePublicBuildConfig(VALID);
  assert.equal(result.apiBaseUrl, VALID.apiBaseUrl);
  assert.match(result.fingerprint, /^sha256:[a-f0-9]{64}$/u);
});

for (const [name, overrides] of [
  ['missing API base', { apiBaseUrl: undefined }],
  ['empty API base', { apiBaseUrl: '' }],
  ['relative API base', { apiBaseUrl: '/api/v1' }],
  ['malformed API base', { apiBaseUrl: 'not a URL' }],
  ['HTTP API base', { apiBaseUrl: 'http://peacenest.vn/api/v1' }],
  ['wrong host API base', { apiBaseUrl: 'https://wrong-host.example/api/v1' }],
]) {
  test(`public production build config rejects ${name}`, () => {
    assert.throws(() => validatePublicBuildConfig({ ...VALID, ...overrides }));
  });
}

test('public production build config rejects a missing or inconsistent web origin', () => {
  assert.throws(() => validatePublicBuildConfig({ ...VALID, webOrigin: undefined }));
  assert.throws(() => validatePublicBuildConfig({ ...VALID, webOrigin: 'https://other.example' }));
  assert.throws(() => validatePublicBuildConfig({ ...VALID, publicDomain: 'other.example' }));
});

test('the CLI fails closed when the build argument is absent', () => {
  const result = spawnSync(process.execPath, ['scripts/deploy/validate-public-build-config.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: '',
      PUBLIC_DOMAIN: 'peacenest.vn',
      WEB_ORIGIN: 'https://peacenest.vn',
    },
    encoding: 'utf8',
    shell: false,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /PUBLIC_BUILD_CONFIG=FAIL/u);
});
