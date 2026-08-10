import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

export const DEPLOY_PHASES = [
  'PREFLIGHT',
  'PREPARE_RELEASE',
  'BACKUP_CHECK',
  'MIGRATION_CHECK',
  'START_CANDIDATE',
  'VERIFY_CANDIDATE',
  'CANARY',
  'SWITCH_CURRENT',
  'ATTEST',
  'COMPLETE',
];

export function preflightRelease({ checks }) {
  const failures = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([name]) => name);
  return { ok: failures.length === 0, failures, checks };
}

function pointerPath(root) {
  return join(root, 'current');
}
export function releaseDirectoryName(releaseId) {
  return releaseId.replace(':', '-');
}
function previousPointer(root) {
  return existsSync(pointerPath(root)) ? readFileSync(pointerPath(root), 'utf8').trim() : undefined;
}
function writePointer(root, releaseId, fault) {
  if (fault === 'SWITCH_CURRENT') throw new Error('Injected current pointer switch failure.');
  writeFileSync(pointerPath(root), `${releaseId}\n`, 'utf8');
}

export function executeIsolatedDeploy({ targetRoot, releaseId, sourceDirectory, checks, fault }) {
  const evidence = [];
  const preflight = preflightRelease({ checks });
  evidence.push({ phase: 'PREFLIGHT', ok: preflight.ok, failures: preflight.failures });
  if (!preflight.ok) return { status: 'FAIL', evidence, preflight };
  const root = resolve(targetRoot);
  const releases = join(root, 'releases');
  const destination = join(releases, releaseDirectoryName(releaseId));
  const temporary = `${destination}.partial`;
  const previous = previousPointer(root);
  try {
    mkdirSync(releases, { recursive: true });
    if (existsSync(destination)) throw new Error('Candidate release already exists.');
    cpSync(sourceDirectory, temporary, { recursive: true, errorOnExist: true });
    renameSync(temporary, destination);
    evidence.push({ phase: 'PREPARE_RELEASE', ok: true });
    for (const phase of [
      'BACKUP_CHECK',
      'MIGRATION_CHECK',
      'START_CANDIDATE',
      'VERIFY_CANDIDATE',
      'CANARY',
    ]) {
      if (fault === phase) throw new Error(`Injected ${phase} failure.`);
      evidence.push({ phase, ok: true });
    }
    writePointer(root, releaseId, fault);
    evidence.push({ phase: 'SWITCH_CURRENT', ok: true });
    if (fault === 'ATTEST') throw new Error('Injected ATTEST failure.');
    evidence.push({ phase: 'ATTEST', ok: true }, { phase: 'COMPLETE', ok: true });
    return { status: 'PASS', evidence, releaseId };
  } catch (error) {
    if (previous === undefined) rmSync(pointerPath(root), { force: true });
    else writeFileSync(pointerPath(root), `${previous}\n`, 'utf8');
    rmSync(temporary, { recursive: true, force: true });
    evidence.push({
      phase: 'FAIL',
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { status: 'FAIL', evidence, releaseId: previous };
  }
}

export function executeIsolatedRollback({ targetRoot, targetReleaseId, checks, fault }) {
  const root = resolve(targetRoot);
  const targetDirectory = join(root, 'releases', releaseDirectoryName(targetReleaseId));
  const preflight = preflightRelease({ checks });
  if (!existsSync(targetDirectory))
    return {
      status: 'FAIL',
      evidence: [{ phase: 'PREFLIGHT', ok: false, failures: ['rollback-manifest'] }],
    };
  if (!preflight.ok)
    return {
      status: 'FAIL',
      evidence: [{ phase: 'PREFLIGHT', ok: false, failures: preflight.failures }],
    };
  const previous = previousPointer(root);
  try {
    if (previous === undefined) throw new Error('Current release is unknown.');
    if (fault === 'VERIFY_CANDIDATE') throw new Error('Injected rollback verification failure.');
    writePointer(root, targetReleaseId, fault);
    return {
      status: 'PASS',
      releaseId: targetReleaseId,
      evidence: [
        { phase: 'PREFLIGHT', ok: true },
        { phase: 'SWITCH_CURRENT', ok: true },
        { phase: 'ATTEST', ok: true },
        { phase: 'COMPLETE', ok: true },
      ],
    };
  } catch (error) {
    if (previous !== undefined) writeFileSync(pointerPath(root), `${previous}\n`, 'utf8');
    return {
      status: 'FAIL',
      releaseId: previous,
      evidence: [
        {
          phase: 'FAIL',
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}
