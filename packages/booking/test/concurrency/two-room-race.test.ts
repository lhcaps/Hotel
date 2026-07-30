import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConcurrencyFixture } from './concurrency-fixtures.js';
import {
  activeOverlapCount,
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

const allocationQuery = (statement: string) =>
  /FROM\s+"rooms".*FOR UPDATE SKIP LOCKED/is.test(statement);

describe('two room allocation race', () => {
  let fixture: ConcurrencyFixture;
  let barrier: ReturnType<typeof createSqlBarrier>;

  beforeAll(async () => {
    barrier = createSqlBarrier(2);
    fixture = await createConcurrencyFixture({
      barriers: [
        { matches: allocationQuery, value: barrier },
        { matches: allocationQuery, value: barrier },
      ],
    });
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('allocates distinct physical rooms to both concurrent callers', async () => {
    const contactOne = normalizedContact('rooms-one');
    const contactTwo = normalizedContact('rooms-two');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 2,
      quoteCount: 2,
      contact: contactOne,
    });
    const first = runCaller(
      fixture.callers[0],
      bookingInput(requiredValue(scenario.quoteIds, 0, 'first quote'), contactOne),
    );
    const second = runCaller(
      fixture.callers[1],
      bookingInput(requiredValue(scenario.quoteIds, 1, 'second quote'), contactTwo),
    );
    await barrier.reached;
    barrier.release();
    const results = await Promise.all([first, second]);

    expect(results[0].bookingId).not.toBe(results[1].bookingId);
    expect(results[0]).not.toHaveProperty('roomId');
    expect(results[1]).not.toHaveProperty('roomId');
    const allocations = await bookingAllocations(fixture.adminPool, scenario.propertyId);
    expect(new Set(allocations.map((row) => row.roomId)).size).toBe(2);
    expect(await bookingState(fixture.adminPool, scenario.propertyId)).toEqual({
      bookings: 2,
      contacts: 2,
      blocks: 2,
      audits: 2,
      outbox: 2,
    });
    expect(await activeOverlapCount(fixture.adminPool, scenario.propertyId)).toBe(0);
  });
});
