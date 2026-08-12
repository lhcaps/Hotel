import { execFileSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { canonicalJson, hashFile, sha256 } from './lib/canonical.mjs';
import { validateRecoveryBaseline } from './lib/production-policy.mjs';

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

export function createRecoveryBaseline(snapshot) {
  const source = {
    project: snapshot.project,
    capturedAt: snapshot.capturedAt,
    currentPointer: snapshot.currentPointer,
    services: snapshot.services,
    composeIdentity: snapshot.composeIdentity,
    caddyIdentity: snapshot.caddyIdentity,
    composeFile: snapshot.composeFile,
    caddyFile: snapshot.caddyFile,
    composeEnvironmentFile: snapshot.composeEnvironmentFile,
    migrationState: snapshot.migrationState,
    environmentFileHashes: snapshot.environmentFileHashes,
    databaseIdentity: snapshot.databaseIdentity,
  };
  const baseline = {
    schemaVersion: 1,
    baselineId: `recovery-${sha256(canonicalJson(source))}`,
    canonical: false,
    mixed: true,
    ...source,
  };
  validateRecoveryBaseline(baseline);
  return baseline;
}

function option(name, required = false) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--'))) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function options(name) {
  return process.argv.flatMap((entry, index) =>
    entry === name && process.argv[index + 1] !== undefined ? [process.argv[index + 1]] : [],
  );
}

function assignment(value, label) {
  const separator = value.indexOf('=');
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(`${label} must use name=path form.`);
  }
  return [value.slice(0, separator), value.slice(separator + 1)];
}

function inspectProject(project) {
  const identifiers = execFileSync(
    'docker',
    ['ps', '--quiet', '--filter', `label=com.docker.compose.project=${project}`],
    { encoding: 'utf8', windowsHide: true },
  )
    .split(/\r?\n/u)
    .filter(Boolean);
  if (identifiers.length === 0)
    throw new Error('No Docker containers exist for the requested project.');
  return JSON.parse(
    execFileSync('docker', ['inspect', ...identifiers], { encoding: 'utf8', windowsHide: true }),
  );
}

function serviceSnapshot(containers) {
  const services = {};
  for (const container of containers) {
    const service = container.Config?.Labels?.['com.docker.compose.service'];
    if (typeof service !== 'string' || service.length === 0) continue;
    const imageId = container.Image;
    if (typeof imageId !== 'string' || imageId.length === 0) {
      throw new Error(`Docker service ${service} does not expose an immutable image ID.`);
    }
    services[service] = {
      containerName: String(container.Name ?? '').replace(/^\//u, ''),
      imageId,
      revision: container.Config?.Labels?.['org.opencontainers.image.revision'] ?? null,
      restartCount: Number(container.RestartCount ?? 0),
      state: container.State?.Status ?? 'unknown',
      health: container.State?.Health?.Status ?? null,
    };
  }
  return services;
}

function environmentHashes(values) {
  const hashes = Object.fromEntries(
    values.map((value) => {
      const [name, path] = assignment(value, 'Environment file');
      return [name, hashFile(resolve(path))];
    }),
  );
  if (Object.keys(hashes).length === 0) {
    throw new Error('At least one environment file hash is required for recovery capture.');
  }
  return hashes;
}

export function captureRecoveryBaseline({
  project,
  targetRoot,
  composeFile,
  caddyFile,
  composeEnvironmentFile,
  environmentFiles,
  migrationState,
  databaseIdentity,
  capturedAt = new Date().toISOString(),
}) {
  nonEmptyString(project, 'Docker Compose project');
  const root = resolve(targetRoot);
  const containers = inspectProject(project);
  return createRecoveryBaseline({
    project,
    capturedAt,
    currentPointer: realpathSync(resolve(root, 'current')),
    services: serviceSnapshot(containers),
    composeIdentity: hashFile(resolve(composeFile)),
    caddyIdentity: hashFile(resolve(caddyFile)),
    composeFile: resolve(composeFile),
    caddyFile: resolve(caddyFile),
    composeEnvironmentFile: resolve(composeEnvironmentFile),
    migrationState: nonEmptyString(migrationState, 'Migration state'),
    environmentFileHashes: environmentHashes(environmentFiles),
    databaseIdentity: nonEmptyString(databaseIdentity, 'Database identity'),
  });
}

if (import.meta.main) {
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      process.stdout.write(
        'Usage: node scripts/release/capture-recovery-baseline.mjs --project <compose-project> --target-root <path> --compose-file <path> --caddy-file <path> --compose-env-file <path> --environment-file <name=path> [--environment-file <name=path>] --migration-state <state> --database-identity <identity> --output <path>\n',
      );
      process.exit(0);
    }
    const output = resolve(option('--output', true));
    const baseline = captureRecoveryBaseline({
      project: option('--project', true),
      targetRoot: option('--target-root', true),
      composeFile: option('--compose-file', true),
      caddyFile: option('--caddy-file', true),
      composeEnvironmentFile: option('--compose-env-file', true),
      environmentFiles: options('--environment-file'),
      migrationState: option('--migration-state', true),
      databaseIdentity: option('--database-identity', true),
    });
    mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
    writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    process.stdout.write(
      `RECOVERY_BASELINE=PASS\nRECOVERY_BASELINE_ID=${baseline.baselineId}\nRECOVERY_BASELINE_MIXED=true\n`,
    );
  } catch (error) {
    process.stderr.write(
      `RECOVERY_BASELINE=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
