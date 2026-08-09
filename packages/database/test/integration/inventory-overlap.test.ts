import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardedTestDatabase } from '../../src/testing.js';
import {
  createMigratedTestDatabase,
  IDS,
  insertBooking,
  insertCatalogFixture,
  postgresErrorCode,
} from './helpers.js';

describe('unified room inventory blocks', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
    await insertCatalogFixture(database.pool);
    await insertBooking(database.pool);
    await database.pool.query(
      `INSERT INTO maintenance_blocks
         (id, property_id, room_id, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, '2027-02-01T00:00:00Z', '2027-02-01T02:00:00Z', 'Planned test maintenance')`,
      [IDS.maintenance, IDS.property, IDS.otherRoom],
    );
  });

  afterAll(async () => {
    await database.dispose();
  });

  it('enforces source shape and permits adjacent half-open intervals', async () => {
    await database.pool.query(
      `INSERT INTO room_inventory_blocks
         (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
       VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', '2027-01-10T04:00:00Z', '2027-01-10T07:00:00Z')`,
      [IDS.property, IDS.room, IDS.booking],
    );
    await database.pool
      .query(
        `INSERT INTO room_inventory_blocks
         (property_id, room_id, block_type, status, starts_at, ends_at)
       VALUES ($1, $2, 'BOOKING', 'ACTIVE', '2027-01-10T07:00:00Z', '2027-01-10T08:00:00Z')`,
        [IDS.property, IDS.room],
      )
      .then(
        () => {
          throw new Error(
            'expected source shape check to reject a BOOKING block without booking_id',
          );
        },
        (error: unknown) => expect(postgresErrorCode(error)).toBe('23514'),
      );

    await database.pool.query(
      `INSERT INTO room_inventory_blocks
         (property_id, room_id, maintenance_block_id, block_type, status, starts_at, ends_at)
       VALUES ($1, $2, $3, 'MAINTENANCE', 'ACTIVE', '2027-02-01T00:00:00Z', '2027-02-01T02:00:00Z')`,
      [IDS.property, IDS.otherRoom, IDS.maintenance],
    );

    const adjacentBooking = randomUUID();
    await insertBooking(database.pool, {
      id: adjacentBooking,
      checkIn: '2027-01-10T07:00:00Z',
      checkOut: '2027-01-10T08:00:00Z',
    });
    await expect(
      database.pool.query(
        `INSERT INTO room_inventory_blocks
           (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
         VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', '2027-01-10T07:00:00Z', '2027-01-10T08:00:00Z')`,
        [IDS.property, IDS.room, adjacentBooking],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('rejects overlapping ACTIVE intervals but permits overlap after release', async () => {
    const overlappingBooking = randomUUID();
    await insertBooking(database.pool, {
      id: overlappingBooking,
      checkIn: '2027-01-10T06:45:00Z',
      checkOut: '2027-01-10T07:45:00Z',
    });
    const overlap = await database.pool
      .query(
        `INSERT INTO room_inventory_blocks
           (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
         VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', '2027-01-10T06:45:00Z', '2027-01-10T07:45:00Z')`,
        [IDS.property, IDS.room, overlappingBooking],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(overlap)).toBe('23P01');

    await expect(
      database.pool.query(
        `INSERT INTO room_inventory_blocks
           (property_id, room_id, booking_id, block_type, status, starts_at, ends_at, released_at)
         VALUES ($1, $2, $3, 'BOOKING', 'RELEASED',
                 '2027-01-10T06:45:00Z', '2027-01-10T07:45:00Z', CURRENT_TIMESTAMP)`,
        [IDS.property, IDS.room, overlappingBooking],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('serializes a real two-connection overlap race so only one allocation commits', async () => {
    const bookingOne = randomUUID();
    const bookingTwo = randomUUID();
    await insertBooking(database.pool, {
      id: bookingOne,
      roomId: IDS.otherRoom,
      checkIn: '2027-03-01T04:00:00Z',
      checkOut: '2027-03-01T06:00:00Z',
    });
    await insertBooking(database.pool, {
      id: bookingTwo,
      roomId: IDS.otherRoom,
      checkIn: '2027-03-01T05:00:00Z',
      checkOut: '2027-03-01T07:00:00Z',
    });

    const first = await database.openClient();
    const second = await database.openClient();
    try {
      await first.query('BEGIN');
      await second.query('BEGIN');
      await first.query(
        `INSERT INTO room_inventory_blocks
           (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
         VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', '2027-03-01T04:00:00Z', '2027-03-01T06:00:00Z')`,
        [IDS.property, IDS.otherRoom, bookingOne],
      );

      const losingInsert = second
        .query(
          `INSERT INTO room_inventory_blocks
             (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
           VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', '2027-03-01T05:00:00Z', '2027-03-01T07:00:00Z')`,
          [IDS.property, IDS.otherRoom, bookingTwo],
        )
        .catch((error: unknown) => error);
      await setTimeout(50);
      await first.query('COMMIT');

      const raceError = await losingInsert;
      expect(postgresErrorCode(raceError)).toBe('23P01');
      await second.query('ROLLBACK');
    } finally {
      first.release();
      second.release();
    }
  });
});
