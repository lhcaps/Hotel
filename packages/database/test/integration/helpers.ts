import type { Pool } from 'pg';

import { createPreparedGuardedTestDatabase, type GuardedTestDatabase } from '../../src/testing.js';
import { migrateDatabase } from '../../src/migrations.js';

export const IDS = {
  property: '00000000-0000-4000-8000-000000000101',
  otherProperty: '00000000-0000-4000-8000-000000000102',
  tier: '00000000-0000-4000-8000-000000000201',
  roomType: '00000000-0000-4000-8000-000000000301',
  room: '00000000-0000-4000-8000-000000000401',
  otherRoom: '00000000-0000-4000-8000-000000000402',
  amenity: '00000000-0000-4000-8000-000000000501',
  ratePlan: '00000000-0000-4000-8000-000000000601',
  booking: '00000000-0000-4000-8000-000000000701',
  maintenance: '00000000-0000-4000-8000-000000000801',
} as const;

export async function createMigratedTestDatabase(): Promise<GuardedTestDatabase> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (baseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL is required for database integration tests');
  }
  return createPreparedGuardedTestDatabase(baseUrl, async (database) => {
    await migrateDatabase(database.databaseUrl);
  });
}

export async function insertCatalogFixture(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO properties (id, code, name, timezone)
     VALUES ($1, 'TEST_PROPERTY', 'Test Property', 'Asia/Ho_Chi_Minh')`,
    [IDS.property],
  );
  await pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
     VALUES ($1, $2, 'TIER_TEST', 'Test tier', 1)`,
    [IDS.tier, IDS.property],
  );
  await pool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
     VALUES ($1, $2, $3, 'ROOM_TYPE_TEST', 'Test room type', 2, 1, 3)`,
    [IDS.roomType, IDS.property, IDS.tier],
  );
  await pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number)
     VALUES ($1, $2, $3, 'T-101'), ($4, $2, $3, 'T-102')`,
    [IDS.room, IDS.property, IDS.roomType, IDS.otherRoom],
  );
}

export async function insertBooking(
  pool: Pool,
  overrides: {
    readonly id?: string;
    readonly roomId?: string;
    readonly quoteId?: string | null;
    readonly status?: string;
    readonly checkIn?: string;
    readonly checkOut?: string;
    readonly createdAt?: string;
    readonly holdExpiresAt?: string;
    readonly expiredAt?: string | null;
    readonly grossAmount?: string;
    readonly discountAmount?: string;
    readonly finalAmount?: string;
    readonly priceSnapshot?: unknown;
  } = {},
): Promise<void> {
  const id = overrides.id ?? IDS.booking;
  const roomId = overrides.roomId ?? IDS.room;
  const quoteId = overrides.quoteId ?? null;
  const status = overrides.status ?? 'HOLD';
  const checkIn = overrides.checkIn ?? '2027-01-10T04:00:00.000Z';
  const checkOut = overrides.checkOut ?? '2027-01-10T07:00:00.000Z';
  const createdAt = overrides.createdAt ?? '2026-12-01T00:00:00.000Z';
  const holdExpiresAt = overrides.holdExpiresAt ?? '2026-12-01T00:15:00.000Z';
  const expiredAt = overrides.expiredAt ?? null;
  const grossAmount = overrides.grossAmount ?? '359000';
  const discountAmount = overrides.discountAmount ?? '0';
  const finalAmount = overrides.finalAmount ?? '359000';
  const priceSnapshot =
    'priceSnapshot' in overrides
      ? overrides.priceSnapshot
      : {
          ratePlanCode: 'LUNCH_COMBO',
          grossAmountVnd: 359000,
        };

  await pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, quote_id, booking_code, status,
        check_in, check_out, adults, children, currency,
        gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot,
        hold_expires_at, expired_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 0, 'VND',
             $10, $11, $12, $13::jsonb, $14, $15, $16, $16)`,
    [
      id,
      IDS.property,
      IDS.roomType,
      roomId,
      quoteId,
      `TEST-${id.slice(-6)}`,
      status,
      checkIn,
      checkOut,
      grossAmount,
      discountAmount,
      finalAmount,
      JSON.stringify(priceSnapshot),
      holdExpiresAt,
      expiredAt,
      createdAt,
    ],
  );
}

export function postgresErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}
