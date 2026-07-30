import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConcurrencyFixture } from './concurrency-fixtures.js';
import {
  bookingAllocations,
  bookingInput,
  bookingState,
  createConcurrencyFixture,
  createSqlBarrier,
  normalizedContact,
  requiredValue,
  runCaller,
  seedScenario,
} from './concurrency-fixtures.js';

const quoteLockQuery = (statement: string) => /FROM\s+"quotes".*FOR UPDATE/is.test(statement);

describe('same quote with different normalized contacts', () => {
  let fixture: ConcurrencyFixture;
  let barrier: ReturnType<typeof createSqlBarrier>;

  beforeAll(async () => {
    barrier = createSqlBarrier(2);
    fixture = await createConcurrencyFixture({
      barriers: [
        { matches: quoteLockQuery, value: barrier },
        { matches: quoteLockQuery, value: barrier },
      ],
    });
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('keeps the winning contact immutable and rejects quote reuse without PII disclosure', async () => {
    const contactOne = normalizedContact('quote-one');
    const contactTwo = normalizedContact('quote-two');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 2,
      quoteCount: 1,
      contact: contactOne,
    });
    const quoteId = requiredValue(scenario.quoteIds, 0, 'quote');
    const first = runCaller(fixture.callers[0], bookingInput(quoteId, contactOne));
    const second = runCaller(fixture.callers[1], bookingInput(quoteId, contactTwo));
    await barrier.reached;
    barrier.release();
    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<typeof first>> =>
        result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: 'QUOTE_ALREADY_USED' });
    const losingContact = results[0]?.status === 'rejected' ? contactOne : contactTwo;
    const winningContact = results[0]?.status === 'fulfilled' ? contactOne : contactTwo;
    expect(String(rejected[0]?.reason)).not.toContain(winningContact.email);
    expect(String(rejected[0]?.reason)).not.toContain(winningContact.phoneE164);
    const allocations = await bookingAllocations(fixture.adminPool, scenario.propertyId);
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toMatchObject({
      fullName: winningContact.fullName,
      email: winningContact.email,
      phone: winningContact.phoneE164,
    });
    expect(allocations[0]).not.toMatchObject({ email: losingContact.email });
    expect(await bookingState(fixture.adminPool, scenario.propertyId)).toEqual({
      bookings: 1,
      contacts: 1,
      blocks: 1,
      audits: 1,
      outbox: 1,
    });

    await fixture.adminPool.query(
      `UPDATE bookings SET status = 'CANCELLED', cancelled_at = now(), cancellation_reason = 'test-setup' WHERE id = $1`,
      [fulfilled[0]?.value.bookingId],
    );
    await expect(
      runCaller(
        fixture.callers[results[0]?.status === 'rejected' ? 0 : 1],
        bookingInput(quoteId, losingContact),
      ),
    ).rejects.toMatchObject({ code: 'QUOTE_ALREADY_USED' });
    expect(await bookingState(fixture.adminPool, scenario.propertyId)).toEqual({
      bookings: 1,
      contacts: 1,
      blocks: 1,
      audits: 1,
      outbox: 1,
    });
  });
});
