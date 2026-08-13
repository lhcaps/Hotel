import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function readManifest(relativePath) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), 'utf8'));
}

test('production dependency overrides meet every RM-504 advisory patch floor', () => {
  const root = readManifest('package.json');

  assert.deepEqual(root.pnpm.overrides, {
    sharp: '0.35.0',
    'next@16.2.11>postcss': '8.5.21',
    'find-my-way': '9.7.0',
    'fast-uri@3': '3.1.5',
    'fast-uri@4': '4.1.2',
    undici: '7.29.0',
    'brace-expansion': '5.0.9',
    'js-yaml': '4.3.1',
    nanoid: '3.3.18',
  });
});

test('web keeps the shadcn CLI out of its production dependency graph', () => {
  const web = readManifest('apps/web/package.json');

  assert.equal(web.dependencies?.shadcn, undefined);
  assert.equal(web.devDependencies.shadcn, '4.16.0');
});
