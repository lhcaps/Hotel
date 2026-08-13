import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { QuoteRepository } from '../../src/pricing/quote.repository.js';
import { QuoteService } from '../../src/pricing/quote.service.js';
import { CouponRepository } from '../../src/pricing/coupon.repository.js';

const ids = {
  property: '550e8400-e29b-41d4-a716-446655440210',
  tier: '550e8400-e29b-41d4-a716-446655440220',
  type: '550e8400-e29b-41d4-a716-446655440230',
  room: '550e8400-e29b-41d4-a716-446655440240',
  plan: '550e8400-e29b-41d4-a716-446655440250',
  price: '550e8400-e29b-41d4-a716-446655440260',
  fixedCoupon1: '550e8400-e29b-41d4-a716-446655440270',
  fixedCoupon2: '550e8400-e29b-41d4-a716-446655440271',
  fixedCoupon3: '550e8400-e29b-41d4-a716-446655440272',
  percentCoupon: '550e8400-e29b-41d4-a716-446655440280',
  scopedCoupon: '550e8400-e29b-41d4-a716-446655440290',
  otherType: '550e8400-e29b-41d4-a716-4466554402a0',
};

async function seedCatalog(database: GuardedTestDatabase) {
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
    [ids.otherType, ids.property, ids.tier],
  );
  await database.pool.query(
    `INSERT INTO rooms (id,property_id,room_type_id,room_number) VALUES ($1,$2,$3,'101')`,
    [ids.room, ids.property, ids.type],
  );
  await database.pool.query(
    `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,is_base_plan,min_duration_minutes_inclusive,max_duration_minutes_inclusive)
     VALUES ($1,$2,'THREE_HOUR_COMBO','Three hours','ACTIVE',180,1,true,60,240)`,
    [ids.plan, ids.property],
  );
  await database.pool.query(
    `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd) VALUES ($1,$2,$3,$4,500000)`,
    [ids.price, ids.property, ids.plan, ids.tier],
  );
}

async function insertFixedCoupon(
  database: GuardedTestDatabase,
  code: string,
  amountVnd: number,
  couponId: string,
): Promise<string> {
  await database.pool.query(
    `INSERT INTO coupons (id,property_id,normalized_code,status,discount_type,fixed_amount_vnd,percentage_basis_points,maximum_discount_vnd,minimum_order_amount_vnd,valid_from,valid_until,applies_to_all_room_types,total_usage_limit,per_customer_limit)
     VALUES ($1,$2,$3,'ACTIVE','FIXED',$4,NULL,NULL,0,CURRENT_TIMESTAMP - interval '1 day',CURRENT_TIMESTAMP + interval '30 days',true,NULL,NULL)`,
    [couponId, ids.property, code, amountVnd],
  );
  return couponId;
}

async function insertPercentCoupon(
  database: GuardedTestDatabase,
  code: string,
  basisPoints: number,
): Promise<string> {
  await database.pool.query(
    `INSERT INTO coupons (id,property_id,normalized_code,status,discount_type,fixed_amount_vnd,percentage_basis_points,maximum_discount_vnd,minimum_order_amount_vnd,valid_from,valid_until,applies_to_all_room_types,total_usage_limit,per_customer_limit)
     VALUES ($1,$2,$3,'ACTIVE','PERCENTAGE',NULL,$4,NULL,0,CURRENT_TIMESTAMP - interval '1 day',CURRENT_TIMESTAMP + interval '30 days',true,NULL,NULL)`,
    [ids.percentCoupon, ids.property, code, basisPoints],
  );
  return ids.percentCoupon;
}

async function insertScopedCoupon(
  database: GuardedTestDatabase,
  code: string,
  amountVnd: number,
  allowedRoomTypeId: string,
): Promise<string> {
  // The deferred scope-consistency trigger requires the join row to exist
  // before commit; wrap both inserts in a single transaction.
  const client = await database.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coupons (id,property_id,normalized_code,status,discount_type,fixed_amount_vnd,percentage_basis_points,maximum_discount_vnd,minimum_order_amount_vnd,valid_from,valid_until,applies_to_all_room_types,total_usage_limit,per_customer_limit)
       VALUES ($1,$2,$3,'ACTIVE','FIXED',$4,NULL,NULL,0,CURRENT_TIMESTAMP - interval '1 day',CURRENT_TIMESTAMP + interval '30 days',false,NULL,NULL)`,
      [ids.scopedCoupon, ids.property, code, amountVnd],
    );
    await client.query(
      `INSERT INTO coupon_room_types (coupon_id,room_type_id,property_id) VALUES ($1,$2,$3)`,
      [ids.scopedCoupon, allowedRoomTypeId, ids.property],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return ids.scopedCoupon;
}

describe('coupon-aware quote issuance', () => {
  let database: GuardedTestDatabase;
  let quotes: QuoteService;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    await seedCatalog(database);
    quotes = new QuoteService(new QuoteRepository(client), {
      couponRepository: new CouponRepository(client),
    });
  });
  afterAll(async () => database?.dispose());

  it('issues a quote without a coupon when no code is supplied', async () => {
    const quote = await quotes.issue({
      mode: 'hourly',
      roomTypeId: ids.type,
      checkIn: '2027-02-10T03:00:00.000Z',
      checkOut: '2027-02-10T06:00:00.000Z',
      adults: 2,
      children: 0,
    });
    expect(quote.coupon).toBeUndefined();
  });

  it('applies a fixed discount provisionally without creating an application row', async () => {
    await insertFixedCoupon(database, 'FIXED-50K', 50_000, ids.fixedCoupon1);
    const quote = await quotes.issue({
      mode: 'hourly',
      roomTypeId: ids.type,
      checkIn: '2027-02-11T03:00:00.000Z',
      checkOut: '2027-02-11T06:00:00.000Z',
      adults: 2,
      children: 0,
      couponCode: 'FIXED-50K',
    });
    expect(quote.coupon).toBeDefined();
    expect(quote.coupon?.code).toBe('FIXED-50K');
    expect(quote.coupon?.discountType).toBe('FIXED');
    expect(quote.coupon?.grossAmountVnd).toBe(500_000);
    expect(quote.coupon?.discountAmountVnd).toBe(50_000);
    expect(quote.coupon?.finalAmountVnd).toBe(450_000);

    const applications = await database.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM booking_coupon_applications`,
    );
    expect(applications.rows[0]?.count).toBe(0);
  });

  it('applies a percentage discount with a maximum cap', async () => {
    await insertPercentCoupon(database, 'PCT-25PCT', 2500); // 25%
    const quote = await quotes.issue({
      mode: 'hourly',
      roomTypeId: ids.type,
      checkIn: '2027-02-12T03:00:00.000Z',
      checkOut: '2027-02-12T06:00:00.000Z',
      adults: 2,
      children: 0,
      couponCode: 'PCT-25PCT',
    });
    expect(quote.coupon?.discountType).toBe('PERCENTAGE');
    expect(quote.coupon?.discountAmountVnd).toBe(125_000);
    expect(quote.coupon?.finalAmountVnd).toBe(375_000);
  });

  it('rejects an unknown coupon code with a safe public error', async () => {
    await expect(
      quotes.issue({
        mode: 'hourly',
        roomTypeId: ids.type,
        checkIn: '2027-02-13T03:00:00.000Z',
        checkOut: '2027-02-13T06:00:00.000Z',
        adults: 2,
        children: 0,
        couponCode: 'NO-SUCH-CODE',
      }),
    ).rejects.toMatchObject({ code: 'COUPON_NOT_APPLICABLE' });
  });

  it('rejects a scoped coupon when the room type is not allowed', async () => {
    await insertScopedCoupon(database, 'SCOPED-DLX', 25_000, ids.type);
    // Add a room to the other type so availability check passes; the
    // coupon is scoped to DLX only and must be rejected.
    await database.pool.query(
      `INSERT INTO rooms (id,property_id,room_type_id,room_number) VALUES ('550e8400-e29b-41d4-a716-446655440241',$1,$2,'102')`,
      [ids.property, ids.otherType],
    );
    await expect(
      quotes.issue({
        mode: 'hourly',
        roomTypeId: ids.otherType,
        checkIn: '2027-02-14T03:00:00.000Z',
        checkOut: '2027-02-14T06:00:00.000Z',
        adults: 2,
        children: 0,
        couponCode: 'SCOPED-DLX',
      }),
    ).rejects.toMatchObject({ code: 'COUPON_NOT_APPLICABLE' });
  });

  it('persists the coupon snapshot in the quote row for later HOLD revalidation', async () => {
    await insertFixedCoupon(database, 'SNAP-10K', 10_000, ids.fixedCoupon2);
    const quote = await quotes.issue({
      mode: 'hourly',
      roomTypeId: ids.type,
      checkIn: '2027-02-15T03:00:00.000Z',
      checkOut: '2027-02-15T06:00:00.000Z',
      adults: 2,
      children: 0,
      couponCode: 'SNAP-10K',
    });
    const persisted = await database.pool.query<{
      coupon_id: string;
      coupon_snapshot: { normalizedCode: string; discountAmountVnd: string } | null;
    }>(`SELECT coupon_id, coupon_snapshot FROM quotes WHERE id = $1`, [quote.id]);
    expect(persisted.rows[0]?.coupon_id).toBe(ids.fixedCoupon2);
    expect(persisted.rows[0]?.coupon_snapshot).toMatchObject({
      normalizedCode: 'SNAP-10K',
      discountAmountVnd: '10000',
    });
  });
});
