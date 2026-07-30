import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createMigratedTestDatabase,
  IDS,
  insertCatalogFixture,
  postgresErrorCode,
} from './helpers.js';

import type { GuardedTestDatabase } from '../../src/testing.js';

describe('immutable quote schema', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
    await insertCatalogFixture(database.pool);
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('stores a property-scoped quote with an immutable pricing snapshot', async () => {
    const inserted = await database.pool.query<{ id: string }>(
      `INSERT INTO quotes
         (property_id, room_type_id, check_in, check_out, adults, children,
          currency, base_amount_vnd, extra_amount_vnd, total_amount_vnd,
          pricing_snapshot, expires_at)
       VALUES ($1, $2, '2027-01-10T04:00:00.000Z', '2027-01-10T07:00:00.000Z', 1, 0,
               'VND', 359000, 0, 359000, $3::jsonb, CURRENT_TIMESTAMP + interval '15 minutes')
       RETURNING id`,
      [
        IDS.property,
        IDS.roomType,
        JSON.stringify({
          ruleVersion: 'phase-4-pricing-availability-v1',
          selectedPlanCode: 'LUNCH_COMBO',
          totalAmountVnd: 359000,
        }),
      ],
    );
    const quoteId = inserted.rows[0]?.id;
    expect(quoteId).toBeDefined();

    await expect(
      database.pool.query('UPDATE quotes SET total_amount_vnd = 1 WHERE id = $1', [quoteId]),
    ).rejects.toSatisfy((error: unknown) => postgresErrorCode(error) === 'P0001');
    await expect(
      database.pool.query('DELETE FROM quotes WHERE id = $1', [quoteId]),
    ).rejects.toSatisfy((error: unknown) => postgresErrorCode(error) === 'P0001');
  });

  it('enforces interval, amount and snapshot invariants without physical-room columns', async () => {
    await expect(
      database.pool.query(
        `INSERT INTO quotes
           (property_id, room_type_id, check_in, check_out, adults, children,
            currency, base_amount_vnd, extra_amount_vnd, total_amount_vnd,
            pricing_snapshot, expires_at)
         VALUES ($1, $2, '2027-01-10T04:07:00.000Z', '2027-01-10T05:07:00.000Z', 1, 0,
                 'VND', 359000, 0, 359000, '{}'::jsonb, CURRENT_TIMESTAMP + interval '15 minutes')`,
        [IDS.property, IDS.roomType],
      ),
    ).rejects.toSatisfy((error: unknown) => postgresErrorCode(error) === '23514');

    const physicalColumns = await database.pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'quotes'
        ORDER BY column_name`,
    );
    expect(physicalColumns.rows.map((column) => column.column_name)).not.toEqual(
      expect.arrayContaining(['room_id', 'room_number']),
    );
  });
});
