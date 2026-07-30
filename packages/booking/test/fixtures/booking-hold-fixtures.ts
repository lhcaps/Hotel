import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { NormalizedContact } from '../../src/contact.js';
import type { RandomIndexSource } from '../../src/booking-code.js';

export interface BookingHoldFixture {
  readonly quoteId: string;
  readonly contact: NormalizedContact;
  readonly singleAvailableRoom: boolean;
  readonly propertyId?: string;
  readonly roomTypeId?: string;
  readonly roomId?: string;
  readonly secondRoomId?: string;
  readonly expiresAt?: string;
  readonly alreadyExpired?: boolean;
  readonly pricingSnapshot?: unknown;
  readonly totalAmountVnd?: number;
  readonly baseAmountVnd?: number;
  readonly extraAmountVnd?: number;
}

export async function seedBookingHoldFixture(
  pool: Pool,
  fixture: BookingHoldFixture,
): Promise<{
  readonly quoteId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly propertyId: string;
}> {
  const propertyId = fixture.propertyId ?? randomUUID();
  const tierId = randomUUID();
  const roomTypeId = fixture.roomTypeId ?? randomUUID();
  const roomId = fixture.roomId ?? randomUUID();
  const secondRoomId = fixture.secondRoomId ?? randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO properties (id, code, name, timezone, status) VALUES ($1, $2, $3, 'Asia/Ho_Chi_Minh', 'ACTIVE')`,
      [propertyId, `TEST_${propertyId.slice(0, 8)}`, 'Test Property'],
    );
    await client.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order, status) VALUES ($1, $2, $3, 'Test Tier', 1, 'ACTIVE')`,
      [tierId, propertyId, `TIER_${tierId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy, status)
       VALUES ($1, $2, $3, $4, 'Test Room Type', 2, 1, 3, 'ACTIVE')`,
      [roomTypeId, propertyId, tierId, `RT_${roomTypeId.slice(0, 8)}`],
    );
    const rooms = fixture.singleAvailableRoom
      ? [[roomId, 'T-101']]
      : [
          [roomId, 'T-101'],
          [secondRoomId, 'T-102'],
        ];
    for (const [id, number] of rooms) {
      await client.query(
        `INSERT INTO rooms (id, property_id, room_type_id, room_number, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [id, propertyId, roomTypeId, number],
      );
    }
    const baseAmountVnd = fixture.baseAmountVnd ?? 359000;
    const extraAmountVnd = fixture.extraAmountVnd ?? 0;
    const totalAmountVnd = fixture.totalAmountVnd ?? baseAmountVnd + extraAmountVnd;
    const pricingSnapshot = fixture.pricingSnapshot ?? {
      pricing: { ruleVersion: 'phase-4-pricing-availability-v1', totalAmountVnd },
      fixture: true,
    };
    await client.query(
      `INSERT INTO quotes
       (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
        base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at, created_at)
       VALUES ($1, $2, $3, '2027-01-10T04:00:00.000Z', '2027-01-10T07:00:00.000Z', 1, 0, 'VND', $4, $5, $6, $7::jsonb,
               CASE WHEN $8::boolean THEN CURRENT_TIMESTAMP - interval '1 minute'
                    ELSE COALESCE($9::timestamptz, CURRENT_TIMESTAMP + interval '15 minutes') END,
               CASE WHEN $8::boolean THEN CURRENT_TIMESTAMP - interval '2 minutes' ELSE CURRENT_TIMESTAMP END)`,
      [
        fixture.quoteId,
        propertyId,
        roomTypeId,
        baseAmountVnd,
        extraAmountVnd,
        totalAmountVnd,
        JSON.stringify(pricingSnapshot),
        fixture.alreadyExpired ?? false,
        fixture.expiresAt ?? null,
      ],
    );
    await client.query('COMMIT');
    return { quoteId: fixture.quoteId, roomTypeId, roomId, propertyId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function seedConsumedExpiredBooking(
  pool: Pool,
  input: {
    readonly quoteId: string;
    readonly propertyId: string;
    readonly roomTypeId: string;
    readonly roomId: string;
    readonly contact: NormalizedContact;
  },
): Promise<{ readonly bookingId: string; readonly bookingCode: string }> {
  const bookingId = randomUUID();
  const bookingCode = `EXPIRED-${bookingId}`;
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, quote_id, booking_code, status, check_in, check_out,
        adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
        pricing_rule_version, price_snapshot, hold_expires_at)
       SELECT $1, property_id, room_type_id, $2, id, $3, 'HOLD', check_in, check_out,
              adults, children, currency, total_amount_vnd, 0, total_amount_vnd,
              pricing_snapshot->'pricing'->>'ruleVersion', pricing_snapshot,
              CURRENT_TIMESTAMP + interval '15 minutes'
         FROM quotes WHERE id = $4`,
      [bookingId, input.roomId, bookingCode, input.quoteId],
    );
    await client.query(
      `INSERT INTO booking_contacts
       (booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        bookingId,
        input.contact.fullName,
        input.contact.email,
        input.contact.phoneE164,
        input.contact.emailDigest,
      ],
    );
    await client.query(
      `INSERT INTO room_inventory_blocks
       (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
       SELECT property_id, $1, $2, 'BOOKING', 'ACTIVE', check_in, check_out
         FROM quotes WHERE id = $3`,
      [input.roomId, bookingId, input.quoteId],
    );
    await client.query(
      `INSERT INTO audit_events
       (property_id, aggregate_type, aggregate_id, event_type, actor_type, payload)
       VALUES ($1, 'BOOKING', $2, 'HOLD_CREATED', 'GUEST', $3::jsonb)`,
      [input.propertyId, bookingId, JSON.stringify({ bookingCode, correlationId: randomUUID() })],
    );
    await client.query(
      `INSERT INTO outbox_events
       (property_id, aggregate_type, aggregate_id, event_type, payload, status)
       VALUES ($1, 'BOOKING', $2, 'booking.hold.created', $3::jsonb, 'PENDING')`,
      [
        input.propertyId,
        bookingId,
        JSON.stringify({ eventVersion: 1, bookingId, holdExpiresAt: 'test-expiry' }),
      ],
    );
    await client.query('COMMIT');
    return { bookingId, bookingCode };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function lcgRandomIndexSource(seed: number): RandomIndexSource {
  let state = seed;
  return (upperExclusive) => {
    state = (1103515245 * state + 12345) & 0x7fffffff;
    return state % upperExclusive;
  };
}
