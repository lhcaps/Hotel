import { resolve } from 'node:path';

import {
  loadEnvironmentSchema,
  readEnvironmentFile,
  validateEnvironment,
} from './lib/environment.mjs';

function printHelp() {
  process.stdout.write(
    `Usage: node scripts/release/validate-release-environment.mjs --environment-file <path> --deployment-class <isolated|demo-production|real-production> [--schema <path>]\n`,
  );
}

function readOption(name, required = true) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith('--')))
    throw new Error(`${name} is required.`);
  return value;
}

try {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  const schema = loadEnvironmentSchema(
    resolve(readOption('--schema', false) ?? 'deploy/environment-schema.json'),
  );
  validateEnvironment({
    values: readEnvironmentFile(resolve(readOption('--environment-file'))),
    schema,
    deploymentClass: readOption('--deployment-class'),
  });
  process.stdout.write('RELEASE_ENVIRONMENT=PASS\n');
} catch (error) {
  process.stderr.write(
    `RELEASE_ENVIRONMENT=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
