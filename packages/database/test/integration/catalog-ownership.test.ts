import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardedTestDatabase } from '../../src/testing.js';
import {
  createMigratedTestDatabase,
  IDS,
  insertCatalogFixture,
  postgresErrorCode,
} from './helpers.js';

describe('catalog property ownership and restrictive deletion', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
    await insertCatalogFixture(database.pool);
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
       VALUES ($1, 'OTHER_PROPERTY', 'Other Property', 'Asia/Ho_Chi_Minh')`,
      [IDS.otherProperty],
    );
    await database.pool.query(
      `INSERT INTO amenities (id, property_id, code, name)
       VALUES ($1, $2, 'WIFI', 'Wi-Fi')`,
      [IDS.amenity, IDS.property],
    );
  });

  afterAll(async () => {
    await database.dispose();
  });

  it('rejects cross-property room type, room and amenity relationships', async () => {
    const roomTypeError = await database.pool
      .query(
        `INSERT INTO room_types
           (property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
         VALUES ($1, $2, 'BAD_TYPE', 'Bad type', 2, 0, 2)`,
        [IDS.otherProperty, IDS.tier],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(roomTypeError)).toBe('23503');

    const roomError = await database.pool
      .query(
        `INSERT INTO rooms (property_id, room_type_id, room_number)
         VALUES ($1, $2, 'BAD-101')`,
        [IDS.otherProperty, IDS.roomType],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(roomError)).toBe('23503');

    const mappingError = await database.pool
      .query(
        `INSERT INTO room_type_amenities (property_id, room_type_id, amenity_id)
         VALUES ($1, $2, $3)`,
        [IDS.otherProperty, IDS.roomType, IDS.amenity],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(mappingError)).toBe('23503');
  });

  it('uses restrictive foreign keys instead of deleting dependent catalog rows', async () => {
    const error = await database.pool
      .query(`DELETE FROM properties WHERE id = $1`, [IDS.property])
      .catch((cause: unknown) => cause);

    expect(postgresErrorCode(error)).toBe('23001');
    await expect(
      database.pool.query(`SELECT count(*)::int AS count FROM properties WHERE id = $1`, [
        IDS.property,
      ]),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });
});
