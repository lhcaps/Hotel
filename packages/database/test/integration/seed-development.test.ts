import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedDevelopmentData } from '../../src/seed-development.js';
import type { GuardedTestDatabase } from '../../src/testing.js';
import { createMigratedTestDatabase } from './helpers.js';

describe('guarded deterministic development seed', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
  });

  afterAll(async () => {
    await database.dispose();
  });

  it('refuses to run outside development', async () => {
    await expect(
      seedDevelopmentData(database.databaseUrl, { environment: 'production' }),
    ).rejects.toThrow(/development environment/i);
  });

  it('is idempotent and creates the deterministic non-PII UAT catalog and lifecycle fixtures', async () => {
    await seedDevelopmentData(database.databaseUrl, { environment: 'development' });
    await seedDevelopmentData(database.databaseUrl, { environment: 'development' });

    const counts = await database.pool.query<{
      properties: number;
      tiers: number;
      room_types: number;
      rooms: number;
      amenities: number;
      amenity_mappings: number;
      rate_plans: number;
      users: number;
      bookings: number;
      payments: number;
      maintenance_blocks: number;
      inventory_blocks: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM properties) AS properties,
         (SELECT count(*)::int FROM price_tiers) AS tiers,
         (SELECT count(*)::int FROM room_types) AS room_types,
         (SELECT count(*)::int FROM rooms) AS rooms,
         (SELECT count(*)::int FROM amenities) AS amenities,
         (SELECT count(*)::int FROM room_type_amenities) AS amenity_mappings,
         (SELECT count(*)::int FROM rate_plans) AS rate_plans,
         (SELECT count(*)::int FROM users) AS users,
         (SELECT count(*)::int FROM bookings) AS bookings,
         (SELECT count(*)::int FROM payments) AS payments,
         (SELECT count(*)::int FROM maintenance_blocks) AS maintenance_blocks,
         (SELECT count(*)::int FROM room_inventory_blocks) AS inventory_blocks`,
    );
    expect(counts.rows[0]).toEqual({
      properties: 1,
      tiers: 3,
      room_types: 3,
      rooms: 6,
      amenities: 3,
      amenity_mappings: 9,
      rate_plans: 8,
      users: 2,
      bookings: 5,
      payments: 3,
      maintenance_blocks: 1,
      inventory_blocks: 6,
    });

    const plans = await database.pool.query<{
      code: string;
      status: string;
      prices: Record<string, number> | null;
    }>(
      `SELECT rp.code, rp.status,
              jsonb_object_agg(pt.code, rpp.amount_vnd ORDER BY pt.code)
                FILTER (WHERE pt.id IS NOT NULL) AS prices
         FROM rate_plans rp
         LEFT JOIN rate_plan_prices rpp ON rpp.rate_plan_id = rp.id
         LEFT JOIN price_tiers pt ON pt.id = rpp.price_tier_id
        GROUP BY rp.id
        ORDER BY rp.code`,
    );
    const lunch = plans.rows.find((plan) => plan.code === 'LUNCH_COMBO');
    expect(lunch).toEqual({
      code: 'LUNCH_COMBO',
      status: 'ACTIVE',
      prices: { DELUXE: 419000, SIGNATURE: 489000, STANDARD: 359000 },
    });
    expect(
      Object.fromEntries(
        plans.rows
          .filter((plan) =>
            new Set([
              'THREE_HOUR_COMBO',
              'FIVE_HOUR_COMBO',
              'LUNCH_COMBO',
              'NIGHT_COMBO',
              'DAY_COMBO',
              'EXTRA_HOUR',
            ]).has(plan.code),
          )
          .map((plan) => [plan.code, plan.prices]),
      ),
    ).toEqual({
      THREE_HOUR_COMBO: { DELUXE: 349000, SIGNATURE: 399000, STANDARD: 299000 },
      FIVE_HOUR_COMBO: { DELUXE: 469000, SIGNATURE: 549000, STANDARD: 399000 },
      LUNCH_COMBO: { DELUXE: 419000, SIGNATURE: 489000, STANDARD: 359000 },
      NIGHT_COMBO: { DELUXE: 589000, SIGNATURE: 689000, STANDARD: 499000 },
      DAY_COMBO: { DELUXE: 879000, SIGNATURE: 1029000, STANDARD: 749000 },
      EXTRA_HOUR: { DELUXE: 95000, SIGNATURE: 110000, STANDARD: 80000 },
    });
    const signature = await database.pool.query<{
      max_occupancy: number;
    }>(
      `SELECT rt.max_occupancy
         FROM room_types rt
         JOIN price_tiers pt ON pt.id = rt.price_tier_id
        WHERE pt.code = 'SIGNATURE'`,
    );
    expect(signature.rows).toEqual([{ max_occupancy: 5 }]);
    const providers = await database.pool.query<{
      provider: string;
      enabled: boolean;
      display_name: string;
      display_order: number;
      checkout_expiry_minutes: number;
    }>(
      `SELECT pps.provider, pps.enabled, pps.display_name, pps.display_order,
              pps.checkout_expiry_minutes
         FROM payment_provider_settings pps
         JOIN properties p ON p.id = pps.property_id
        WHERE p.id = $1
        ORDER BY pps.display_order`,
      ['10000000-0000-4000-8000-000000000001'],
    );
    expect(providers.rows).toEqual([
      {
        provider: 'MOMO',
        enabled: false,
        display_name: 'MoMo Demo',
        display_order: 10,
        checkout_expiry_minutes: 15,
      },
      {
        provider: 'VNPAY',
        enabled: false,
        display_name: 'VNPAY Demo',
        display_order: 20,
        checkout_expiry_minutes: 15,
      },
    ]);
    const publicPlanCodes = new Set([
      'THREE_HOUR_COMBO',
      'FIVE_HOUR_COMBO',
      'LUNCH_COMBO',
      'NIGHT_COMBO',
      'DAY_COMBO',
      'EXTRA_HOUR',
    ]);
    const publicPlans = plans.rows.filter((plan) => publicPlanCodes.has(plan.code));
    expect(publicPlans).toHaveLength(6);
    expect(publicPlans.every((plan) => plan.status === 'ACTIVE')).toBe(true);
    expect(publicPlans.every((plan) => plan.prices !== null)).toBe(true);
    const flexPlans = plans.rows.filter((plan) =>
      new Set(['SIX_HOUR_FLEX', 'FOUR_HOUR_FLEX']).has(plan.code),
    );
    expect(flexPlans).toHaveLength(2);
    expect(flexPlans.every((plan) => plan.status === 'DRAFT')).toBe(true);
    expect(flexPlans.every((plan) => plan.prices !== null)).toBe(true);
  });
});
