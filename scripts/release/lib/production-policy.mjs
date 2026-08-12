const SOURCE_SHA = /^[a-f0-9]{40,64}$/iu;
const SHA256 = /^[a-f0-9]{64}$/iu;
const IMAGE_ID = /^sha256:[a-f0-9]{64}$/iu;
const REQUIRED_SCOPE = 'OPERATIONS_V3_PRODUCTION_RELEASE_RECONCILIATION_AND_CANARY';

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function timestamp(value, label) {
  nonEmptyString(value, label);
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO-8601 timestamp.`);
}

function sha256(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new Error(`${label} must be a SHA-256 digest.`);
  }
}

function recordPass(validation) {
  try {
    validation();
    return true;
  } catch {
    return false;
  }
}

export function validateProductionApproval({ approval, manifest, expectedApprovalId }) {
  object(approval, 'Production approval');
  object(manifest, 'Release manifest');
  nonEmptyString(expectedApprovalId, 'Expected production approval ID');
  if (approval.approvalId !== expectedApprovalId) {
    throw new Error('Production approval ID is invalid.');
  }
  if (approval.target !== 'production') throw new Error('Production approval target is invalid.');
  if (approval.scope !== REQUIRED_SCOPE) throw new Error('Production approval scope is invalid.');
  timestamp(approval.approvedAt, 'Production approval timestamp');
  if (typeof manifest.sourceSha !== 'string' || !SOURCE_SHA.test(manifest.sourceSha)) {
    throw new Error('Release manifest source SHA is invalid.');
  }
  if (approval.approvedSourceSha !== manifest.sourceSha) {
    throw new Error('Production approval source SHA is invalid.');
  }
  return true;
}

export function validateRecoveryBaseline(baseline) {
  object(baseline, 'Recovery baseline');
  if (baseline.schemaVersion !== 1) throw new Error('Recovery baseline schema version is invalid.');
  nonEmptyString(baseline.baselineId, 'Recovery baseline ID');
  if (baseline.canonical !== false) throw new Error('Recovery baseline must set canonical=false.');
  if (baseline.mixed !== true) throw new Error('Recovery baseline must set mixed=true.');
  nonEmptyString(baseline.project, 'Recovery baseline Docker Compose project');
  timestamp(baseline.capturedAt, 'Recovery baseline timestamp');
  nonEmptyString(baseline.currentPointer, 'Recovery baseline current pointer');
  const services = object(baseline.services, 'Recovery baseline services');
  const entries = Object.entries(services);
  if (entries.length === 0) throw new Error('Recovery baseline must include service evidence.');
  for (const [service, evidence] of entries) {
    object(evidence, `Recovery baseline ${service} service`);
    nonEmptyString(evidence.containerName, `Recovery baseline ${service} container name`);
    if (typeof evidence.imageId !== 'string' || !IMAGE_ID.test(evidence.imageId)) {
      throw new Error(`Recovery baseline ${service} image ID is invalid.`);
    }
    if (evidence.revision !== null && typeof evidence.revision !== 'string') {
      throw new Error(`Recovery baseline ${service} revision label is invalid.`);
    }
    if (!Number.isInteger(evidence.restartCount) || evidence.restartCount < 0) {
      throw new Error(`Recovery baseline ${service} restart count is invalid.`);
    }
  }
  sha256(baseline.composeIdentity, 'Recovery baseline Compose identity');
  sha256(baseline.caddyIdentity, 'Recovery baseline Caddy identity');
  nonEmptyString(baseline.composeFile, 'Recovery baseline Compose file');
  nonEmptyString(baseline.caddyFile, 'Recovery baseline Caddy file');
  nonEmptyString(baseline.composeEnvironmentFile, 'Recovery baseline Compose environment file');
  nonEmptyString(baseline.migrationState, 'Recovery baseline migration state');
  const environmentFileHashes = object(
    baseline.environmentFileHashes,
    'Recovery baseline environment hashes',
  );
  const hashes = Object.entries(environmentFileHashes);
  if (hashes.length === 0) throw new Error('Recovery baseline environment hashes are required.');
  for (const [name, value] of hashes) sha256(value, `Recovery baseline environment hash ${name}`);
  if (typeof environmentFileHashes.compose !== 'string') {
    throw new Error('Recovery baseline Compose environment hash is required.');
  }
  nonEmptyString(baseline.databaseIdentity, 'Recovery baseline database identity');
  const recovery = object(baseline.recovery, 'Recovery baseline runtime snapshot');
  for (const key of ['composeFile', 'caddyFile', 'composeEnvironmentFile', 'overrideFile']) {
    nonEmptyString(recovery[key], `Recovery snapshot ${key}`);
  }
  for (const key of [
    'composeIdentity',
    'caddyIdentity',
    'composeEnvironmentIdentity',
    'overrideIdentity',
  ]) {
    sha256(recovery[key], `Recovery snapshot ${key}`);
  }
  return true;
}

export function validateBackupEvidence(backup) {
  object(backup, 'Production backup evidence');
  if (backup.schemaVersion !== 1)
    throw new Error('Production backup evidence schema version is invalid.');
  nonEmptyString(backup.backupId, 'Production backup ID');
  nonEmptyString(backup.path, 'Production backup path');
  timestamp(backup.createdAt, 'Production backup timestamp');
  nonEmptyString(backup.databaseIdentity, 'Production backup database identity');
  if (!Number.isInteger(backup.bytes) || backup.bytes <= 0) {
    throw new Error('Production backup must have non-zero size.');
  }
  sha256(backup.sha256, 'Production backup checksum');
  if (backup.verified !== true) throw new Error('Production backup must be verified.');
  nonEmptyString(backup.restoreRehearsalId, 'Production backup restore rehearsal ID');
  return true;
}

export function validateRestoreRehearsal(rehearsal, backup) {
  object(rehearsal, 'Restore rehearsal evidence');
  if (rehearsal.schemaVersion !== 1)
    throw new Error('Restore rehearsal schema version is invalid.');
  nonEmptyString(rehearsal.rehearsalId, 'Restore rehearsal ID');
  nonEmptyString(rehearsal.backupId, 'Restore rehearsal backup ID');
  nonEmptyString(rehearsal.databaseIdentity, 'Restore rehearsal database identity');
  if (rehearsal.isolated !== true)
    throw new Error('Restore rehearsal must use an isolated database.');
  if (!Number.isInteger(rehearsal.restoredBytes) || rehearsal.restoredBytes <= 0) {
    throw new Error('Restore rehearsal must restore non-zero data.');
  }
  if (rehearsal.checksumVerified !== true) {
    throw new Error('Restore rehearsal checksum must be verified.');
  }
  nonEmptyString(rehearsal.migrationState, 'Restore rehearsal migration state');
  if (rehearsal.status !== 'PASS') throw new Error('Restore rehearsal status must be PASS.');
  timestamp(rehearsal.completedAt, 'Restore rehearsal timestamp');
  if (backup !== undefined) {
    validateBackupEvidence(backup);
    if (rehearsal.rehearsalId !== backup.restoreRehearsalId) {
      throw new Error('Restore rehearsal ID does not match production backup evidence.');
    }
    if (rehearsal.backupId !== backup.backupId) {
      throw new Error('Restore rehearsal backup ID does not match production backup evidence.');
    }
    if (rehearsal.databaseIdentity !== backup.databaseIdentity) {
      throw new Error(
        'Restore rehearsal database identity does not match production backup evidence.',
      );
    }
  }
  return true;
}

export function validateRollbackStrategy({ strategy, baseline, manifest, restoreRehearsal }) {
  object(strategy, 'Rollback strategy evidence');
  validateRecoveryBaseline(baseline);
  object(manifest, 'Release manifest');
  if (strategy.schemaVersion !== 1)
    throw new Error('Rollback strategy evidence schema version is invalid.');
  if (strategy.baselineId !== baseline.baselineId) {
    throw new Error('Rollback strategy baseline ID does not match recovery evidence.');
  }
  if (strategy.candidateSourceSha !== manifest.sourceSha) {
    throw new Error('Rollback strategy candidate source SHA does not match the release manifest.');
  }
  if (typeof strategy.legacyCompatibility !== 'boolean') {
    throw new Error('Rollback strategy legacy compatibility is invalid.');
  }
  const expected = strategy.legacyCompatibility
    ? 'application-compatible'
    : 'database-restore-required';
  if (strategy.strategy !== expected) {
    throw new Error(`Rollback strategy must be ${expected}.`);
  }
  if (strategy.restoreRequired !== !strategy.legacyCompatibility) {
    throw new Error('Rollback strategy restore requirement is invalid.');
  }
  if (strategy.status !== 'PASS') throw new Error('Rollback strategy status must be PASS.');
  timestamp(strategy.rehearsedAt, 'Rollback strategy timestamp');
  if (!strategy.legacyCompatibility) {
    validateRestoreRehearsal(restoreRehearsal);
  }
  return true;
}

export function productionPreflightChecks({
  approval,
  manifest,
  expectedApprovalId,
  recoveryBaseline,
  backup,
  restoreRehearsal,
  databaseHealth,
  dockerHealth,
  currentTruth,
  rollbackTarget,
  migrationProvenance,
  rollbackStrategy,
}) {
  return {
    approval: recordPass(() =>
      validateProductionApproval({ approval, manifest, expectedApprovalId }),
    ),
    recoveryBaseline: recordPass(() => validateRecoveryBaseline(recoveryBaseline)),
    backupEvidence: recordPass(() => validateBackupEvidence(backup)),
    restoreEvidence: recordPass(() => validateRestoreRehearsal(restoreRehearsal, backup)),
    databaseHealth: databaseHealth === true,
    dockerHealth: dockerHealth === true,
    currentTruth: currentTruth === true,
    rollbackTarget: rollbackTarget === true,
    migrationProvenance: migrationProvenance === true,
    rollbackStrategy: rollbackStrategy === true,
  };
}
