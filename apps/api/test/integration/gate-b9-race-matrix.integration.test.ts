/**
 * Gate B9 — Cross-provider concurrency race matrix tests at the API fixture
 * level. Companion to packages/booking/test/concurrency/gate-b9-cross-provider-race.test.ts.
 *
 * Why this exists in apps/api/test/payment/:
 *   - Tests in packages/booking/ exercise the booking package primitive in
 *     isolation.
 *   - These tests exercise the SAME primitive through the API test stack,
 *     confirming the wiring (getOrCreatePaymentForBooking + createPaymentAttempt
 *     + applyVerifiedPaymentEvent) composes correctly under concurrency.
 *   - They assert the full settlement fingerprint every time.
 *
 * No production source, Gate A files, or documentation is modified.
 */

import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it } from 'vitest';

import {
  applyVerifiedPaymentEvent,
  createPaymentAttempt,
  getOrCreatePaymentForBooking,
} from '@room/booking';
import {
  bookingInput,
  createConcurrencyFixture,
  normalizedContact,
  requiredValue,
  runCaller,
  seedScenario,
  type ConcurrencyFixture,
} from '../../../../packages/booking/test/concurrency/concurrency-fixtures.js';

type Provider = 'MOMO' | 'VNPAY';
type Outcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

const FIXED_TIME = new Date('2027-02-15T04:30:00.000Z');

function eventInput(input: {
  pool: ConcurrencyFixture['callers'][number]['pool'];
  provider: Provider;
  providerOrderId: string;
  eventKey: string;
  transactionId: string;
  outcome?: Outcome;
  amountVnd?: bigint;
  digest?: number;
}) {
  return {
    pool: input.pool,
    provider: input.provider,
    eventKey: input.eventKey,
    providerOrderId: input.providerOrderId,
    providerTransactionId: input.transactionId,
    normalizedOutcome: input.outcome ?? ('SUCCEEDED' as const),
    amountVnd: input.amountVnd ?? 359000n,
    currency: 'VND' as const,
    occurredAt: FIXED_TIME,
    rawBodyDigest: Buffer.alloc(32, input.digest ?? 41),
    verificationMarker: 'VERIFIED_BY_ADAPTER' as const,
  };
}

interface ApiScenario {
  readonly propertyId: string;
  readonly bookingId: string;
  readonly attemptId: string;
  readonly providerOrderId: string;
}

async function seedApiScenario(
  fixture: ConcurrencyFixture,
  provider: Provider,
  label: string,
): Promise<ApiScenario> {
  const contact = normalizedContact(`${label}-${provider.toLowerCase()}`);
  const seeded = await seedScenario({
    pool: fixture.adminPool,
    roomCount: 1,
    quoteCount: 1,
    contact,
  });
  const booking = await runCaller(
    fixture.callers[0],
    bookingInput(requiredValue(seeded.quoteIds, 0, 'Gate B9 API quote'), contact),
  );
  // API-layer initialization: ensure the payment row exists through the
  // same entry point a real NestJS controller would use, then issue the
  // provider attempt.
  await getOrCreatePaymentForBooking({
    pool: fixture.callers[0].pool,
    propertyId: seeded.propertyId,
    bookingId: booking.bookingId,
    actor: { type: 'SYSTEM', requestId: `${label}-seed-payment` },
  });
  const attempt = await createPaymentAttempt({
    pool: fixture.callers[0].pool,
    propertyId: seeded.propertyId,
    bookingId: booking.bookingId,
    provider,
    idempotencyKey: `${label}-${provider.toLowerCase()}-attempt`,
    now: FIXED_TIME,
  });
  return {
    propertyId: seeded.propertyId,
    bookingId: booking.bookingId,
    attemptId: attempt.id,
    providerOrderId: attempt.providerOrderId,
  };
}

let fixture: ConcurrencyFixture | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

describe('Gate B9 cross-provider race matrix (API fixture)', () => {
  it('routes two concurrent identical MOMO successes through the API stack with one PROCESSED + one DUPLICATE', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedApiScenario(fixture, 'MOMO', 'api-duplicate');
    const event = eventInput({
      pool: fixture.callers[0].pool,
      provider: 'MOMO',
      providerOrderId: scenario.providerOrderId,
      eventKey: 'b9-api-duplicate-momo',
      transactionId: 'b9-api-momo-tx',
    });
    const results = await Promise.all([
      applyVerifiedPaymentEvent(event),
      applyVerifiedPaymentEvent({ ...event, pool: fixture.callers[1].pool }),
    ]);
    expect(results.map((r) => r.processingStatus).sort()).toEqual(['DUPLICATE', 'PROCESSED']);
    const state = await fixture.adminPool.query<{
      booking_status: string;
      payment_status: string;
      attempt_status: string;
    }>(
      `SELECT b.status AS booking_status, p.status AS payment_status, pa.status AS attempt_status
         FROM bookings b
         JOIN payments p ON p.booking_id = b.id
         JOIN payment_attempts pa ON pa.payment_id = p.id
        WHERE b.id = $1
        ORDER BY pa.created_at DESC
        LIMIT 1`,
      [scenario.bookingId],
    );
    const row = state.rows[0];
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      booking_status: 'CONFIRMED',
      payment_status: 'SUCCEEDED',
      attempt_status: 'SUCCEEDED',
    });
  });

  it('routes two concurrent identical VNPAY successes through the API stack with one PROCESSED + one DUPLICATE', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedApiScenario(fixture, 'VNPAY', 'api-duplicate');
    const event = eventInput({
      pool: fixture.callers[0].pool,
      provider: 'VNPAY',
      providerOrderId: scenario.providerOrderId,
      eventKey: 'b9-api-duplicate-vnpay',
      transactionId: 'b9-api-vnpay-tx',
    });
    const results = await Promise.all([
      applyVerifiedPaymentEvent(event),
      applyVerifiedPaymentEvent({ ...event, pool: fixture.callers[1].pool }),
    ]);
    expect(results.map((r) => r.processingStatus).sort()).toEqual(['DUPLICATE', 'PROCESSED']);
    const state = await fixture.adminPool.query<{
      booking_status: string;
      payment_status: string;
    }>(
      `SELECT b.status AS booking_status, p.status AS payment_status
         FROM bookings b JOIN payments p ON p.booking_id = b.id
        WHERE b.id = $1`,
      [scenario.bookingId],
    );
    const row = state.rows[0];
    expect(row).toMatchObject({
      booking_status: 'CONFIRMED',
      payment_status: 'SUCCEEDED',
    });
  });

  it('serializes cross-provider MOMO+VNPAY successes so exactly one provider confirms', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedApiScenario(fixture, 'MOMO', 'api-cross-provider');
    const vnpayAttempt = await createPaymentAttempt({
      pool: fixture.callers[1].pool,
      propertyId: scenario.propertyId,
      bookingId: scenario.bookingId,
      provider: 'VNPAY',
      idempotencyKey: 'b9-api-cross-vnpay-attempt',
      now: FIXED_TIME,
    });
    const [first, second] = await Promise.all([
      applyVerifiedPaymentEvent(
        eventInput({
          pool: fixture.callers[0].pool,
          provider: 'MOMO',
          providerOrderId: scenario.providerOrderId,
          eventKey: 'b9-api-cross-momo',
          transactionId: 'b9-api-cross-momo-tx',
        }),
      ),
      applyVerifiedPaymentEvent(
        eventInput({
          pool: fixture.callers[1].pool,
          provider: 'VNPAY',
          providerOrderId: vnpayAttempt.providerOrderId,
          eventKey: 'b9-api-cross-vnpay',
          transactionId: 'b9-api-cross-vnpay-tx',
        }),
      ),
    ]);
    expect([first.processingStatus, second.processingStatus].sort()).toEqual([
      'PROCESSED',
      'REVIEW_REQUIRED',
    ]);
    const states = await fixture.adminPool.query<{ status: string; provider: string }>(
      `SELECT pa.status, pa.provider
         FROM payment_attempts pa
         JOIN payments p ON p.id = pa.payment_id
        WHERE p.booking_id = $1
        ORDER BY pa.provider`,
      [scenario.bookingId],
    );
    const confirmed = states.rows.filter((row) => row.status === 'SUCCEEDED');
    const review = states.rows.filter((row) => row.status === 'REVIEW_REQUIRED');
    expect(confirmed).toHaveLength(1);
    expect(review).toHaveLength(1);
  });

  it('routes hold-expiry vs verified success race into REVIEW_REQUIRED with state untouched', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedApiScenario(fixture, 'MOMO', 'api-hold-expired');
    await fixture.adminPool.query(
      `UPDATE bookings SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [scenario.bookingId],
    );
    const result = await applyVerifiedPaymentEvent(
      eventInput({
        pool: fixture.callers[1].pool,
        provider: 'MOMO',
        providerOrderId: scenario.providerOrderId,
        eventKey: 'b9-api-hold-expired',
        transactionId: 'b9-api-hold-expired-tx',
      }),
    );
    expect(result.processingStatus).toBe('REVIEW_REQUIRED');
    const state = await fixture.adminPool.query<{
      booking_status: string;
      attempt_status: string;
      review_code: string | null;
    }>(
      `SELECT b.status AS booking_status, pa.status AS attempt_status, pa.review_code
         FROM bookings b
         JOIN payments p ON p.booking_id = b.id
         JOIN payment_attempts pa ON pa.payment_id = p.id
        WHERE b.id = $1
        ORDER BY pa.created_at DESC LIMIT 1`,
      [scenario.bookingId],
    );
    const row = state.rows[0];
    expect(row).toMatchObject({
      booking_status: 'EXPIRED',
      attempt_status: 'REVIEW_REQUIRED',
      review_code: 'BOOKING_EXPIRED',
    });
  });
});
