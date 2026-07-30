import { spawnSync } from 'node:child_process';
import { resolvePnpmInvocation } from './command-executable.mjs';

const aliases = new Map([
  ['config', '@room/config'],
  ['observability', '@room/observability'],
  ['database', '@room/database'],
]);
const filterIndex = process.argv.indexOf('--filter');
const requestedFilter = filterIndex === -1 ? undefined : process.argv[filterIndex + 1];
const filter =
  requestedFilter === undefined ? undefined : (aliases.get(requestedFilter) ?? requestedFilter);
const command = filter === undefined ? ['test:unit'] : ['--filter', filter, 'test:unit'];
const invocation = resolvePnpmInvocation(command);
const result = spawnSync(invocation.executable, invocation.args, {
  shell: false,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error !== undefined) {
  throw result.error;
}

process.exit(result.status ?? 1);
