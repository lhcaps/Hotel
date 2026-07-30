import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { QuoteRepository } from '../../src/pricing/quote.repository.js';
import {
  QuoteExpiredError,
  QuotePricingConfigurationError,
  QuoteService,
  QuoteUnavailableError,
} from '../../src/pricing/quote.service.js';

const ids = {
  property: '550e8400-e29b-41d4-a716-446655440110',
  tier: '550e8400-e29b-41d4-a716-446655440120',
  type: '550e8400-e29b-41d4-a716-446655440130',
  room: '550e8400-e29b-41d4-a716-446655440140',
  plan: '550e8400-e29b-41d4-a716-446655440150',
  price: '550e8400-e29b-41d4-a716-446655440160',
  expiredQuote: '550e8400-e29b-41d4-a716-446655440170',
  maintenance: '550e8400-e29b-41d4-a716-446655440180',
};
describe('immutable quote issuance', () => {
  let database: GuardedTestDatabase;
  let quotes: QuoteService;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    quotes = new QuoteService(new QuoteRepository(client), {});
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
      `INSERT INTO rooms (id,property_id,room_type_id,room_number) VALUES ($1,$2,$3,'101')`,
      [ids.room, ids.property, ids.type],
    );
    await database.pool.query(
      `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,is_base_plan,min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'THREE_HOUR_COMBO','Three hours','ACTIVE',180,1,true,60,240)`,
      [ids.plan, ids.property],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd) VALUES ($1,$2,$3,$4,359000)`,
      [ids.price, ids.property, ids.plan, ids.tier],
    );
  });
  afterAll(async () => database?.dispose());
  it('returns only active, priced eligible offers without creating a quote', async () => {
    const input = {
      roomTypeId: ids.type,
      checkIn: '2027-01-10T03:00:00.000Z',
      checkOut: '2027-01-10T06:00:00.000Z',
      adults: 2,
      children: 1,
    };

    const offers = await quotes.eligibleOffers(input);

    expect(offers).toEqual({
      items: [
        expect.objectContaining({
          planCode: 'THREE_HOUR_COMBO',
          planLabel: 'Three hours',
          totalAmountVnd: 359000,
        }),
      ],
    });
    expect(
      (await database.pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM quotes`))
        .rows[0]?.count,
    ).toBe(0);
  });

  it('issues a persisted immutable snapshot with database-time 15-minute expiry and no inventory reservation', async () => {
    const input = {
      roomTypeId: ids.type,
      checkIn: '2027-01-10T03:00:00.000Z',
      checkOut: '2027-01-10T06:00:00.000Z',
      adults: 2,
      children: 1,
    };
    const quote = await quotes.issue(input);
    expect(quote).toMatchObject({
      roomTypeId: ids.type,
      roomTypeName: 'Deluxe',
      pricing: {
        baseAmountVnd: 359000,
        extraAmountVnd: 0,
        totalAmountVnd: 359000,
        lineItems: [{ code: 'THREE_HOUR_COMBO', amountVnd: 359000, units: 1 }],
      },
    });
    const persisted = await database.pool.query<{ ttl_seconds: number; pricing_snapshot: unknown }>(
      `SELECT EXTRACT(EPOCH FROM expires_at - created_at)::int AS ttl_seconds, pricing_snapshot FROM quotes WHERE id = $1`,
      [quote.id],
    );
    expect(persisted.rows[0]?.ttl_seconds).toBe(900);
    expect(JSON.stringify(persisted.rows[0]?.pricing_snapshot)).not.toMatch(
      /roomNumber|roomId|101/,
    );
    await expect(
      database.pool.query(`UPDATE quotes SET adults = 1 WHERE id = $1`, [quote.id]),
    ).rejects.toMatchObject({ code: 'P0001' });
    await expect(
      database.pool.query(`DELETE FROM quotes WHERE id = $1`, [quote.id]),
    ).rejects.toMatchObject({
      code: 'P0001',
    });
    const blocks = await database.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM room_inventory_blocks`,
    );
    expect(blocks.rows[0]?.count).toBe(0);
    expect(await quotes.get(quote.id)).toEqual(quote);

    await database.pool.query(`UPDATE rate_plan_prices SET amount_vnd = 369000 WHERE id = $1`, [
      ids.price,
    ]);
    const repriced = await quotes.issue(input);
    expect(repriced.pricing.totalAmountVnd).toBe(369000);
    expect((await quotes.get(quote.id)).pricing.totalAmountVnd).toBe(359000);

    await database.pool.query(
      `INSERT INTO quotes (id,property_id,room_type_id,check_in,check_out,adults,children,base_amount_vnd,extra_amount_vnd,total_amount_vnd,pricing_snapshot,created_at,expires_at)
       VALUES ($1,$2,$3,$4,$5,2,1,359000,0,359000,$6,CURRENT_TIMESTAMP - interval '20 minutes',CURRENT_TIMESTAMP - interval '5 minutes')`,
      [
        ids.expiredQuote,
        ids.property,
        ids.type,
        input.checkIn,
        input.checkOut,
        JSON.stringify({ ...quote, id: ids.expiredQuote }),
      ],
    );
    await expect(quotes.get(ids.expiredQuote)).rejects.toBeInstanceOf(QuoteExpiredError);
  });

  it('rejects incomplete pricing and unavailable inventory without writing a quote', async () => {
    const input = {
      roomTypeId: ids.type,
      checkIn: '2027-01-11T03:00:00.000Z',
      checkOut: '2027-01-11T06:00:00.000Z',
      adults: 2,
      children: 1,
    };
    await database.pool.query(`DELETE FROM rate_plan_prices WHERE id = $1`, [ids.price]);
    await expect(quotes.issue(input)).rejects.toBeInstanceOf(QuotePricingConfigurationError);
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd) VALUES ($1,$2,$3,$4,369000)`,
      [ids.price, ids.property, ids.plan, ids.tier],
    );
    await database.pool.query(
      `INSERT INTO maintenance_blocks (id,property_id,room_id,starts_at,ends_at,reason)
       VALUES ($1,$2,$3,$4,$5,'unavailable')`,
      [ids.maintenance, ids.property, ids.room, input.checkIn, input.checkOut],
    );
    await database.pool.query(
      `INSERT INTO room_inventory_blocks (property_id,room_id,maintenance_block_id,block_type,starts_at,ends_at)
       VALUES ($1,$2,$3,'MAINTENANCE',$4,$5)`,
      [ids.property, ids.room, ids.maintenance, input.checkIn, input.checkOut],
    );
    await expect(quotes.issue(input)).rejects.toBeInstanceOf(QuoteUnavailableError);
    const written = await database.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM quotes WHERE check_in = $1`,
      [input.checkIn],
    );
    expect(written.rows[0]?.count).toBe(0);

    await database.pool.query(`DELETE FROM rate_plan_prices WHERE id = $1`, [ids.price]);
    await database.pool.query(`DELETE FROM rate_plans WHERE id = $1`, [ids.plan]);
    await expect(
      quotes.issue({
        ...input,
        checkIn: '2027-01-12T03:00:00.000Z',
        checkOut: '2027-01-12T06:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(QuotePricingConfigurationError);
  });
});
