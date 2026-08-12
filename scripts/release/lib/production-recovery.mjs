export function evaluateRollbackStrategy({ legacyCompatibility, restoreEvidenceValid = false }) {
  if (legacyCompatibility === true) {
    return { ok: true, strategy: 'application-compatible', restoreRequired: false };
  }
  return {
    ok: restoreEvidenceValid === true,
    strategy: 'database-restore-required',
    restoreRequired: true,
  };
}
