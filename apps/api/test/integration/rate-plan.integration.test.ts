import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { AuditRepository } from '../../src/catalog/audit.repository.js';
import { CatalogConflictError } from '../../src/catalog/catalog.errors.js';
import type { ActorContext } from '../../src/auth/actor-context.js';
import { RatePlanRepository } from '../../src/pricing/rate-plan.repository.js';
import { RatePlanService } from '../../src/pricing/rate-plan.service.js';
const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440200',
  email: 'admin@example.test',
  displayName: 'Admin',
  role: 'ADMIN',
  permissions: ['pricing.rate_plan.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440201',
  sessionExpiresAt: new Date('2028-01-01T00:00:00.000Z'),
  requestId: 'rate-plan',
  propertyIds: ['550e8400-e29b-41d4-a716-446655440210'],
};
const ids = {
  property: '550e8400-e29b-41d4-a716-446655440210',
  tier: '550e8400-e29b-41d4-a716-446655440220',
  type: '550e8400-e29b-41d4-a716-446655440230',
  threeHour: '550e8400-e29b-41d4-a716-446655440240',
  fiveHour: '550e8400-e29b-41d4-a716-446655440241',
  lunch: '550e8400-e29b-41d4-a716-446655440242',
  night: '550e8400-e29b-41d4-a716-446655440243',
  day: '550e8400-e29b-41d4-a716-446655440244',
  extra: '550e8400-e29b-41d4-a716-446655440245',
};

async function seedRatePlans(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,
                              is_base_plan,min_check_in_minute_inclusive,max_check_in_minute_exclusive,
                              min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'THREE_HOUR_COMBO','Three hours','ACTIVE',180,10, true, NULL, NULL, 60, 240)`,
    [ids.threeHour, ids.property],
  );
  await database.pool.query(
    `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,
                              is_base_plan,min_check_in_minute_inclusive,max_check_in_minute_exclusive,
                              min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'FIVE_HOUR_COMBO','Five hours','ACTIVE',300,20, true, NULL, NULL, 255, 960)`,
    [ids.fiveHour, ids.property],
  );
  await database.pool.query(
    `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,
                              is_base_plan,min_check_in_minute_inclusive,max_check_in_minute_exclusive,
                              min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'LUNCH_COMBO','Lunch','ACTIVE',180,30, true, 660, 900, 60, 960)`,
    [ids.lunch, ids.property],
  );
  await database.pool.query(
    `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,
                              is_base_plan,min_check_in_minute_inclusive,max_check_in_minute_exclusive,
                              min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'NIGHT_COMBO','Night','ACTIVE',300,40, true, 1080, 1440, 315, 960)`,
    [ids.night, ids.property],
  );
  await database.pool.query(
    `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,
                              is_base_plan,min_check_in_minute_inclusive,max_check_in_minute_exclusive,
                              min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'DAY_COMBO','Day','ACTIVE',1440,50, true, NULL, NULL, 975, 1440)`,
    [ids.day, ids.property],
  );
  await database.pool.query(
    `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,
                              is_base_plan,min_check_in_minute_inclusive,max_check_in_minute_exclusive,
                              min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'EXTRA_HOUR','Extra hour','ACTIVE',60,0, false, NULL, NULL, NULL, NULL)`,
    [ids.extra, ids.property],
  );
}

describe('rate plan administration transaction', () => {
  let database: GuardedTestDatabase;
  let service: RatePlanService;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    service = new RatePlanService(client, new RatePlanRepository(client), new AuditRepository());
    await database.pool.query(
      `INSERT INTO properties (id,code,name,timezone) VALUES ($1,'MAIN','Main','Asia/Ho_Chi_Minh')`,
      [ids.property],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES ($1,$2,'TIER_1','Tier',1)`,
      [ids.tier, ids.property],
    );
    await database.pool.query(
      `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy) VALUES ($1,$2,$3,'DLX','Deluxe',2,0,2)`,
      [ids.type, ids.property, ids.tier],
    );
    await seedRatePlans(database);
    await database.pool.query(
      `INSERT INTO rate_plan_prices (property_id, rate_plan_id, price_tier_id, amount_vnd)
         VALUES ($1, $2, $3, 100000),
                ($1, $4, $3, 100000),
                ($1, $5, $3, 100000),
                ($1, $6, $3, 100000),
                ($1, $7, $3, 100000)`,
      [ids.property, ids.fiveHour, ids.tier, ids.lunch, ids.night, ids.day, ids.extra],
    );
  });
  afterAll(async () => database?.dispose());
  it('rejects incomplete activation, then activates after an audited price update', async () => {
    await expect(service.activate(actor, ids.threeHour, { activate: true })).rejects.toBeInstanceOf(
      CatalogConflictError,
    );
    await service.updatePrice(actor, ids.threeHour, ids.tier, { amountVnd: 359000 });
    await expect(service.activate(actor, ids.threeHour, { activate: true })).resolves.toMatchObject(
      {
        status: 'ACTIVE',
      },
    );
    const audit = await database.pool.query<{ event_type: string }>(
      `SELECT event_type FROM audit_events ORDER BY occurred_at`,
    );
    expect(audit.rows.map((row) => row.event_type)).toEqual([
      'RATE_PLAN_PRICE_UPDATED',
      'RATE_PLAN_ACTIVATED',
    ]);
  });
  it('updates a selection rule and validates the tentative rule set', async () => {
    const result = await service.updateSelectionRule(actor, ids.lunch, {
      maxCheckInMinuteExclusive: 915,
    });
    expect(result.maxCheckInMinuteExclusive).toBe(915);
  });
  it('rejects a selection rule that produces an invalid duration range', async () => {
    // Three-hour/five-hour/lunch/night/day cover durations 60..1440
    // in overlapping bands. The pricing rule validator rejects any
    // base plan whose `minDurationMinutesInclusive` exceeds
    // `maxDurationMinutesInclusive`, so attempt an inverted range and
    // expect a CatalogConflictError. (Pre-Phase-8B.1 this test asserted
    // a different invariant that became unreachable once extra flex
    // plans and unrestricted-window base plans were introduced.)
    await expect(
      service.updateSelectionRule(actor, ids.lunch, {
        minDurationMinutesInclusive: 240,
        maxDurationMinutesInclusive: 60,
      }),
    ).rejects.toBeInstanceOf(CatalogConflictError);
  });
});
