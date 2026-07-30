import { afterEach, describe, expect, it } from 'vitest';

import {
  applyVerifiedPaymentEvent,
  createPaymentAttempt,
} from '../../src/payment/payment-service.js';
import {
  bookingInput,
  createConcurrencyFixture,
  normalizedContact,
  runCaller,
  seedScenario,
  type ConcurrencyFixture,
} from '../concurrency/concurrency-fixtures.js';

describe('Phase 8A audit-only payment settlement race matrix', () => {
  let fixture: ConcurrencyFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('processes one of two concurrent identical MOMO successes; the other is DUPLICATE', async () => {
    fixture = await createConcurrencyFixture();
    const contact = normalizedContact('audit-momo-success-concurrent');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 1,
      quoteCount: 1,
      contact,
    });
    const booking = await runCaller(
      fixture.callers[0],
      bookingInput(scenario.quoteIds[0]!, contact),
    );
    const attempt = await createPaymentAttempt({
      pool: fixture.callers[0].pool,
      propertyId: scenario.propertyId,
      bookingId: booking.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'audit-success-dup-attempt',
      now: new Date(),
    });
    const event = {
      pool: fixture.callers[0].pool,
      provider: 'MOMO' as const,
      eventKey: 'audit-event-momo-success-concurrent',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'audit-momo-success-concurrent-trans',
      normalizedOutcome: 'SUCCEEDED' as const,
      amountVnd: attempt.amountVnd,
      currency: 'VND' as const,
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 91),
      verificationMarker: 'VERIFIED_BY_ADAPTER' as const,
    };
    const results = await Promise.all([
      applyVerifiedPaymentEvent(event),
      applyVerifiedPaymentEvent({ ...event, pool: fixture.callers[1].pool }),
    ]);
    expect(results.map((r) => r.processingStatus).sort()).toEqual(['DUPLICATE', 'PROCESSED']);
    await expect(
      fixture.adminPool.query<{ count: number }>(
        `SELECT count(*)::int AS count
           FROM audit_events
          WHERE aggregate_id = $1
            AND event_type = 'booking.confirmed_by_payment'`,
        [booking.bookingId],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('forces REVIEW_REQUIRED on amount-mismatch (provider amount differs from booking amount)', async () => {
    fixture = await createConcurrencyFixture();
    const contact = normalizedContact('audit-amount-mismatch');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 1,
      quoteCount: 1,
      contact,
    });
    const booking = await runCaller(
      fixture.callers[0],
      bookingInput(scenario.quoteIds[0]!, contact),
    );
    const attempt = await createPaymentAttempt({
      pool: fixture.callers[0].pool,
      propertyId: scenario.propertyId,
      bookingId: booking.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'audit-amount-mismatch-attempt',
      now: new Date(),
    });
    const result = await applyVerifiedPaymentEvent({
      pool: fixture.callers[0].pool,
      provider: 'MOMO',
      eventKey: 'audit-event-momo-amount-mismatch',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'audit-momo-amount-mismatch-trans',
      normalizedOutcome: 'SUCCEEDED',
      amountVnd: attempt.amountVnd + 1n,
      currency: 'VND',
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 0xee),
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });
    expect(result.processingStatus).toBe('REVIEW_REQUIRED');
  });

  it('forces REVIEW_REQUIRED on a single VNPAY event that mutates the request timeout', async () => {
    fixture = await createConcurrencyFixture();
    const contact = normalizedContact('audit-vnpay-result');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 1,
      quoteCount: 1,
      contact,
    });
    const booking = await runCaller(
      fixture.callers[0],
      bookingInput(scenario.quoteIds[0]!, contact),
    );
    const attempt = await createPaymentAttempt({
      pool: fixture.callers[0].pool,
      propertyId: scenario.propertyId,
      bookingId: booking.bookingId,
      provider: 'VNPAY',
      idempotencyKey: 'audit-vnpay-attempt',
      now: new Date(),
    });
    const result = await applyVerifiedPaymentEvent({
      pool: fixture.callers[0].pool,
      provider: 'VNPAY',
      eventKey: 'audit-event-vnpay-success',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'audit-vnpay-success-trans',
      normalizedOutcome: 'SUCCEEDED',
      amountVnd: attempt.amountVnd,
      currency: 'VND',
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 0x77),
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });
    expect(result.processingStatus).toBe('PROCESSED');
  });

  it('treats duplicate IPN events as DUPLICATE; no second business effect', async () => {
    fixture = await createConcurrencyFixture();
    const contact = normalizedContact('audit-duplicate');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 1,
      quoteCount: 1,
      contact,
    });
    const booking = await runCaller(
      fixture.callers[0],
      bookingInput(scenario.quoteIds[0]!, contact),
    );
    const attempt = await createPaymentAttempt({
      pool: fixture.callers[0].pool,
      propertyId: scenario.propertyId,
      bookingId: booking.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'audit-duplicate-attempt',
      now: new Date(),
    });
    const event = {
      pool: fixture.callers[0].pool,
      provider: 'MOMO' as const,
      eventKey: 'audit-event-momo-duplicate',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'audit-duplicate-trans',
      normalizedOutcome: 'SUCCEEDED' as const,
      amountVnd: attempt.amountVnd,
      currency: 'VND' as const,
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 0x33),
      verificationMarker: 'VERIFIED_BY_ADAPTER' as const,
    };
    const first = await applyVerifiedPaymentEvent(event);
    const second = await applyVerifiedPaymentEvent(event);
    expect(first.processingStatus).toBe('PROCESSED');
    expect(second.processingStatus).toBe('DUPLICATE');
    await expect(
      fixture.adminPool.query<{ count: number }>(
        `SELECT count(*)::int AS count
           FROM payment_provider_events
          WHERE provider = 'MOMO' AND event_key = 'audit-event-momo-duplicate'`,
      ),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });
});
