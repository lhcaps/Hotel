import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';

import { AuditRepository } from '../../src/catalog/audit.repository.js';
import type { ActorContext } from '../../src/auth/actor-context.js';
import { RatePlanRepository } from '../../src/pricing/rate-plan.repository.js';
import { RatePlanService } from '../../src/pricing/rate-plan.service.js';

const adminActor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440300',
  email: 'admin.earlybird@example.test',
  displayName: 'Admin EarlyBird',
  role: 'ADMIN',
  permissions: ['pricing.rate_plan.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440301',
  sessionExpiresAt: new Date('2028-01-01T00:00:00.000Z'),
  requestId: 'early-bird-flex-admin-creation',
  propertyIds: ['550e8400-e29b-41d4-a716-446655440310'],
};

const customerActor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440302',
  email: 'customer@example.test',
  displayName: 'Customer',
  role: 'CUSTOMER',
  permissions: [],
  sessionId: '550e8400-e29b-41d4-a716-446655440303',
  sessionExpiresAt: new Date('2028-01-01T00:00:00.000Z'),
  requestId: 'early-bird-flex-customer-attempt',
};

const ids = {
  property: '550e8400-e29b-41d4-a716-446655440310',
  tier: '550e8400-e29b-41d4-a716-446655440320',
  type: '550e8400-e29b-41d4-a716-446655440330',
  room: '550e8400-e29b-41d4-a716-446655440340',
  threeHour: '550e8400-e29b-41d4-a716-446655440350',
  earlyBird: '',
};

const EARLY_BIRD_INCLUDED_DURATION_MINUTES = 180;
const EARLY_BIRD_MIN_CHECK_IN_MINUTE_INCLUSIVE = 360; // 06:00
const EARLY_BIRD_MAX_CHECK_IN_MINUTE_EXCLUSIVE = 660; // 11:00
const EARLY_BIRD_PRICE_VND = 200_000;

describe('Phase 8B.1 ADMIN generic rate-plan creation — EARLY_BIRD_FLEX', () => {
  let database: GuardedTestDatabase;
  let service: RatePlanService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) {
      throw new Error('TEST_DATABASE_URL is required for rate-plan integration tests');
    }
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    service = new RatePlanService(client, new RatePlanRepository(client), new AuditRepository());
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
       VALUES ($1, 'EB_PROPERTY', 'EarlyBird Property', 'Asia/Ho_Chi_Minh')`,
      [ids.property],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
       VALUES ($1, $2, 'EB_TIER', 'EB tier', 1)`,
      [ids.tier, ids.property],
    );
    await database.pool.query(
      `INSERT INTO room_types
         (id, property_id, price_tier_id, code, name,
          max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'EB_DELUXE', 'Deluxe', 2, 1, 3)`,
      [ids.type, ids.property, ids.tier],
    );
    await database.pool.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, status)
       VALUES ($1, $2, $3, 'EB-101', 'ACTIVE')`,
      [ids.room, ids.property, ids.type],
    );
    // THREE_HOUR_COMBO is seeded ACTIVE so EARLY_BIRD_FLEX can be the
    // deterministic alternative for the [06:00, 11:00) check-in window.
    await database.pool.query(
      `INSERT INTO rate_plans (id, property_id, code, name, status,
                                included_duration_minutes, priority, is_base_plan,
                                min_duration_minutes_inclusive, max_duration_minutes_inclusive)
       VALUES ($1, $2, 'THREE_HOUR_COMBO', 'Three hour combo', 'ACTIVE',
               180, 10, true, 60, 240)`,
      [ids.threeHour, ids.property],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id, property_id, rate_plan_id, price_tier_id, amount_vnd)
       VALUES ($1, $2, $3, $4, 300000)`,
      [randomUUID(), ids.property, ids.threeHour, ids.tier],
    );
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('creates EARLY_BIRD_FLEX through the ADMIN service as DRAFT with the required window', async () => {
    const created = await service.create(adminActor, {
      code: 'EARLY_BIRD_FLEX',
      name: 'Early bird flex',
      includedDurationMinutes: EARLY_BIRD_INCLUDED_DURATION_MINUTES,
      priority: 15,
      isBasePlan: true,
      minCheckInMinuteInclusive: EARLY_BIRD_MIN_CHECK_IN_MINUTE_INCLUSIVE,
      maxCheckInMinuteExclusive: EARLY_BIRD_MAX_CHECK_IN_MINUTE_EXCLUSIVE,
      minDurationMinutesInclusive: 60,
      maxDurationMinutesInclusive: 240,
    });
    expect(created).toMatchObject({
      code: 'EARLY_BIRD_FLEX',
      name: 'Early bird flex',
      status: 'DRAFT',
      isBasePlan: true,
      includedDurationMinutes: EARLY_BIRD_INCLUDED_DURATION_MINUTES,
      minCheckInMinuteInclusive: EARLY_BIRD_MIN_CHECK_IN_MINUTE_INCLUSIVE,
      maxCheckInMinuteExclusive: EARLY_BIRD_MAX_CHECK_IN_MINUTE_EXCLUSIVE,
    });
    expect(created.id).toBeDefined();
    ids.earlyBird = created.id;

    // The plan must be readable from the database after create.
    const row = await database.pool.query<{ code: string; status: string }>(
      `SELECT code, status FROM rate_plans WHERE id = $1`,
      [created.id],
    );
    expect(row.rows[0]?.code).toBe('EARLY_BIRD_FLEX');
    expect(row.rows[0]?.status).toBe('DRAFT');

    // The admin create event must be written to the immutable audit log
    // with no payload that could contain secrets or PII.
    const audit = await database.pool.query<{
      event_type: string;
      payload: Record<string, unknown>;
    }>(`SELECT event_type, payload FROM audit_events WHERE aggregate_id = $1`, [created.id]);
    const types = audit.rows.map((row) => row.event_type);
    expect(types).toContain('RATE_PLAN_CREATED');
  });

  it('rejects create payloads that violate the schema (invalid code)', async () => {
    await expect(
      service.create(adminActor, {
        code: 'invalid-lowercase',
        name: 'Bad plan',
        includedDurationMinutes: 180,
        priority: 0,
        isBasePlan: true,
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate-code insert with a catalog conflict', async () => {
    await expect(
      service.create(adminActor, {
        code: 'EARLY_BIRD_FLEX',
        name: 'Duplicate',
        includedDurationMinutes: 180,
        priority: 15,
        isBasePlan: true,
        minCheckInMinuteInclusive: EARLY_BIRD_MIN_CHECK_IN_MINUTE_INCLUSIVE,
        maxCheckInMinuteExclusive: EARLY_BIRD_MAX_CHECK_IN_MINUTE_EXCLUSIVE,
        minDurationMinutesInclusive: 60,
        maxDurationMinutesInclusive: 240,
      }),
    ).rejects.toThrow();
  });

  it('rejects activation until a price is configured for every active tier', async () => {
    await expect(service.activate(adminActor, ids.earlyBird, { activate: true })).rejects.toThrow();
  });

  it('sets the EARLY_BIRD_FLEX price at 200000 VND', async () => {
    await service.updatePrice(adminActor, ids.earlyBird, ids.tier, {
      amountVnd: EARLY_BIRD_PRICE_VND,
    });
    const row = await database.pool.query<{ amount_vnd: string }>(
      `SELECT amount_vnd FROM rate_plan_prices WHERE rate_plan_id = $1 AND price_tier_id = $2`,
      [ids.earlyBird, ids.tier],
    );
    expect(Number(row.rows[0]?.amount_vnd)).toBe(EARLY_BIRD_PRICE_VND);
  });

  it('price-only edit changes the EARLY_BIRD_FLEX price and emits an audit event', async () => {
    const before = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_events
        WHERE event_type = 'RATE_PLAN_PRICE_UPDATED'
          AND aggregate_id = $1`,
      [ids.earlyBird],
    );
    const beforeCount = Number(before.rows[0]?.count ?? '0');

    await service.updatePrice(adminActor, ids.earlyBird, ids.tier, { amountVnd: 210_000 });
    const row = await database.pool.query<{ amount_vnd: string }>(
      `SELECT amount_vnd FROM rate_plan_prices WHERE rate_plan_id = $1 AND price_tier_id = $2`,
      [ids.earlyBird, ids.tier],
    );
    expect(Number(row.rows[0]?.amount_vnd)).toBe(210_000);

    const after = await database.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_events
        WHERE event_type = 'RATE_PLAN_PRICE_UPDATED'
          AND aggregate_id = $1`,
      [ids.earlyBird],
    );
    expect(Number(after.rows[0]?.count ?? '0')).toBe(beforeCount + 1);

    // Restore the original price for any downstream invariants.
    await service.updatePrice(adminActor, ids.earlyBird, ids.tier, {
      amountVnd: EARLY_BIRD_PRICE_VND,
    });
  });

  it('CUSTOMER actor cannot create EARLY_BIRD_FLEX', async () => {
    await expect(
      service.create(customerActor, {
        code: 'CUSTOMER_FORGE',
        name: 'Forged',
        includedDurationMinutes: 180,
        priority: 15,
        isBasePlan: true,
      }),
    ).rejects.toThrow();
  });
});
