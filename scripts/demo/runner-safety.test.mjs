import assert from 'node:assert/strict';

import {
  isExactReadyStatus,
  matchesProcessIdentity,
  validateOwnedProcessEntry,
} from './runner-safety.mjs';

const expected = {
  creationDate: '20260801123456.000000+420',
  executablePath: 'C:\\Program Files\\nodejs\\node.exe',
  commandLine: 'node scripts/demo/start-local.mjs',
};

assert.equal(isExactReadyStatus(200), true);
assert.equal(isExactReadyStatus(204), false);
assert.equal(isExactReadyStatus(401), false);
assert.equal(isExactReadyStatus(404), false);

assert.equal(matchesProcessIdentity(expected, { ...expected }), true);
assert.equal(
  matchesProcessIdentity(expected, { ...expected, creationDate: '20260801123500.000000+420' }),
  false,
);
assert.equal(
  matchesProcessIdentity(expected, { ...expected, commandLine: 'unrelated.exe --service' }),
  false,
);
assert.equal(matchesProcessIdentity(expected, { executablePath: expected.executablePath }), false);

assert.deepEqual(
  validateOwnedProcessEntry({
    pid: 42,
    service: 'api',
    startedAt: '2026-08-01T00:00:00.000Z',
    identity: expected,
  }),
  { ok: true },
);
assert.equal(validateOwnedProcessEntry({ pid: 42, service: 'api' }).ok, false);

process.stdout.write('PASS runner safety invariants\n');
