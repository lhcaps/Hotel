import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveCommandInvocation } from './command-executable.mjs';

const [command, ...args] = process.argv.slice(2);

if (command === undefined) {
  throw new Error('A command is required.');
}

const envFile = resolve(process.cwd(), '../../.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const invocation = resolveCommandInvocation(command, args);
const result = spawnSync(invocation.executable, invocation.args, {
  env: process.env,
  shell: false,
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error !== undefined) {
  throw result.error;
}

process.exit(result.status ?? 1);
