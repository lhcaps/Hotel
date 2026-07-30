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
  runCaller,
  seedScenario,
  type ConcurrencyFixture,
} from './concurrency-fixtures.js';

describe('payment provider-event concurrency', () => {
  let fixture: ConcurrencyFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('processes one of two concurrent identical verified events and classifies the other as duplicate', async () => {
    fixture = await createConcurrencyFixture();
    const contact = normalizedContact('payment-event-race');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 1,
      quoteCount: 1,
      contact,
    });
    const firstCaller = fixture.callers.at(0);
    const secondCaller = fixture.callers.at(1);
    const quoteId = scenario.quoteIds.at(0);

    if (firstCaller === undefined || secondCaller === undefined || quoteId === undefined) {
      throw new Error('Payment event race fixture requires two callers and one quote.');
    }

    const booking = await runCaller(firstCaller, bookingInput(quoteId, contact));
    const attempt = await createPaymentAttempt({
      pool: firstCaller.pool,
      propertyId: scenario.propertyId,
      bookingId: booking.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'concurrent-event-attempt',
      now: new Date(),
    });
    const event = {
      provider: 'MOMO' as const,
      eventKey: 'concurrent-event-key',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'momo-concurrent-transaction',
      normalizedOutcome: 'SUCCEEDED' as const,
      amountVnd: attempt.amountVnd,
      currency: 'VND' as const,
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 17),
      verificationMarker: 'VERIFIED_BY_ADAPTER' as const,
    };

    const results = await Promise.all([
      applyVerifiedPaymentEvent({ ...event, pool: firstCaller.pool }),
      applyVerifiedPaymentEvent({ ...event, pool: secondCaller.pool }),
    ]);

    expect(results.map((result) => result.processingStatus).sort()).toEqual([
      'DUPLICATE',
      'PROCESSED',
    ]);
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
});
