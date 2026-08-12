import assert from 'node:assert/strict';
import test from 'node:test';

import { futureLunchInterval, selectAvailableRoomType } from './payment-canary-fixtures.mjs';

test('payment canary uses a production-valid lunch interval without a seeded room UUID', () => {
  const interval = futureLunchInterval(new Date('2026-08-20T00:00:00.000Z'), 2);
  assert.equal(interval.checkIn, '2026-08-22T04:00:00.000Z');
  assert.equal(interval.checkOut, '2026-08-22T07:00:00.000Z');
  assert.equal(interval.mode, 'hourly');
  assert.equal(interval.adults, 2);
  assert.equal(interval.children, 0);
});

test('payment canary selects only an available priced catalog result', () => {
  assert.equal(
    selectAvailableRoomType([
      { roomTypeId: 'unavailable', availableRoomCount: 0, offer: { amountVnd: 359000 } },
      {
        roomTypeId: 'valid-production-shaped',
        availableRoomCount: 1,
        offer: { amountVnd: 359000 },
      },
    ]),
    'valid-production-shaped',
  );
  assert.equal(
    selectAvailableRoomType([
      { roomTypeId: 'missing-price', availableRoomCount: 1, offer: null },
      { availableRoomCount: 1, offer: { amountVnd: 359000 } },
    ]),
    undefined,
  );
});
