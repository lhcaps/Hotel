import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const repoRoot = resolve(import.meta.dirname, '../../..');
const artifactPath = resolve(repoRoot, 'docs/openapi/public-v1.json');

describe('public OpenAPI artifact reproducibility', () => {
  it('regenerates byte-identical output', async () => {
    const before = await readFile(artifactPath, 'utf8');
    await execFileAsync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'tsx', 'scripts/generate-public-openapi.mts', '--write'],
      { cwd: repoRoot, windowsHide: true, shell: process.platform === 'win32' },
    );
    const after = await readFile(artifactPath, 'utf8');
    expect(after).toBe(before);
  });
});
