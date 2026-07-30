import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardedTestDatabase } from '../../src/testing.js';
import {
  createMigratedTestDatabase,
  IDS,
  insertCatalogFixture,
  postgresErrorCode,
} from './helpers.js';

describe('pricing catalog invariants', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
    await insertCatalogFixture(database.pool);
    await database.pool.query(
      `INSERT INTO rate_plans
         (id, property_id, code, name, status, included_duration_minutes, priority,
          is_base_plan, min_check_in_minute_inclusive, max_check_in_minute_exclusive,
          min_duration_minutes_inclusive, max_duration_minutes_inclusive)
       VALUES ($1, $2, 'LUNCH_COMBO', 'Lunch combo', 'ACTIVE', 180, 80,
               true, 660, 900, 60, 960)`,
      [IDS.ratePlan, IDS.property],
    );
  });

  afterAll(async () => {
    await database.dispose();
  });

  it('stores exact integer VND amounts once per plan and tier', async () => {
    await database.pool.query(
      `INSERT INTO rate_plan_prices
         (property_id, rate_plan_id, price_tier_id, amount_vnd, currency)
       VALUES ($1, $2, $3, 359000, 'VND')`,
      [IDS.property, IDS.ratePlan, IDS.tier],
    );

    const amount = await database.pool.query<{ amount_vnd: string }>(
      `SELECT amount_vnd FROM rate_plan_prices WHERE rate_plan_id = $1`,
      [IDS.ratePlan],
    );
    expect(amount.rows).toEqual([{ amount_vnd: '359000' }]);

    const duplicate = await database.pool
      .query(
        `INSERT INTO rate_plan_prices
           (property_id, rate_plan_id, price_tier_id, amount_vnd, currency)
         VALUES ($1, $2, $3, 419000, 'VND')`,
        [IDS.property, IDS.ratePlan, IDS.tier],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(duplicate)).toBe('23505');
  });

  it('rejects non-positive money, non-VND currency and cross-property references', async () => {
    for (const [amount, currency] of [
      ['0', 'VND'],
      ['359000', 'USD'],
    ] as const) {
      const error = await database.pool
        .query(
          `INSERT INTO rate_plan_prices
             (property_id, rate_plan_id, price_tier_id, amount_vnd, currency)
           VALUES ($1, $2, $3, $4, $5)`,
          [IDS.property, IDS.ratePlan, IDS.tier, amount, currency],
        )
        .catch((cause: unknown) => cause);
      expect(postgresErrorCode(error)).toBe('23514');
    }

    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
       VALUES ($1, 'OTHER_FOR_PRICE', 'Other for price', 'Asia/Ho_Chi_Minh')`,
      [IDS.otherProperty],
    );
    const secondTier = randomUUID();
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
       VALUES ($1, $2, 'TIER_SECOND', 'Second tier', 2)`,
      [secondTier, IDS.property],
    );
    const mismatch = await database.pool
      .query(
        `INSERT INTO rate_plan_prices
           (property_id, rate_plan_id, price_tier_id, amount_vnd, currency)
         VALUES ($1, $2, $3, 359000, 'VND')`,
        [IDS.otherProperty, IDS.ratePlan, secondTier],
      )
      .catch((error: unknown) => error);
    expect(postgresErrorCode(mismatch)).toBe('23503');
  });
});
