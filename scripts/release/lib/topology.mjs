import { attestRelease } from './attestation.mjs';

export function evaluateTopology({
  manifest,
  runtimeSnapshot,
  manifestValid = true,
  migrationProvenanceMatch = true,
}) {
  const attestation = attestRelease({ manifest, runtimeSnapshot });
  const failures = [...attestation.failures];
  if (!manifestValid) failures.push('manifest');
  if (!migrationProvenanceMatch) failures.push('migration-provenance');
  return {
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    attestation,
  };
}
