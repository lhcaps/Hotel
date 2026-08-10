import { resolve } from 'node:path';

import {
  loadEnvironmentSchema,
  readEnvironmentFile,
  renderServiceEnvironments,
  validateEnvironment,
} from './lib/environment.mjs';

function printHelp() {
  process.stdout.write(
    `Usage: node scripts/release/render-service-environments.mjs --environment-file <path> --destination-directory <path> [--schema <path>] [--deployment-class <class>]\n`,
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
  const values = readEnvironmentFile(resolve(readOption('--environment-file')));
  validateEnvironment({
    values,
    schema,
    deploymentClass: readOption('--deployment-class', false) ?? 'isolated',
  });
  const rendered = renderServiceEnvironments({
    values,
    schema,
    destinationDirectory: resolve(readOption('--destination-directory')),
  });
  for (const [service, result] of Object.entries(rendered.services)) {
    process.stdout.write(`SERVICE_ENV=${service}:${result.keys.length}\n`);
  }
  process.stdout.write('SERVICE_ENVIRONMENTS=PASS\n');
} catch (error) {
  process.stderr.write(
    `SERVICE_ENVIRONMENTS=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
