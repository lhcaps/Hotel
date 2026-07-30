import { spawn } from 'node:child_process';

import { resolvePnpmInvocation } from './command-executable.mjs';
import { resolvePlaywrightRuntime } from './playwright-runtime.mjs';

function pnpmInvocation(args) {
  return resolvePnpmInvocation(args);
}

function runPlaywright(args, environment) {
  return new Promise((resolve, reject) => {
    const invocation = pnpmInvocation(['exec', 'playwright', 'test', ...args]);
    const child = spawn(invocation.executable, invocation.args, {
      env: environment,
      stdio: 'inherit',
      windowsHide: true,
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Playwright exited with code ${String(code)} and signal ${String(signal)}`));
    });
  });
}

const runtime = resolvePlaywrightRuntime(process.env);
const environment = { ...process.env, ...runtime };

await runPlaywright([], environment);
await runPlaywright(['-c', 'playwright.unavailable.config.ts'], environment);
