import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { AuditRepository } from '../../src/catalog/audit.repository.js';
import { CouponConflictError, CouponNotFoundError } from '../../src/coupons/coupon.errors.js';
import { CouponRepository } from '../../src/coupons/coupon.repository.js';
import { CouponService } from '../../src/coupons/coupon.service.js';

const ids = {
  property: '550e8400-e29b-41d4-a716-446655440110',
  tier: '550e8400-e29b-41d4-a716-446655440120',
  type: '550e8400-e29b-41d4-a716-446655440130',
  typeAlt: '550e8400-e29b-41d4-a716-446655440131',
};

const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['coupon.read', 'coupon.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'coupon-admin-integration',
  propertyIds: [ids.property],
};

async function seedCatalog(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO properties (id,code,name,timezone) VALUES ($1,'MAIN','Main','Asia/Ho_Chi_Minh')`,
    [ids.property],
  );
  await database.pool.query(
    `INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES ($1,$2,'TIER_1','Tier',1)`,
    [ids.tier, ids.property],
  );
  await database.pool.query(
    `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy) VALUES ($1,$2,$3,'DLX','Deluxe',2,1,3)`,
    [ids.type, ids.property, ids.tier],
  );
  await database.pool.query(
    `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy) VALUES ($1,$2,$3,'STD','Standard',2,0,2)`,
    [ids.typeAlt, ids.property, ids.tier],
  );
}

const validWindow = {
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2027-01-01T00:00:00.000Z',
};

function fixedInput(code: string): Record<string, unknown> {
  return {
    code,
    discountType: 'FIXED',
    fixedAmountVnd: 100_000,
    minimumOrderAmountVnd: 0,
    roomTypes: { all: true },
    ...validWindow,
  };
}

function percentInput(code: string): Record<string, unknown> {
  return {
    code,
    discountType: 'PERCENTAGE',
    percentageBasisPoints: 1500,
    maximumDiscountVnd: 50_000,
    minimumOrderAmountVnd: 200_000,
    roomTypes: { roomTypeIds: [ids.type] },
    ...validWindow,
  };
}

describe('ADMIN coupon service', () => {
  let database: GuardedTestDatabase;
  let coupons: CouponService;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    coupons = new CouponService(client, new CouponRepository(client), new AuditRepository());
    await seedCatalog(database);
  });
  afterAll(async () => database?.dispose());

  it('creates a fixed coupon with total and per-customer limits', async () => {
    const created = await coupons.createCoupon(actor, fixedInput('FIXED-001'));
    expect(created).toMatchObject({
      code: 'FIXED-001',
      status: 'ACTIVE',
      lifecycle: 'AVAILABLE',
      discountType: 'FIXED',
      fixedAmountVnd: 100_000,
      percentageBasisPoints: null,
      appliesToAllRoomTypes: true,
      totalUsageLimit: null,
      perCustomerLimit: null,
    });
    expect(created.disabledAt).toBeNull();
    const { rows } = await database.pool.query<{ event_type: string }>(
      `SELECT event_type FROM audit_events WHERE aggregate_id = $1 ORDER BY occurred_at`,
      [created.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.event_type).toBe('COUPON_CREATED');
  });

  it('creates a percentage coupon scoped to a specific room type', async () => {
    const created = await coupons.createCoupon(actor, percentInput('PERCENT-001'));
    expect(created).toMatchObject({
      discountType: 'PERCENTAGE',
      percentageBasisPoints: 1500,
      maximumDiscountVnd: 50_000,
      appliesToAllRoomTypes: false,
    });
    expect(created.roomTypeIds).toEqual([ids.type]);
  });

  it('rejects fixed-shape payload that also sets percentage fields', async () => {
    await expect(
      coupons.createCoupon(actor, {
        ...fixedInput('FIXED-002'),
        percentageBasisPoints: 500,
      }),
    ).rejects.toThrow();
  });

  it('rejects percentage-shape payload that also sets fixed fields', async () => {
    await expect(
      coupons.createCoupon(actor, {
        ...percentInput('PERCENT-002'),
        fixedAmountVnd: 100_000,
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid validity windows', async () => {
    await expect(
      coupons.createCoupon(actor, {
        ...fixedInput('FIXED-003'),
        validFrom: validWindow.validUntil,
        validUntil: validWindow.validFrom,
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid per-customer limits', async () => {
    await expect(
      coupons.createCoupon(actor, {
        ...fixedInput('FIXED-004'),
        perCustomerLimit: 0,
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown room-type scope', async () => {
    await expect(
      coupons.createCoupon(actor, {
        ...percentInput('PERCENT-003'),
        roomTypes: { roomTypeIds: ['00000000-0000-0000-0000-000000000099'] },
      }),
    ).rejects.toThrow();
  });

  it('returns a safe conflict when the property/code pair already exists', async () => {
    await coupons.createCoupon(actor, fixedInput('FIXED-CONFLICT'));
    await expect(coupons.createCoupon(actor, fixedInput('FIXED-CONFLICT'))).rejects.toBeInstanceOf(
      CouponConflictError,
    );
  });

  it('lists coupons deterministically with derived counts', async () => {
    const list = await coupons.listCoupons(actor, { page: 1, pageSize: 100 });
    expect(list.page).toBe(1);
    expect(list.pageSize).toBe(100);
    const codes = list.items.map((item) => item.code);
    expect(codes).toContain('FIXED-001');
    expect(codes).toContain('PERCENT-001');
    for (const item of list.items) {
      expect(item.counts.activeReservations).toEqual(expect.any(Number));
      expect(item.counts.redeemed).toEqual(expect.any(Number));
      expect(item.counts.released).toEqual(expect.any(Number));
    }
  });

  it('returns detail without leaking any customer digest', async () => {
    const list = await coupons.listCoupons(actor, { page: 1, pageSize: 100 });
    const target = list.items.find((item) => item.code === 'FIXED-001');
    expect(target).toBeDefined();
    if (target === undefined) return;
    const detail = await coupons.getCoupon(actor, target.id);
    expect(detail.code).toBe('FIXED-001');
    const serialised = JSON.stringify(detail);
    expect(serialised).not.toMatch(/customerEmailDigest/i);
    expect(serialised).not.toMatch(/bookingContact/i);
    expect(serialised).not.toMatch(/23505|23P01|constraint|sqlstate/i);
  });

  it('throws CouponNotFoundError when detail is unknown', async () => {
    await expect(
      coupons.getCoupon(actor, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(CouponNotFoundError);
  });

  it('disables an active coupon, audits the disable, and remains idempotent', async () => {
    const created = await coupons.createCoupon(actor, fixedInput('FIXED-DISABLE'));
    const first = await coupons.disableCoupon(actor, created.id);
    expect(first.status).toBe('DISABLED');
    expect(first.lifecycle).toBe('DISABLED');
    expect(first.disabledAt).not.toBeNull();
    const second = await coupons.disableCoupon(actor, created.id);
    expect(second.status).toBe('DISABLED');
    expect(second.disabledAt).toBe(first.disabledAt);
    const { rows } = await database.pool.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM audit_events WHERE aggregate_id = $1 AND event_type = 'COUPON_DISABLED'`,
      [created.id],
    );
    expect(rows[0]?.c).toBe(1);
  });

  it('rejects database attempts to re-enable a disabled coupon', async () => {
    const created = await coupons.createCoupon(actor, fixedInput('FIXED-LOCKED'));
    await coupons.disableCoupon(actor, created.id);
    await expect(
      database.pool.query(
        `UPDATE coupons SET status = 'ACTIVE', disabled_at = NULL WHERE id = $1`,
        [created.id],
      ),
    ).rejects.toThrow(/disabled coupon|coupons_reject|coupons_/i);
  });

  it('returns CouponNotFoundError when disabling an unknown coupon', async () => {
    await expect(
      coupons.disableCoupon(actor, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(CouponNotFoundError);
  });

  it('reports EXPIRED lifecycle for validity window in the past', async () => {
    const expired = await coupons.createCoupon(actor, {
      ...fixedInput('FIXED-EXPIRED'),
      validFrom: '2024-01-01T00:00:00.000Z',
      validUntil: '2024-02-01T00:00:00.000Z',
    });
    const detail = await coupons.getCoupon(actor, expired.id);
    expect(detail.lifecycle).toBe('EXPIRED');
  });

  it('reports DISABLED lifecycle when a coupon is disabled', async () => {
    const created = await coupons.createCoupon(actor, fixedInput('FIXED-CYCLE'));
    await coupons.disableCoupon(actor, created.id);
    const detail = await coupons.getCoupon(actor, created.id);
    expect(detail.lifecycle).toBe('DISABLED');
  });
});
