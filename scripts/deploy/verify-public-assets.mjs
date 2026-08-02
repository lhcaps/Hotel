import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const assetPattern = /(['"`])(\/[^'"`\s)]+\.(?:avif|gif|ico|jpe?g|png|svg|webp))\1/giu;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.isFile() && /\.(?:ts|tsx|css)$/u.test(entry.name) ? [path] : [];
  });
}

export function collectReferencedPublicAssetPaths(root = repositoryRoot) {
  const sourceRoot = join(root, 'apps', 'web', 'src');
  const assets = new Set();
  for (const path of walk(sourceRoot)) {
    for (const match of readFileSync(path, 'utf8').matchAll(assetPattern)) {
      assets.add(match[2]);
    }
  }
  return [...assets].sort();
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) throw new Error(`${label} failed.\n${output}`);
  return output;
}

async function verifyPublicAssets() {
  const image = argument('--image');
  const baseUrl = argument('--base-url')?.replace(/\/$/u, '');
  if (image === undefined) throw new Error('--image is required.');

  const assets = collectReferencedPublicAssetPaths();
  if (assets.length === 0) throw new Error('No referenced public assets were found.');
  for (const asset of assets) {
    if (!existsSync(join(repositoryRoot, 'apps', 'web', 'public', asset))) {
      throw new Error(`Missing source public asset: ${asset}`);
    }
  }
  process.stdout.write(`PASS source public assets (${String(assets.length)})\n`);

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'room-public-assets-'));
  try {
    const archive = join(temporaryRoot, 'release.tar');
    run('git archive', 'git', ['archive', '--format=tar', 'HEAD', '-o', archive]);
    const entries = new Set(run('archive listing', 'tar', ['-tf', archive]).trim().split(/\r?\n/u));
    for (const asset of assets) {
      const archivePath = `apps/web/public${asset}`;
      if (!entries.has(archivePath)) throw new Error(`Missing archive public asset: ${asset}`);
    }
    process.stdout.write(`PASS git archive public assets (${String(assets.length)})\n`);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const runtimeChecks = assets
    .map((asset) => `test -f 'apps/web/.next/standalone/apps/web/public${asset}'`)
    .join(' && ');
  run('runtime public assets', 'docker', [
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    image,
    '-ec',
    runtimeChecks,
  ]);
  process.stdout.write(`PASS runtime public assets (${String(assets.length)})\n`);

  if (baseUrl !== undefined) {
    for (const asset of assets) {
      const response = await fetch(`${baseUrl}${asset}`);
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.startsWith('image/')) {
        throw new Error(
          `Public asset failed: ${asset} status=${String(response.status)} type=${contentType}`,
        );
      }
    }
    process.stdout.write(`PASS public HTTP assets (${String(assets.length)})\n`);
  }
}

const invoked =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename);
if (invoked) await verifyPublicAssets();
