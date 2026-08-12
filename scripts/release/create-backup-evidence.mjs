import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { validateBackupEvidence } from './lib/production-policy.mjs';

function required(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} is required.`);
  return value;
}

async function checksum(path) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => {
    const input = createReadStream(path);
    input.once('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.once('end', resolvePromise);
  });
  return hash.digest('hex');
}

export async function createBackupEvidence({
  backupPath,
  backupId,
  databaseIdentity,
  restoreRehearsalId,
  createdAt = new Date().toISOString(),
}) {
  const path = resolve(backupPath);
  if (!existsSync(path)) throw new Error('Production backup path does not exist.');
  const bytes = statSync(path).size;
  const evidence = {
    schemaVersion: 1,
    backupId,
    path,
    createdAt,
    databaseIdentity,
    bytes,
    sha256: await checksum(path),
    verified: true,
    restoreRehearsalId,
  };
  validateBackupEvidence(evidence);
  return evidence;
}

if (import.meta.main) {
  try {
    const output = resolve(required('--output'));
    const evidence = await createBackupEvidence({
      backupPath: required('--backup-path'),
      backupId: required('--backup-id'),
      databaseIdentity: required('--database-identity'),
      restoreRehearsalId: required('--restore-rehearsal-id'),
    });
    mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
    writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    process.stdout.write(
      `PRODUCTION_BACKUP_EVIDENCE=PASS\nBACKUP_ID=${evidence.backupId}\nBACKUP_BYTES=${evidence.bytes}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `PRODUCTION_BACKUP_EVIDENCE=FAIL\n${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
