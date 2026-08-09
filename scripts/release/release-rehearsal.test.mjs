import assert from 'node:assert/strict';
import test from 'node:test';

import { runReleaseRehearsal } from './rehearse-release.mjs';

test('isolated rehearsal deploys A then B, rejects mixed state, and rolls back to A', () => {
  const result = runReleaseRehearsal();
  assert.equal(result.releaseADeploy, 'PASS');
  assert.equal(result.releaseAAttestation, 'PASS');
  assert.equal(result.releaseBDeploy, 'PASS');
  assert.equal(result.releaseBAttestation, 'PASS');
  assert.equal(result.mixedReleaseRejection, 'PASS');
  assert.equal(result.rollbackToA, 'PASS');
  assert.equal(result.rollbackAttestation, 'PASS');
});
