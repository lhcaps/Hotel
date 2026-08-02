import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const dockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
const runtimeVerifier = readFileSync(
  resolve(root, 'scripts/deploy/verify-production-runtime.mjs'),
  'utf8',
);

test('places Next public assets beside the standalone web server', () => {
  assert.match(
    dockerfile,
    /cp -a apps\/web\/public \/runtime-artifacts\/web-public/,
    'the build must preserve public assets before production dependency installation',
  );
  assert.match(
    dockerfile,
    /cp -a \/runtime-artifacts\/web-public apps\/web\/\.next\/standalone\/apps\/web\/public/,
    'the standalone server must receive its sibling public directory',
  );
  assert.match(
    runtimeVerifier,
    /Next standalone public assets exist/,
    'the production runtime verifier must check the packaged public directory',
  );
  assert.match(runtimeVerifier, /hero-suite\.png/, 'the known hospitality assets must be checked');
});
