import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConcurrencyFixture } from './concurrency-fixtures.js';
import {
  activeOverlapCount,
  bookingInput,
  bookingState,
  createConcurrencyFixture,
  createSqlBarrier,
  normalizedContact,
  requiredValue,
  runCaller,
  seedScenario,
} from './concurrency-fixtures.js';

const allocationQuery = (statement: string) =>
  /FROM\s+"rooms".*FOR UPDATE SKIP LOCKED/is.test(statement);

describe('last room allocation race', () => {
  let fixture: ConcurrencyFixture;
  let barrier: ReturnType<typeof createSqlBarrier>;

  beforeAll(async () => {
    barrier = createSqlBarrier(1);
    fixture = await createConcurrencyFixture({
      barriers: [{ matches: allocationQuery, value: barrier, phase: 'after' }, undefined],
    });
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('allows exactly one winner and classifies the loser before and after commit', async () => {
    const contactOne = normalizedContact('last-one');
    const contactTwo = normalizedContact('last-two');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 1,
      quoteCount: 2,
      contact: contactOne,
    });
    const firstQuoteId = requiredValue(scenario.quoteIds, 0, 'first quote');
    const secondQuoteId = requiredValue(scenario.quoteIds, 1, 'second quote');
    const first = runCaller(fixture.callers[0], bookingInput(firstQuoteId, contactOne));
    await barrier.reached;
    const busyError = await runCaller(
      fixture.callers[1],
      bookingInput(secondQuoteId, contactTwo),
    ).catch((caught: unknown) => caught);
    expect(busyError).toMatchObject({ code: 'ALLOCATION_BUSY' });
    barrier.release();
    const winner = await first;
    expect(winner.idempotent).toBe(false);
    expect(await bookingState(fixture.adminPool, scenario.propertyId)).toEqual({
      bookings: 1,
      contacts: 1,
      blocks: 1,
      audits: 1,
      outbox: 1,
    });
    expect(await activeOverlapCount(fixture.adminPool, scenario.propertyId)).toBe(0);

    await expect(
      runCaller(fixture.callers[1], bookingInput(secondQuoteId, contactTwo)),
    ).rejects.toMatchObject({ code: 'ROOM_TYPE_UNAVAILABLE' });
    expect(await bookingState(fixture.adminPool, scenario.propertyId)).toEqual({
      bookings: 1,
      contacts: 1,
      blocks: 1,
      audits: 1,
      outbox: 1,
    });
  });
});
