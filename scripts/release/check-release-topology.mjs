import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { evaluateTopology } from './lib/topology.mjs';

function option(name, required = false) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--')))
    throw new Error(`${name} is required.`);
  return value;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(
    'Usage: node scripts/release/check-release-topology.mjs --manifest <path> --snapshot <path> [--strict]\n',
  );
  process.exit(0);
}

try {
  const manifest = JSON.parse(readFileSync(resolve(option('--manifest', true)), 'utf8'));
  const runtimeSnapshot = JSON.parse(readFileSync(resolve(option('--snapshot', true)), 'utf8'));
  const report = evaluateTopology({
    manifest,
    runtimeSnapshot,
    migrationProvenanceMatch: runtimeSnapshot.migrationProvenanceMatch !== false,
  });
  process.stdout.write(
    `TOPOLOGY_GUARD=${report.status}\n${report.failures.map((failure) => `MISMATCH=${failure}`).join('\n')}\n`,
  );
  if (process.argv.includes('--strict') && report.status !== 'PASS') process.exit(1);
} catch (error) {
  process.stderr.write(
    `TOPOLOGY_GUARD=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
