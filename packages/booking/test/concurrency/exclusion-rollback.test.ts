import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConcurrencyFixture } from './concurrency-fixtures.js';
import {
  bookingInput,
  bookingState,
  createConcurrencyFixture,
  normalizedContact,
  postgresCause,
  quoteBookingState,
  requiredValue,
  runCaller,
  seedScenario,
} from './concurrency-fixtures.js';

describe('real GiST exclusion rollback', () => {
  let fixture: ConcurrencyFixture;
  const statements: string[] = [];

  beforeAll(async () => {
    fixture = await createConcurrencyFixture({ statements: [statements, undefined] });
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('rolls back every attributable write and does not continue an aborted transaction', async () => {
    const contact = normalizedContact('exclusion-one');
    const scenario = await seedScenario({
      pool: fixture.adminPool,
      roomCount: 1,
      quoteCount: 1,
      contact,
    });
    const conflictingBookingId = randomUUID();
    await fixture.adminPool.query(
      `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out,
        adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
        pricing_rule_version, price_snapshot, hold_expires_at)
       VALUES ($1, $2, $3, $4, $5, 'HOLD', '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z',
               1, 0, 'VND', 1, 0, 1, 'task4-test', '{"task4":true}', CURRENT_TIMESTAMP + interval '15 minutes')`,
      [
        conflictingBookingId,
        scenario.propertyId,
        scenario.roomTypeId,
        scenario.roomIds[0],
        `TASK4-${conflictingBookingId}`,
      ],
    );
    await fixture.adminPool.query(
      `INSERT INTO room_inventory_blocks
       (property_id, room_id, booking_id, block_type, status, starts_at, ends_at, released_at)
       VALUES ($1, $2, $3, 'BOOKING', 'RELEASED', '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z', CURRENT_TIMESTAMP)`,
      [scenario.propertyId, scenario.roomIds[0], conflictingBookingId],
    );
    await fixture.adminPool.query(
      `CREATE FUNCTION task4_force_real_exclusion() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         UPDATE room_inventory_blocks SET status = 'ACTIVE', released_at = NULL
          WHERE booking_id = '${conflictingBookingId}'::uuid;
         RETURN NEW;
       END $$`,
    );
    await fixture.adminPool.query(
      `CREATE TRIGGER task4_force_real_exclusion_trigger BEFORE INSERT ON room_inventory_blocks
       FOR EACH ROW EXECUTE FUNCTION task4_force_real_exclusion()`,
    );

    statements.length = 0;
    const error = await runCaller(
      fixture.callers[0],
      bookingInput(requiredValue(scenario.quoteIds, 0, 'quote'), contact),
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'ALLOCATION_BUSY' });
    expect(postgresCause(error)).toMatchObject({
      code: '23P01',
      constraint: 'room_inventory_blocks_active_overlap_excl',
    });
    expect(
      await quoteBookingState(fixture.adminPool, requiredValue(scenario.quoteIds, 0, 'quote')),
    ).toEqual({
      bookings: 0,
      contacts: 0,
      blocks: 0,
      audits: 0,
      outbox: 0,
    });
    const attemptedInsert = statements.findIndex((statement) =>
      /^insert into "room_inventory_blocks"/i.test(statement),
    );
    expect(attemptedInsert).toBeGreaterThanOrEqual(0);
    expect(
      statements.slice(attemptedInsert + 1).map((statement) => statement.toUpperCase()),
    ).toEqual(['ROLLBACK']);
    expect(
      statements.filter((statement) => /^insert into "bookings"/i.test(statement)),
    ).toHaveLength(1);

    await fixture.adminPool.query(
      'DROP TRIGGER task4_force_real_exclusion_trigger ON room_inventory_blocks',
    );
    await fixture.adminPool.query('DROP FUNCTION task4_force_real_exclusion()');
    const result = await runCaller(
      fixture.callers[1],
      bookingInput(requiredValue(scenario.quoteIds, 0, 'quote'), contact),
    );
    expect(result.idempotent).toBe(false);
    expect(await bookingState(fixture.adminPool, scenario.propertyId)).toEqual({
      bookings: 2,
      contacts: 1,
      blocks: 1,
      audits: 1,
      outbox: 1,
    });
  });
});
