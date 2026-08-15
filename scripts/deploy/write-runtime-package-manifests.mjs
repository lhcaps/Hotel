import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const runtimePackageDirectories = [
  'packages/config',
  'packages/contracts',
  'packages/observability',
  'packages/database',
  'packages/booking',
  'packages/auth',
];

function compiledExportTarget(packageDirectory, subpath, rawTarget) {
  const sourceTarget =
    typeof rawTarget === 'string'
      ? rawTarget
      : typeof rawTarget === 'object' && rawTarget !== null
        ? (rawTarget.default ?? rawTarget.types)
        : rawTarget;

  if (
    typeof sourceTarget !== 'string' ||
    !sourceTarget.startsWith('./src/') ||
    !sourceTarget.endsWith('.ts')
  ) {
    throw new Error(`${packageDirectory} export ${subpath} is not a TypeScript source export.`);
  }

  const outputRoot = packageDirectory.replaceAll('\\', '/').endsWith('/packages/database')
    ? './dist/database'
    : './dist';
  const target = `${outputRoot}/${sourceTarget.slice(2).replace(/\.ts$/u, '.js')}`;
  if (!existsSync(resolve(packageDirectory, target))) {
    throw new Error(`${packageDirectory} is missing compiled runtime export ${target}.`);
  }
  return target;
}

export function writeRuntimePackageManifests(root) {
  for (const relativeDirectory of runtimePackageDirectories) {
    const packageDirectory = resolve(root, relativeDirectory);
    const manifestPath = resolve(packageDirectory, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    manifest.exports = Object.fromEntries(
      Object.entries(manifest.exports ?? {}).map(([subpath, rawTarget]) => [
        subpath,
        compiledExportTarget(packageDirectory, subpath, rawTarget),
      ]),
    );
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    if (relativeDirectory === 'packages/database') {
      const sourceMigrations = resolve(packageDirectory, 'drizzle');
      const compiledMigrations = resolve(packageDirectory, 'dist/database/drizzle');
      if (!existsSync(sourceMigrations)) {
        throw new Error('packages/database/drizzle is required for runtime migrations.');
      }
      cpSync(sourceMigrations, compiledMigrations, { force: true, recursive: true });
    }
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeRuntimePackageManifests(resolve(import.meta.dirname, '../..'));
  process.stdout.write('Runtime workspace package manifests written.\n');
}
