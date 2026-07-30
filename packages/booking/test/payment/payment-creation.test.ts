import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { migrateDatabase } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import * as booking from '../../src/index.js';
import { normalizeContact } from '../../src/contact.js';
import {
  seedBookingHoldFixture,
  seedConsumedExpiredBooking,
} from '../fixtures/booking-hold-fixtures.js';

const paymentCore = booking as typeof booking & {
  getOrCreatePaymentForBooking(input: {
    propertyId: string;
    bookingId: string;
    actor: { type: 'SYSTEM'; requestId: string };
    pool: GuardedTestDatabase['pool'];
  }): Promise<{ id: string; amountVnd: bigint; status: string }>;
  createPaymentAttempt(input: {
    pool: GuardedTestDatabase['pool'];
    propertyId: string;
    bookingId: string;
    provider: 'MOMO' | 'VNPAY';
    idempotencyKey: string;
    now: Date;
  }): Promise<{ id: string; amountVnd: bigint; provider: string; providerOrderId: string }>;
};

describe('payment aggregate creation', () => {
  let database: GuardedTestDatabase | undefined;

  afterEach(async () => {
    await database?.dispose();
    database = undefined;
  });

  it('copies the immutable booking amount and returns the existing aggregate', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Payment Fixture', email: 'payment@example.test', phone: '+84901234567' },
      Buffer.alloc(32, 1),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });

    const input = {
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      actor: { type: 'SYSTEM' as const, requestId: 'payment-create-001' },
      pool: database.pool,
    };
    const first = await paymentCore.getOrCreatePaymentForBooking(input);
    const duplicate = await paymentCore.getOrCreatePaymentForBooking(input);

    expect(first.amountVnd).toBe(359000n);
    expect(first.status).toBe('PENDING');
    expect(duplicate.id).toBe(first.id);

    const count = await database.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM payments WHERE booking_id = $1',
      [held.bookingId],
    );
    expect(count.rows[0]?.count).toBe(1);
  });

  it('creates one positive VND attempt for the same payment idempotency key', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Attempt Fixture', email: 'attempt@example.test', phone: '+84901234568' },
      Buffer.alloc(32, 2),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });

    const input = {
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO' as const,
      idempotencyKey: 'attempt-create-001',
      now: new Date(),
    };
    const first = await paymentCore.createPaymentAttempt(input);
    const duplicate = await paymentCore.createPaymentAttempt(input);

    expect(first.provider).toBe('MOMO');
    expect(first.amountVnd).toBe(359000n);
    expect(first.providerOrderId).not.toBe('');
    expect(duplicate.id).toBe(first.id);
  });
});
