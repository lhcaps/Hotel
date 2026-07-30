import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function corepackPnpmPath() {
  const candidate = join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'pnpm.js');
  if (!existsSync(candidate)) {
    throw new Error('Unable to resolve Corepack pnpm entrypoint.');
  }
  return candidate;
}

export function resolvePnpmInvocation(args) {
  if (process.platform === 'win32') {
    return { executable: process.execPath, args: [corepackPnpmPath(), ...args] };
  }
  return { executable: 'pnpm', args };
}

export function resolveCommandInvocation(command, args) {
  if (command === 'pnpm') return resolvePnpmInvocation(args);
  if (command === 'tsx' || command === 'next' || command === 'vitest') {
    return resolvePnpmInvocation(['exec', command, ...args]);
  }
  return { executable: command, args };
}
