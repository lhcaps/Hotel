import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardedTestDatabase } from '../../src/testing.js';
import {
  createMigratedTestDatabase,
  IDS,
  insertBooking,
  insertCatalogFixture,
  postgresErrorCode,
} from './helpers.js';

describe('booking database constraints', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
    await insertCatalogFixture(database.pool);
  });

  afterAll(async () => {
    await database.dispose();
  });

  it.each([
    ['less than 60 minutes', '2027-01-10T04:00:00Z', '2027-01-10T04:45:00Z'],
    ['more than 24 hours', '2027-01-10T04:00:00Z', '2027-01-11T04:15:00Z'],
    ['non-quarter-hour start', '2027-01-10T04:01:00Z', '2027-01-10T05:01:00Z'],
    ['non-quarter-hour end', '2027-01-10T04:00:00Z', '2027-01-10T05:01:00Z'],
  ])('rejects %s', async (_label, checkIn, checkOut) => {
    const error = await insertBooking(database.pool, {
      id: randomUUID(),
      checkIn,
      checkOut,
    }).catch((cause: unknown) => cause);
    expect(postgresErrorCode(error)).toBe('23514');
  });

  it.each([
    ['-1', '0', '-1'],
    ['359000', '-1', '359001'],
    ['359000', '1000', '359000'],
  ])('rejects invalid integer money snapshot %s/%s/%s', async (gross, discount, final) => {
    const error = await insertBooking(database.pool, {
      id: randomUUID(),
      grossAmount: gross,
      discountAmount: discount,
      finalAmount: final,
    }).catch((cause: unknown) => cause);
    expect(postgresErrorCode(error)).toBe('23514');
  });

  it('requires a non-empty object price snapshot', async () => {
    for (const snapshot of [null, [], {}]) {
      const error = await insertBooking(database.pool, {
        id: randomUUID(),
        priceSnapshot: snapshot,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(error)).toBe('23514');
    }
  });

  it('requires immutable hold expiry after creation and EXPIRED timestamps iff expired', async () => {
    const badExpiry = await insertBooking(database.pool, {
      id: randomUUID(),
      createdAt: '2026-12-01T00:00:00Z',
      holdExpiresAt: '2026-12-01T00:00:00Z',
    }).catch((cause: unknown) => cause);
    expect(postgresErrorCode(badExpiry)).toBe('23514');

    const missingExpiredAt = await insertBooking(database.pool, {
      id: randomUUID(),
      status: 'EXPIRED',
      expiredAt: null,
    }).catch((cause: unknown) => cause);
    expect(postgresErrorCode(missingExpiredAt)).toBe('23514');

    const unexpectedExpiredAt = await insertBooking(database.pool, {
      id: randomUUID(),
      status: 'HOLD',
      expiredAt: '2026-12-01T00:16:00Z',
    }).catch((cause: unknown) => cause);
    expect(postgresErrorCode(unexpectedExpiredAt)).toBe('23514');

    await insertBooking(database.pool);
    const immutable = await database.pool
      .query(
        `UPDATE bookings SET hold_expires_at = hold_expires_at + interval '1 minute' WHERE id = $1`,
        [IDS.booking],
      )
      .catch((cause: unknown) => cause);
    expect(postgresErrorCode(immutable)).toBe('P0001');
  });

  it('stores historical HOLD rows without a clock-dependent check and queries validity transactionally', async () => {
    const historicalId = randomUUID();
    await insertBooking(database.pool, {
      id: historicalId,
      createdAt: '2024-01-01T00:00:00Z',
      holdExpiresAt: '2024-01-01T00:15:00Z',
    });

    const current = await database.pool.query(
      `SELECT id FROM bookings
        WHERE id = $1
          AND status = 'HOLD'
          AND hold_expires_at > CURRENT_TIMESTAMP`,
      [historicalId],
    );
    expect(current.rowCount).toBe(0);
  });
});
