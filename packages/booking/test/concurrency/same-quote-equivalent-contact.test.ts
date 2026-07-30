import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConcurrencyFixture } from './concurrency-fixtures.js';
import {
  bookingInput,
  bookingState,
  createConcurrencyFixture,
  createSqlBarrier,
  equivalentContacts,
  requiredValue,
  runCaller,
  seedScenario,
} from './concurrency-fixtures.js';

const quoteLockQuery = (statement: string) => /FROM\s+"quotes".*FOR UPDATE/is.test(statement);

describe('same quote with equivalent normalized contact', () => {
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

  it('returns one booking identity and one complete persisted write set', async () => {
    const [contactOne, contactTwo] = equivalentContacts();
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
    const results = await Promise.all([first, second]);

    expect(results[0].bookingId).toBe(results[1].bookingId);
    expect(results.some((result) => result.idempotent)).toBe(true);
    expect(results.every((result) => result.status === 'HOLD')).toBe(true);
    expect(await bookingState(fixture.adminPool, scenario.propertyId)).toEqual({
      bookings: 1,
      contacts: 1,
      blocks: 1,
      audits: 1,
      outbox: 1,
    });
  });
});
