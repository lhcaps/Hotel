import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it } from 'vitest';

import {
  applyVerifiedPaymentEvent,
  createPaymentAttempt,
} from '../../src/payment/payment-service.js';
import {
  bookingInput,
  createConcurrencyFixture,
  normalizedContact,
  requiredValue,
  runCaller,
  seedScenario,
  type ConcurrencyFixture,
} from './concurrency-fixtures.js';

type Provider = 'MOMO' | 'VNPAY';
type Outcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

type Scenario = Awaited<ReturnType<typeof seedScenario>> & {
  readonly bookingId: string;
  readonly paymentAttemptIds: readonly string[];
};

const FIXED_TIME = new Date('2027-01-10T04:30:00.000Z');

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

async function seedPaymentScenario(
  fixture: ConcurrencyFixture,
  provider: Provider = 'MOMO',
  label = 'gate-b9',
): Promise<Scenario> {
  const contact = normalizedContact(`${label}-${provider.toLowerCase()}`);
  const seeded = await seedScenario({
    pool: fixture.adminPool,
    roomCount: 1,
    quoteCount: 1,
    contact,
  });
  const booking = await runCaller(
    fixture.callers[0],
    bookingInput(requiredValue(seeded.quoteIds, 0, 'Gate B9 quote'), contact),
  );
  const attempt = await createPaymentAttempt({
    pool: fixture.callers[0].pool,
    propertyId: seeded.propertyId,
    bookingId: booking.bookingId,
    provider,
    idempotencyKey: `${label}-${provider.toLowerCase()}-attempt`,
    now: FIXED_TIME,
  });
  return { ...seeded, bookingId: booking.bookingId, paymentAttemptIds: [attempt.id] };
}

async function row<T extends Record<string, unknown>>(
  fixture: ConcurrencyFixture,
  query: string,
  values: readonly unknown[] = [],
): Promise<T> {
  const result = await fixture.adminPool.query<T>(query, [...values]);
  const first = result.rows[0];
  if (first === undefined) throw new Error('Expected a database row');
  return first;
}

async function paymentState(fixture: ConcurrencyFixture, bookingId: string) {
  return row<{
    booking_status: string;
    payment_status: string;
    attempt_status: string;
    review_code: string | null;
    transaction_id: string | null;
  }>(
    fixture,
    `SELECT b.status AS booking_status, p.status AS payment_status,
            pa.status AS attempt_status, pa.review_code,
            pa.provider_transaction_id AS transaction_id
       FROM bookings b
       JOIN payments p ON p.booking_id = b.id
       JOIN payment_attempts pa ON pa.payment_id = p.id
      WHERE b.id = $1
      ORDER BY pa.created_at DESC
      LIMIT 1`,
    [bookingId],
  );
}

async function settlementCounts(fixture: ConcurrencyFixture, bookingId: string) {
  return row<{
    provider_events: number;
    processed_events: number;
    audit_events: number;
    outbox_events: number;
    open_reviews: number;
    active_inventory: number;
    coupon_status: string | null;
  }>(
    fixture,
    `SELECT
       (SELECT count(*)::int FROM payment_provider_events ppe
         JOIN payment_attempts pa ON pa.id = ppe.payment_attempt_id
         JOIN payments p ON p.id = pa.payment_id
        WHERE p.booking_id = $1) AS provider_events,
       (SELECT count(*)::int FROM payment_provider_events ppe
         JOIN payment_attempts pa ON pa.id = ppe.payment_attempt_id
         JOIN payments p ON p.id = pa.payment_id
        WHERE p.booking_id = $1 AND ppe.processing_status = 'PROCESSED') AS processed_events,
       (SELECT count(*)::int FROM audit_events ae WHERE ae.aggregate_id = $1) AS audit_events,
       (SELECT count(*)::int FROM outbox_events oe WHERE oe.aggregate_id = $1) AS outbox_events,
       (SELECT count(*)::int FROM operational_reviews r WHERE r.booking_id = $1 AND r.status = 'OPEN') AS open_reviews,
       (SELECT count(*)::int FROM room_inventory_blocks rib
         WHERE rib.booking_id = $1 AND rib.status = 'ACTIVE') AS active_inventory,
       (SELECT bca.application_status::text FROM booking_coupon_applications bca
         WHERE bca.booking_id = $1 LIMIT 1) AS coupon_status`,
    [bookingId],
  );
}

describe('Gate B9 cross-provider PostgreSQL concurrency matrix', () => {
  let fixture: ConcurrencyFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it.each<Provider>(['MOMO', 'VNPAY'])(
    'deduplicates two concurrent identical %s successes with one committed settlement',
    async (provider) => {
      fixture = await createConcurrencyFixture();
      const scenario = await seedPaymentScenario(fixture, provider, `duplicate-${provider}`);
      const orderId = await row<{ provider_order_id: string }>(
        fixture,
        `SELECT provider_order_id FROM payment_attempts WHERE id = $1`,
        [scenario.paymentAttemptIds[0]],
      );
      const event = eventInput({
        pool: fixture.callers[0].pool,
        provider,
        providerOrderId: orderId.provider_order_id,
        eventKey: `b9-duplicate-${provider}`,
        transactionId: `b9-${provider}-transaction`,
      });
      const results = await Promise.all([
        applyVerifiedPaymentEvent(event),
        applyVerifiedPaymentEvent({ ...event, pool: fixture.callers[1].pool }),
      ]);

      expect(results.map((result) => result.processingStatus).sort()).toEqual([
        'DUPLICATE',
        'PROCESSED',
      ]);
      expect(await paymentState(fixture, scenario.bookingId)).toMatchObject({
        booking_status: 'CONFIRMED',
        payment_status: 'SUCCEEDED',
        attempt_status: 'SUCCEEDED',
      });
      expect(await settlementCounts(fixture, scenario.bookingId)).toMatchObject({
        provider_events: 1,
        processed_events: 1,
        audit_events: 2,
        outbox_events: 2,
        open_reviews: 0,
        active_inventory: 1,
      });
    },
  );

  it('serializes concurrent cross-provider successes so exactly one provider confirms', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedPaymentScenario(fixture, 'MOMO', 'cross-provider');
    const vnpayAttempt = await createPaymentAttempt({
      pool: fixture.callers[1].pool,
      propertyId: scenario.propertyId,
      bookingId: scenario.bookingId,
      provider: 'VNPAY',
      idempotencyKey: 'cross-provider-vnpay-attempt',
      now: FIXED_TIME,
    });
    const momoOrder = await row<{ provider_order_id: string }>(
      fixture,
      `SELECT provider_order_id FROM payment_attempts WHERE id = $1`,
      [scenario.paymentAttemptIds[0]],
    );
    const results = await Promise.all([
      applyVerifiedPaymentEvent(
        eventInput({
          pool: fixture.callers[0].pool,
          provider: 'MOMO',
          providerOrderId: momoOrder.provider_order_id,
          eventKey: 'b9-cross-momo',
          transactionId: 'b9-cross-momo-tx',
        }),
      ),
      applyVerifiedPaymentEvent(
        eventInput({
          pool: fixture.callers[1].pool,
          provider: 'VNPAY',
          providerOrderId: vnpayAttempt.providerOrderId,
          eventKey: 'b9-cross-vnpay',
          transactionId: 'b9-cross-vnpay-tx',
        }),
      ),
    ]);

    expect(results.map((result) => result.processingStatus).sort()).toEqual([
      'PROCESSED',
      'REVIEW_REQUIRED',
    ]);
    const states = await fixture.adminPool.query<{ status: string; review_code: string | null }>(
      `SELECT pa.status, pa.review_code
         FROM payment_attempts pa JOIN payments p ON p.id = pa.payment_id
        WHERE p.booking_id = $1 ORDER BY pa.provider`,
      [scenario.bookingId],
    );
    expect(states.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'SUCCEEDED', review_code: null }),
        expect.objectContaining({
          status: 'REVIEW_REQUIRED',
          review_code: 'PAYMENT_BOOKING_STATE',
        }),
      ]),
    );
  });

  it.each([
    [
      'hold expiry',
      "UPDATE bookings SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP WHERE id = $1",
      'BOOKING_EXPIRED',
    ],
    [
      'admin cancellation',
      "UPDATE bookings SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = 'Gate B9 admin race' WHERE id = $1",
      'BOOKING_CANCELLED',
    ],
    [
      'inventory release',
      "UPDATE room_inventory_blocks SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE booking_id = $1",
      'INVENTORY_RELEASED',
    ],
    [
      'check-in',
      "UPDATE bookings SET status = 'CHECKED_IN', checked_in_at = CURRENT_TIMESTAMP WHERE id = $1",
      'PAYMENT_BOOKING_STATE',
    ],
    [
      'no-show',
      "UPDATE bookings SET status = 'NO_SHOW', no_show_at = CURRENT_TIMESTAMP WHERE id = $1",
      'PAYMENT_BOOKING_STATE',
    ],
  ] as const)(
    'keeps a verified success in review when %s wins the race',
    async (_label, mutation, reviewCode) => {
      fixture = await createConcurrencyFixture();
      const scenario = await seedPaymentScenario(fixture, 'MOMO', `state-${reviewCode}`);
      await fixture.adminPool.query(mutation, [scenario.bookingId]);
      const order = await row<{ provider_order_id: string }>(
        fixture,
        'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
        [scenario.paymentAttemptIds[0]],
      );
      await expect(
        applyVerifiedPaymentEvent(
          eventInput({
            pool: fixture.callers[1].pool,
            provider: 'MOMO',
            providerOrderId: order.provider_order_id,
            eventKey: `b9-state-${reviewCode}`,
            transactionId: `b9-state-${reviewCode}-tx`,
          }),
        ),
      ).resolves.toEqual({ processingStatus: 'REVIEW_REQUIRED' });
      const state = await paymentState(fixture, scenario.bookingId);
      expect(state).toMatchObject({
        attempt_status: 'REVIEW_REQUIRED',
        payment_status: 'REVIEW_REQUIRED',
        review_code: reviewCode,
      });
      expect(state.booking_status).not.toBe('CONFIRMED');
      expect(await settlementCounts(fixture, scenario.bookingId)).toMatchObject({
        provider_events: 1,
        processed_events: 0,
        outbox_events: 1,
        open_reviews: 0,
      });
    },
  );

  it('redeems a reserved coupon once while duplicate provider deliveries remain idempotent', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedPaymentScenario(fixture, 'MOMO', 'coupon-redemption');
    const couponId = randomUUID();
    const contactDigest = Buffer.alloc(32, 77);
    await fixture.adminPool.query(
      `INSERT INTO coupons
         (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd,
          minimum_order_amount_vnd, valid_from, valid_until, applies_to_all_room_types, total_usage_limit)
       VALUES ($1, $2, 'B9-COUPON', 'ACTIVE', 'FIXED', 1000, 0,
               CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '1 day', true, 5)`,
      [couponId, scenario.propertyId],
    );
    await fixture.adminPool.query(
      'ALTER TABLE booking_coupon_applications DISABLE TRIGGER booking_coupon_applications_validate_insert',
    );
    try {
      await fixture.adminPool.query(
        `INSERT INTO booking_coupon_applications
           (property_id, booking_id, coupon_id, customer_email_digest, application_status, quota_reserved,
            discount_type, fixed_amount_vnd, minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
            final_amount_vnd, coupon_code_snapshot, reserved_at)
         VALUES ($1, $2, $3, $4, 'RESERVED', true, 'FIXED', 1000, 0, 359000, 1000, 358000, 'B9-COUPON', CURRENT_TIMESTAMP)`,
        [scenario.propertyId, scenario.bookingId, couponId, contactDigest],
      );
    } finally {
      await fixture.adminPool.query(
        'ALTER TABLE booking_coupon_applications ENABLE TRIGGER booking_coupon_applications_validate_insert',
      );
    }
    const order = await row<{ provider_order_id: string }>(
      fixture,
      'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
      [scenario.paymentAttemptIds[0]],
    );
    const event = eventInput({
      pool: fixture.callers[0].pool,
      provider: 'MOMO',
      providerOrderId: order.provider_order_id,
      eventKey: 'b9-coupon-event',
      transactionId: 'b9-coupon-tx',
    });
    const results = await Promise.all([
      applyVerifiedPaymentEvent(event),
      applyVerifiedPaymentEvent({ ...event, pool: fixture.callers[1].pool }),
    ]);
    expect(results.map((result) => result.processingStatus).sort()).toEqual([
      'DUPLICATE',
      'PROCESSED',
    ]);
    expect(await settlementCounts(fixture, scenario.bookingId)).toMatchObject({
      coupon_status: 'REDEEMED',
      provider_events: 1,
      audit_events: 4,
      outbox_events: 2,
    });
  });

  it('rejects a duplicate transaction on another attempt and keeps altered duplicate payload idempotent', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedPaymentScenario(fixture, 'MOMO', 'transaction-conflict');
    const second = await createPaymentAttempt({
      pool: fixture.callers[1].pool,
      propertyId: scenario.propertyId,
      bookingId: scenario.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'transaction-conflict-second',
      now: FIXED_TIME,
    });
    const firstOrder = await row<{ provider_order_id: string }>(
      fixture,
      'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
      [scenario.paymentAttemptIds[0]],
    );
    const first = await applyVerifiedPaymentEvent(
      eventInput({
        pool: fixture.callers[0].pool,
        provider: 'MOMO',
        providerOrderId: firstOrder.provider_order_id,
        eventKey: 'b9-transaction-first',
        transactionId: 'b9-shared-provider-tx',
      }),
    );
    const conflict = await applyVerifiedPaymentEvent(
      eventInput({
        pool: fixture.callers[1].pool,
        provider: 'MOMO',
        providerOrderId: second.providerOrderId,
        eventKey: 'b9-transaction-conflict',
        transactionId: 'b9-shared-provider-tx',
      }),
    );
    const alteredDuplicate = await applyVerifiedPaymentEvent(
      eventInput({
        pool: fixture.callers[1].pool,
        provider: 'MOMO',
        providerOrderId: firstOrder.provider_order_id,
        eventKey: 'b9-transaction-first',
        transactionId: 'b9-altered-payload-tx',
        amountVnd: 1n,
        digest: 99,
      }),
    );

    expect(first.processingStatus).toBe('PROCESSED');
    expect(conflict.processingStatus).toBe('REVIEW_REQUIRED');
    expect(alteredDuplicate.processingStatus).toBe('DUPLICATE');
    expect(await paymentState(fixture, scenario.bookingId)).toMatchObject({
      booking_status: 'CONFIRMED',
      payment_status: 'SUCCEEDED',
      attempt_status: 'REVIEW_REQUIRED',
      review_code: 'TRANSACTION_CONFLICT',
    });
    expect(await settlementCounts(fixture, scenario.bookingId)).toMatchObject({
      provider_events: 2,
      audit_events: 2,
      outbox_events: 2,
    });
  });

  it('allows failure-then-success recovery but keeps a later stale failure from undoing success', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedPaymentScenario(fixture, 'VNPAY', 'failure-success');
    const order = await row<{ provider_order_id: string }>(
      fixture,
      'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
      [scenario.paymentAttemptIds[0]],
    );
    await expect(
      applyVerifiedPaymentEvent(
        eventInput({
          pool: fixture.callers[0].pool,
          provider: 'VNPAY',
          providerOrderId: order.provider_order_id,
          eventKey: 'b9-failure-first',
          transactionId: 'b9-failure-tx',
          outcome: 'FAILED',
        }),
      ),
    ).resolves.toEqual({ processingStatus: 'PROCESSED' });
    await expect(
      applyVerifiedPaymentEvent(
        eventInput({
          pool: fixture.callers[1].pool,
          provider: 'VNPAY',
          providerOrderId: order.provider_order_id,
          eventKey: 'b9-success-after-failure',
          transactionId: 'b9-success-tx',
        }),
      ),
    ).resolves.toEqual({ processingStatus: 'PROCESSED' });
    await expect(
      applyVerifiedPaymentEvent(
        eventInput({
          pool: fixture.callers[0].pool,
          provider: 'VNPAY',
          providerOrderId: order.provider_order_id,
          eventKey: 'b9-stale-query-failure',
          transactionId: 'b9-stale-query-tx',
          outcome: 'FAILED',
        }),
      ),
    ).resolves.toEqual({ processingStatus: 'PROCESSED' });

    expect(await paymentState(fixture, scenario.bookingId)).toMatchObject({
      booking_status: 'CONFIRMED',
      payment_status: 'SUCCEEDED',
      attempt_status: 'SUCCEEDED',
      transaction_id: 'b9-stale-query-tx',
    });
  });

  it('serializes concurrent workers creating the same provider attempt', async () => {
    fixture = await createConcurrencyFixture();
    const contact = normalizedContact('worker-race');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 1,
      quoteCount: 1,
      contact,
    });
    const booking = await runCaller(
      fixture.callers[0],
      bookingInput(requiredValue(scenario.quoteIds, 0, 'worker race quote'), contact),
    );
    const input = {
      propertyId: scenario.propertyId,
      bookingId: booking.bookingId,
      provider: 'MOMO' as const,
      idempotencyKey: 'b9-worker-idempotency',
      now: FIXED_TIME,
    };
    const results = await Promise.all([
      createPaymentAttempt({ pool: fixture.callers[0].pool, ...input }),
      createPaymentAttempt({ pool: fixture.callers[1].pool, ...input }),
    ]);
    expect(results[0]?.id).toBe(results[1]?.id);
    expect(results[0]?.providerOrderId).toBe(results[1]?.providerOrderId);
    const count = await row<{ count: number }>(
      fixture,
      'SELECT count(*)::int AS count FROM payment_attempts WHERE idempotency_key = $1',
      [input.idempotencyKey],
    );
    expect(count.count).toBe(1);
  });

  it('recovers a leased reconciliation attempt after lease expiry and preserves audit/outbox atomicity', async () => {
    fixture = await createConcurrencyFixture();
    const scenario = await seedPaymentScenario(fixture, 'MOMO', 'lease-recovery');
    const attemptId = scenario.paymentAttemptIds[0];
    await fixture.adminPool.query(
      `UPDATE payment_attempts
          SET lease_owner = 'worker-crashed', lease_expires_at = CURRENT_TIMESTAMP - interval '1 minute',
              next_reconciliation_at = CURRENT_TIMESTAMP, reconciliation_attempt_count = 1
        WHERE id = $1`,
      [attemptId],
    );
    const order = await row<{ provider_order_id: string }>(
      fixture,
      'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
      [attemptId],
    );
    await expect(
      applyVerifiedPaymentEvent(
        eventInput({
          pool: fixture.callers[1].pool,
          provider: 'MOMO',
          providerOrderId: order.provider_order_id,
          eventKey: 'b9-lease-recovery-event',
          transactionId: 'b9-lease-recovery-tx',
        }),
      ),
    ).resolves.toEqual({ processingStatus: 'PROCESSED' });
    expect(await paymentState(fixture, scenario.bookingId)).toMatchObject({
      booking_status: 'CONFIRMED',
      payment_status: 'SUCCEEDED',
      attempt_status: 'SUCCEEDED',
    });
    expect(await settlementCounts(fixture, scenario.bookingId)).toMatchObject({
      provider_events: 1,
      audit_events: 2,
      outbox_events: 2,
      open_reviews: 0,
    });
  });
});
