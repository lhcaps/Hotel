import { afterEach, describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';

import { applyVerifiedPaymentEvent, createPaymentAttempt } from '@room/booking';
import { expireStaleHolds } from '../src/jobs/expire-stale-holds.js';
import {
  createExpirationFixture,
  seedHold,
  type ExpirationFixture,
} from './fixtures/hold-expiration-fixtures.js';

let fixture: ExpirationFixture | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

describe('verified payment and actual hold-expiry worker race', () => {
  it('never confirms an already-expired HOLD regardless of which transaction obtains the booking lock first', async () => {
    fixture = await createExpirationFixture();
    const bookingId = await seedHold(fixture.pool, { stale: false });
    const booking = await fixture.pool.query<{ property_id: string }>(
      'SELECT property_id FROM bookings WHERE id = $1',
      [bookingId],
    );
    const propertyId = booking.rows[0]?.property_id;
    if (propertyId === undefined) throw new Error('Race fixture booking is missing');

    const attempt = await createPaymentAttempt({
      pool: fixture.pool,
      propertyId,
      bookingId,
      provider: 'MOMO',
      idempotencyKey: 'expiry-race-attempt',
      now: new Date(),
    });
    // The deadline is an immutable booking fact. This fixture-only change
    // creates the precise post-attempt/pre-settlement race state.
    await fixture.pool.query(
      'ALTER TABLE bookings DISABLE TRIGGER bookings_reject_immutable_fact_mutation',
    );
    try {
      await fixture.pool.query(
        `UPDATE bookings
            SET hold_expires_at = CURRENT_TIMESTAMP - interval '1 second'
          WHERE id = $1`,
        [bookingId],
      );
    } finally {
      await fixture.pool.query(
        'ALTER TABLE bookings ENABLE TRIGGER bookings_reject_immutable_fact_mutation',
      );
    }

    const webhookPool = fixture.createPool('phase7c-webhook-race');
    const workerPool = fixture.createPool('phase7c-expiry-race');
    const [settlement] = await Promise.all([
      applyVerifiedPaymentEvent({
        pool: webhookPool,
        provider: 'MOMO',
        eventKey: 'expiry-race-event',
        providerOrderId: attempt.providerOrderId,
        providerTransactionId: 'momo-expiry-race-transaction',
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: 1000n,
        currency: 'VND',
        occurredAt: new Date(),
        rawBodyDigest: Buffer.alloc(32, 31),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
      expireStaleHolds({ pool: workerPool, batchSize: 1, maxBatches: 1 }),
    ]);

    // SKIP LOCKED can make the concurrent worker defer the row; a retry is
    // the worker's normal recovery behavior and must still not resurrect it.
    await expireStaleHolds({ pool: fixture.pool, batchSize: 1, maxBatches: 1 });

    expect(settlement).toEqual({ processingStatus: 'REVIEW_REQUIRED' });
    await expect(
      fixture.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'EXPIRED' }] });
    await expect(
      fixture.pool.query<{ status: string; review_code: string }>(
        'SELECT status, review_code FROM payment_attempts WHERE id = $1',
        [attempt.id],
      ),
    ).resolves.toMatchObject({
      rows: [{ status: 'REVIEW_REQUIRED', review_code: 'BOOKING_EXPIRED' }],
    });
    await expect(
      fixture.pool.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM audit_events
        WHERE aggregate_id = $1 AND event_type = 'booking.confirmed_by_payment'`,
        [bookingId],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });
});
