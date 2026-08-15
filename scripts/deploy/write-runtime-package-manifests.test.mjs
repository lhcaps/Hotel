import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  runtimePackageDirectories,
  writeRuntimePackageManifests,
} from './write-runtime-package-manifests.mjs';

function writeFixture(root, directory, exports) {
  const packageDirectory = join(root, directory);
  mkdirSync(join(packageDirectory, 'src'), { recursive: true });
  const outputRoot = directory === 'packages/database' ? ['dist', 'database'] : ['dist'];
  mkdirSync(join(packageDirectory, ...outputRoot, 'src'), { recursive: true });
  writeFileSync(join(packageDirectory, 'package.json'), JSON.stringify({ exports }), 'utf8');
  for (const rawTarget of Object.values(exports)) {
    const sourceTarget =
      typeof rawTarget === 'string' ? rawTarget : (rawTarget.default ?? rawTarget.types);
    const outputPrefix = directory === 'packages/database' ? 'dist/database/src/' : 'dist/src/';
    const compiled = sourceTarget.replace(/^\.\/src\//u, outputPrefix).replace(/\.ts$/u, '.js');
    const file = join(packageDirectory, compiled);
    mkdirSync(file.slice(0, file.lastIndexOf('\\') + 1), { recursive: true });
    writeFileSync(file, 'export {};\n', 'utf8');
  }
  if (directory === 'packages/database') {
    mkdirSync(join(packageDirectory, 'drizzle', 'meta'), { recursive: true });
    writeFileSync(join(packageDirectory, 'drizzle', 'meta', '_journal.json'), '{}\n', 'utf8');
  }
}

test('runtime manifests map every committed TypeScript export to compiled JavaScript', () => {
  const root = mkdtempSync(join(tmpdir(), 'room-runtime-manifests-'));
  try {
    const exportsByPackage = {
      'packages/config': { '.': './src/index.ts' },
      'packages/contracts': {
        '.': { types: './src/index.ts', default: './src/index.ts' },
        './pricing': { types: './src/pricing.ts', default: './src/pricing.ts' },
        './public-room-catalog': {
          types: './src/public-room-catalog.ts',
          default: './src/public-room-catalog.ts',
        },
        './admin': { types: './src/admin.ts', default: './src/admin.ts' },
      },
      'packages/observability': { '.': './src/index.ts' },
      'packages/database': {
        '.': './src/index.ts',
        './schema': './src/schema.ts',
        './testing': './src/testing.ts',
      },
      'packages/booking': { '.': './src/index.ts', './coupon': './src/coupon/index.ts' },
      'packages/auth': { '.': './src/index.ts' },
    };
    for (const directory of runtimePackageDirectories)
      writeFixture(root, directory, exportsByPackage[directory]);

    writeRuntimePackageManifests(root);

    for (const directory of runtimePackageDirectories) {
      const manifest = JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8'));
      for (const target of Object.values(manifest.exports)) {
        const expectedPrefix =
          directory === 'packages/database' ? './dist/database/src/' : './dist/src/';
        assert.equal(target.startsWith(expectedPrefix), true);
        assert.match(target, /\.js$/u);
      }
    }
    assert.equal(
      readFileSync(
        join(root, 'packages/database', 'dist', 'database', 'drizzle', 'meta', '_journal.json'),
        'utf8',
      ),
      '{}\n',
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
