import assert from 'node:assert/strict';

import { compareProtectedPortStates, snapshotProtectedPort } from './protected-port-state.mjs';

const free = snapshotProtectedPort(null);
const occupied = snapshotProtectedPort(1234);

assert.deepEqual(free, { kind: 'FREE' });
assert.deepEqual(occupied, { kind: 'OCCUPIED', pid: 1234 });
assert.equal(compareProtectedPortStates(free, free).ok, true);
assert.equal(compareProtectedPortStates(occupied, occupied).ok, true);
assert.equal(compareProtectedPortStates(free, occupied).ok, false);
assert.equal(compareProtectedPortStates(occupied, free).ok, false);
assert.equal(compareProtectedPortStates(occupied, snapshotProtectedPort(5678)).ok, false);
assert.throws(() => snapshotProtectedPort(undefined));
process.stdout.write('PASS protected port state machine\n');
