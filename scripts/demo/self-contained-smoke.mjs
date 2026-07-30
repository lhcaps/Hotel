import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolvePnpmInvocation } from '../command-executable.mjs';
import { DEMO_MANIFEST_FILENAME } from './demo-constants.mjs';

const manifestPath = process.env.DEMO_STATE_FILE ?? join(tmpdir(), DEMO_MANIFEST_FILENAME);

function hasRunnableManifest() {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return typeof manifest?.passwordPath === 'string' && existsSync(manifest.passwordPath);
  } catch {
    return false;
  }
}

const script = hasRunnableManifest() ? 'demo:smoke:running' : 'demo:lifecycle-test';
const invocation = resolvePnpmInvocation([script]);
const child = spawn(invocation.executable, invocation.args, {
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
  shell: false,
});

child.once('error', (error) => {
  process.stderr.write(`demo:smoke could not start ${script}: ${error.message}\n`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (code !== 0) {
    process.stderr.write(
      `demo:smoke ${script} exited code=${String(code)} signal=${String(signal)}\n`,
    );
    process.exitCode = 1;
  }
});
