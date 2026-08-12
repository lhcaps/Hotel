/**
 * Phase 7G ADMIN booking operations — integration tests.
 *
 * Uses real PostgreSQL via the guarded database helper and verifies the
 * 22 transactional cases called out in the Phase 7G design. Concurrency
 * cases use separate real PostgreSQL connections from `getPool()`.
 */

import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createCancellationPolicySnapshot } from '@room/booking';

import {
  createDatabaseClient,
  createDatabasePool,
  migrateDatabase,
  type DatabaseClient,
  type DatabasePool,
  type DatabasePoolClient,
} from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { AdminBookingLifecycleService } from '../../src/booking/services/admin-booking-lifecycle.service.js';
import { AdminBookingRepository } from '../../src/booking/repositories/admin-booking.repository.js';
import {
  BookingTransitionError,
  NoShowBeforeCheckInError,
  OperationalReviewAlreadyResolvedError,
  OperationalReviewNotFoundError,
} from '../../src/booking/admin-booking.errors.js';
import { BookingNotFoundError } from '../../src/booking/services/booking-detail.service.js';

const ids = {
  property: '660e8400-e29b-41d4-a716-446655440101',
  tier: '660e8400-e29b-41d4-a716-446655440102',
  roomType: '660e8400-e29b-41d4-a716-446655440103',
  room: '660e8400-e29b-41d4-a716-446655440104',
  roomOther: '660e8400-e29b-41d4-a716-446655440105',
  admin: '660e8400-e29b-41d4-a716-446655440001',
};

const actor: ActorContext = {
  userId: ids.admin,
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: [
    'booking.lifecycle.read',
    'booking.lifecycle.manage',
    'booking.review.read',
    'booking.review.manage',
  ],
  propertyIds: [ids.property],
  sessionId: '660e8400-e29b-41d4-a716-446655440002',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'phase-7g-integration',
};

function bookingCode(seed: string): string {
  return `TEST-${seed.toUpperCase().slice(0, 20)}`;
}

async function seedBaseCatalog(database: GuardedTestDatabase): Promise<void> {
  await database.pool.query(
    `INSERT INTO properties (id, code, name, timezone)
     VALUES ($1, 'MAIN', 'Main', 'Asia/Ho_Chi_Minh')`,
    [ids.property],
  );
  await database.pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
     VALUES ($1, $2, 'TIER_1', 'Tier', 1)`,
    [ids.tier, ids.property],
  );
  await database.pool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
     VALUES ($1, $2, $3, 'DLX', 'Deluxe', 2, 0, 2)`,
    [ids.roomType, ids.property, ids.tier],
  );
  await database.pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number)
     VALUES ($1, $2, $3, 'T-101'), ($4, $2, $3, 'T-102')`,
    [ids.room, ids.property, ids.roomType, ids.roomOther],
  );
  await database.pool.query(
    `INSERT INTO users (id, name, email, role)
     VALUES ($1, 'Admin', $2, 'ADMIN')`,
    [ids.admin, 'admin@example.test'],
  );
}

async function insertHoldBooking(
  database: GuardedTestDatabase,
  options: {
    readonly bookingId?: string;
    readonly bookingCode?: string;
    readonly checkIn?: Date;
    readonly checkOut?: Date;
    readonly couponCode?: string | null;
    readonly couponStatus?: 'RESERVED' | 'ASSOCIATED' | null;
    readonly withPayment?: boolean;
  } = {},
): Promise<{ bookingId: string; bookingCode: string; paymentId: string | null }> {
  const bookingId = options.bookingId ?? randomUUID();
  const code = options.bookingCode ?? bookingCode(`HOLD-${bookingId.slice(0, 8)}`);
  const checkIn = options.checkIn ?? new Date('2027-02-10T04:00:00.000Z');
  const checkOut = options.checkOut ?? new Date('2027-02-10T07:00:00.000Z');
  const cancellationPolicySnapshot = createCancellationPolicySnapshot({
    checkIn,
    timezone: 'Asia/Ho_Chi_Minh',
    capturedAt: new Date('2027-01-01T00:00:00.000Z'),
  });

  let couponId: string | null = null;
  let quoteId: string | null = null;
  if (options.couponCode !== undefined && options.couponCode !== null) {
    couponId = randomUUID();
    await database.pool.query(
      `INSERT INTO coupons
         (id, property_id, normalized_code, discount_type, fixed_amount_vnd,
          minimum_order_amount_vnd, valid_from, valid_until,
          applies_to_all_room_types, total_usage_limit)
       VALUES ($1, $2, $3, 'FIXED', 50000, 0, '2026-01-01', '2027-12-31',
               true, 100)`,
      [couponId, ids.property, options.couponCode],
    );
    quoteId = randomUUID();
    await database.pool.query(
      `INSERT INTO quotes
         (id, property_id, room_type_id, check_in, check_out,
          adults, children, currency, base_amount_vnd, extra_amount_vnd,
          total_amount_vnd, coupon_id, coupon_snapshot, pricing_snapshot, expires_at)
       VALUES ($1, $2, $3, $4, $5, 1, 0, 'VND', 309000, 0, 309000,
               $6, $7::jsonb, $8::jsonb, '2027-02-10T05:00:00.000Z')`,
      [
        quoteId,
        ids.property,
        ids.roomType,
        checkIn,
        checkOut,
        couponId,
        JSON.stringify({
          code: options.couponCode,
          discountType: 'FIXED',
          fixedAmountVnd: 50000,
        }),
        JSON.stringify({ ratePlanCode: 'LUNCH_COMBO', couponCode: options.couponCode }),
      ],
    );
  }

  await database.pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, booking_code, status,
        check_in, check_out, adults, children, currency,
        gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
        price_snapshot, cancellation_policy_snapshot, hold_expires_at, quote_id)
     VALUES ($1, $2, $3, $4, $5, 'HOLD', $6, $7, 1, 0, 'VND',
             359000, $8, $9, $10::jsonb, $11::jsonb, '2027-01-01T00:15:00.000Z', $12)`,
    [
      bookingId,
      ids.property,
      ids.roomType,
      ids.room,
      code,
      checkIn,
      checkOut,
      couponId === null ? 0 : 50000,
      couponId === null ? 359000 : 309000,
      JSON.stringify({ ratePlanCode: 'LUNCH_COMBO' }),
      JSON.stringify(cancellationPolicySnapshot),
      quoteId,
    ],
  );

  await database.pool.query(
    `INSERT INTO booking_contacts (booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
     VALUES ($1, 'Tester', 'tester@example.test', '+84909000001', $2)`,
    [bookingId, randomBytes(32)],
  );

  await database.pool.query(
    `INSERT INTO room_inventory_blocks (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
     VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', $4, $5)`,
    [ids.property, ids.room, bookingId, checkIn, checkOut],
  );

  let paymentId: string | null = null;
  if (options.withPayment === true) {
    paymentId = randomUUID();
    await database.pool.query(
      `INSERT INTO payments
         (id, property_id, booking_id, status, amount_vnd, currency,
          confirmation_source, succeeded_at)
       VALUES ($1, $2, $3, 'SUCCEEDED', 359000, 'VND', 'PROVIDER_EVENT', now())`,
      [paymentId, ids.property, bookingId],
    );
  }

  if (couponId !== null && options.couponCode !== undefined && options.couponCode !== null) {
    await database.pool.query(
      `INSERT INTO booking_coupon_applications
         (property_id, booking_id, coupon_id, customer_email_digest,
          application_status, quota_reserved, discount_type, fixed_amount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd,
          final_amount_vnd, coupon_code_snapshot, reserved_at)
       VALUES ($1, $2, $3, $4, $5, true, 'FIXED', 50000, 0, 359000, 50000, 309000,
               $6, now())`,
      [
        ids.property,
        bookingId,
        couponId,
        randomBytes(32),
        options.couponStatus ?? 'RESERVED',
        options.couponCode,
      ],
    );
  }

  return { bookingId, bookingCode: code, paymentId };
}

async function confirmBooking(database: GuardedTestDatabase, bookingId: string): Promise<void> {
  await database.pool.query(`UPDATE bookings SET status = 'CONFIRMED' WHERE id = $1`, [bookingId]);
  await database.pool.query(
    `UPDATE booking_coupon_applications
        SET application_status = 'REDEEMED',
            redeemed_at = now(),
            redemption_event_key = $2
      WHERE booking_id = $1`,
    [bookingId, `seed-${randomUUID()}`],
  );
}

interface ServiceFixture {
  readonly database: GuardedTestDatabase;
  readonly pool: DatabasePool;
  readonly client: DatabaseClient;
  readonly service: AdminBookingLifecycleService;
}

async function buildService(): Promise<ServiceFixture> {
  const url = process.env.TEST_DATABASE_URL;
  if (url === undefined) {
    throw new Error('TEST_DATABASE_URL is required for Phase 7G integration tests');
  }
  const database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
    migrateDatabase(prepared.databaseUrl),
  );
  await seedBaseCatalog(database);
  const client = createDatabaseClient(database.pool);
  const pool = createDatabasePool(database.databaseUrl, {
    max: 6,
    applicationName: 'phase-7g-tests',
  });
  const repository = new AdminBookingRepository(pool);
  const service = new AdminBookingLifecycleService(pool, repository);
  return { database, pool, client, service };
}

describe('Phase 7G admin booking lifecycle', () => {
  let fixture: ServiceFixture;

  beforeAll(async () => {
    fixture = await buildService();
  });
  beforeEach(async () => {
    await fixture.database.pool.query(
      `UPDATE rooms SET status = 'ACTIVE', housekeeping_status = 'CLEAN' WHERE property_id = $1`,
      [ids.property],
    );
    await fixture.database.pool.query(
      `ALTER TABLE booking_contacts DISABLE TRIGGER booking_contacts_reject_mutation`,
    );
    try {
      await fixture.database.pool.query(`DELETE FROM outbox_events WHERE property_id = $1`, [
        ids.property,
      ]);
      await fixture.database.pool.query(`DELETE FROM operational_reviews WHERE property_id = $1`, [
        ids.property,
      ]);
      await fixture.database.pool.query(
        `DELETE FROM booking_coupon_applications WHERE property_id = $1`,
        [ids.property],
      );
      await fixture.database.pool.query(`DELETE FROM payments WHERE property_id = $1`, [
        ids.property,
      ]);
      await fixture.database.pool.query(
        `DELETE FROM room_inventory_blocks WHERE property_id = $1`,
        [ids.property],
      );
      await fixture.database.pool.query(`DELETE FROM housekeeping_tasks WHERE property_id = $1`, [
        ids.property,
      ]);
      await fixture.database.pool.query(
        `ALTER TABLE booking_contacts DISABLE TRIGGER booking_contacts_reject_mutation`,
      );
      await fixture.database.pool.query(
        `ALTER TABLE quotes DISABLE TRIGGER quotes_reject_mutation`,
      );
      try {
        await fixture.database.pool.query(
          `DELETE FROM booking_contacts WHERE booking_id IN (
           SELECT id FROM bookings WHERE property_id = $1
         )`,
          [ids.property],
        );
        await fixture.database.pool.query(
          `DELETE FROM access_credentials WHERE booking_id IN (
             SELECT id FROM bookings WHERE property_id = $1
           )`,
          [ids.property],
        );
        await fixture.database.pool.query(`DELETE FROM bookings WHERE property_id = $1`, [
          ids.property,
        ]);
        await fixture.database.pool.query(`DELETE FROM quotes WHERE property_id = $1`, [
          ids.property,
        ]);
        await fixture.database.pool.query(`DELETE FROM coupons WHERE property_id = $1`, [
          ids.property,
        ]);
      } finally {
        await fixture.database.pool.query(
          `ALTER TABLE booking_contacts ENABLE TRIGGER booking_contacts_reject_mutation`,
        );
        await fixture.database.pool.query(
          `ALTER TABLE quotes ENABLE TRIGGER quotes_reject_mutation`,
        );
      }
    } finally {
      await fixture.database.pool.query(
        `ALTER TABLE booking_contacts ENABLE TRIGGER booking_contacts_reject_mutation`,
      );
    }
  });
  afterAll(async () => {
    await fixture.pool.end().catch(() => undefined);
    await fixture.database.dispose();
  });

  describe('Cancel HOLD', () => {
    it('1. releases the BOOKING inventory block', async () => {
      const { bookingCode } = await insertHoldBooking(fixture.database, {});
      const result = await fixture.service.cancel(
        actor,
        bookingCode,
        { reason: 'Guest asked' },
        new Date(),
      );
      expect(result.status).toBe('CANCELLED');
      const blocks = await fixture.database.pool.query<{ status: string }>(
        `SELECT status FROM room_inventory_blocks WHERE booking_id IN (
            SELECT id FROM bookings WHERE booking_code = $1
         )`,
        [bookingCode],
      );
      expect(blocks.rows.every((row) => row.status === 'RELEASED')).toBe(true);
    });

    it('2. releases a RESERVED coupon application', async () => {
      const { bookingCode } = await insertHoldBooking(fixture.database, {
        couponCode: 'HOLD-RELEASE',
        couponStatus: 'RESERVED',
      });
      await fixture.service.cancel(actor, bookingCode, { reason: 'Guest asked' }, new Date());
      const apps = await fixture.database.pool.query<{ application_status: string }>(
        `SELECT application_status FROM booking_coupon_applications
          WHERE coupon_code_snapshot = 'HOLD-RELEASE'`,
      );
      expect(apps.rows[0]?.application_status).toBe('RELEASED');
    });

    it('3. duplicate cancel has one business effect and is rejected as transition', async () => {
      const { bookingCode } = await insertHoldBooking(fixture.database, {});
      await fixture.service.cancel(actor, bookingCode, { reason: 'first' }, new Date());
      await expect(
        fixture.service.cancel(actor, bookingCode, { reason: 'second' }, new Date()),
      ).rejects.toBeInstanceOf(BookingTransitionError);
      const audits = await fixture.database.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM audit_events
          WHERE aggregate_id = (SELECT id FROM bookings WHERE booking_code = $1)
            AND event_type = 'BOOKING_CANCELLED'`,
        [bookingCode],
      );
      expect(Number(audits.rows[0]?.count ?? '0')).toBe(1);
    });
  });

  describe('Cancel CONFIRMED', () => {
    it('revokes an issued Demo credential and appends a masked lifecycle audit', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {});
      await confirmBooking(fixture.database, bookingId);
      await fixture.database.pool.query(
        `INSERT INTO access_credentials
           (property_id, booking_id, room_id, provider, provider_credential_reference,
            status, valid_from, valid_until, issued_at, idempotency_key)
         SELECT property_id, id, room_id, 'DEMO', 'demo-cancellation-reference',
                'ISSUED', check_in, check_out, CURRENT_TIMESTAMP, 'test-cancellation-credential'
           FROM bookings WHERE id = $1`,
        [bookingId],
      );

      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      const result = await fixture.database.pool.query<{
        status: string;
        revoked_at: Date | null;
        audit_count: number;
      }>(
        `SELECT ac.status, ac.revoked_at,
                (SELECT count(*)::int FROM audit_events ae
                  WHERE ae.aggregate_id = ac.id
                    AND ae.event_type = 'ACCESS_CREDENTIAL_REVOKED') AS audit_count
           FROM access_credentials ac
          WHERE ac.booking_id = $1`,
        [bookingId],
      );
      expect(result.rows[0]).toMatchObject({ status: 'REVOKED', audit_count: 1 });
      expect(result.rows[0]?.revoked_at).toBeInstanceOf(Date);
    });

    it('revokes a delivered Demo credential without preserving an active access grant', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {});
      await confirmBooking(fixture.database, bookingId);
      await fixture.database.pool.query(
        `INSERT INTO access_credentials
           (property_id, booking_id, room_id, provider, provider_credential_reference,
            status, valid_from, valid_until, issued_at, delivered_at, idempotency_key)
         SELECT property_id, id, room_id, 'DEMO', 'demo-delivered-cancellation-reference',
                'DELIVERED', check_in, check_out, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                'test-delivered-cancellation-credential'
           FROM bookings WHERE id = $1`,
        [bookingId],
      );

      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      const result = await fixture.database.pool.query<{
        status: string;
        revoked_at: Date | null;
        audit_count: number;
      }>(
        `SELECT ac.status, ac.revoked_at,
                (SELECT count(*)::int FROM audit_events ae
                  WHERE ae.aggregate_id = ac.id
                    AND ae.event_type = 'ACCESS_CREDENTIAL_REVOKED') AS audit_count
           FROM access_credentials ac
          WHERE ac.booking_id = $1`,
        [bookingId],
      );
      expect(result.rows[0]).toMatchObject({ status: 'REVOKED', audit_count: 1 });
      expect(result.rows[0]?.revoked_at).toBeInstanceOf(Date);
    });

    it('cancels the future ARRIVAL_PREP task with the booking', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {});
      await confirmBooking(fixture.database, bookingId);
      await fixture.database.pool.query(
        `INSERT INTO housekeeping_tasks (property_id, room_id, booking_id, type, status, due_at, reminder_at)
         SELECT property_id, room_id, id, 'ARRIVAL_PREP', 'SCHEDULED', check_in, check_in - interval '1 hour'
           FROM bookings WHERE id = $1`,
        [bookingId],
      );

      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      expect(
        (
          await fixture.database.pool.query<{ status: string }>(
            `SELECT status FROM housekeeping_tasks WHERE booking_id = $1 AND type = 'ARRIVAL_PREP'`,
            [bookingId],
          )
        ).rows[0]?.status,
      ).toBe('CANCELLED');
    });

    it('4. preserves the SUCCEEDED payment row untouched', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      const payments = await fixture.database.pool.query<{ status: string }>(
        `SELECT status FROM payments WHERE booking_id = $1`,
        [bookingId],
      );
      expect(payments.rows[0]?.status).toBe('SUCCEEDED');
    });

    it('5. preserves a REDEEMED coupon application untouched', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        couponCode: 'PAID-COUPON',
        couponStatus: 'RESERVED',
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      const apps = await fixture.database.pool.query<{ application_status: string }>(
        `SELECT application_status FROM booking_coupon_applications
          WHERE coupon_code_snapshot = 'PAID-COUPON'`,
      );
      expect(apps.rows[0]?.application_status).toBe('REDEEMED');
    });

    it('6. creates exactly one OPEN operational review for paid cancellation', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      const reviews = await fixture.database.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM operational_reviews WHERE booking_id = $1`,
        [bookingId],
      );
      expect(Number(reviews.rows[0]?.count ?? '0')).toBe(1);
      const openReviews = await fixture.database.pool.query<{ status: string }>(
        `SELECT status FROM operational_reviews WHERE booking_id = $1`,
        [bookingId],
      );
      expect(openReviews.rows[0]?.status).toBe('OPEN');
    });

    it('7. duplicate paid cancellation creates no second review', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      await expect(
        fixture.service.cancel(actor, bookingCode, { reason: 'retry' }, new Date()),
      ).rejects.toBeInstanceOf(BookingTransitionError);
      const reviews = await fixture.database.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM operational_reviews WHERE booking_id = $1`,
        [bookingId],
      );
      expect(Number(reviews.rows[0]?.count ?? '0')).toBe(1);
    });
  });

  describe('Check-in / Check-out', () => {
    it('8. check-in preserves inventory blocking', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.checkIn(actor, bookingCode, new Date('2027-02-10T04:00:00.000Z'));
      const blocks = await fixture.database.pool.query<{ status: string }>(
        `SELECT status FROM room_inventory_blocks WHERE booking_id = $1`,
        [bookingId],
      );
      expect(blocks.rows[0]?.status).toBe('ACTIVE');
    });

    it('completes a SCHEDULED ARRIVAL_PREP task when check-in succeeds', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.database.pool.query(
        `INSERT INTO housekeeping_tasks (property_id, room_id, booking_id, type, status, due_at, reminder_at)
         SELECT property_id, room_id, id, 'ARRIVAL_PREP', 'SCHEDULED', check_in, check_in - interval '1 hour'
           FROM bookings WHERE id = $1`,
        [bookingId],
      );

      await fixture.service.checkIn(actor, bookingCode, new Date('2027-02-10T04:00:00.000Z'));

      const task = await fixture.database.pool.query<{
        status: string;
        completed_at: Date | null;
        completed_by: string | null;
      }>(
        `SELECT status, completed_at, completed_by
           FROM housekeeping_tasks
          WHERE booking_id = $1 AND type = 'ARRIVAL_PREP'`,
        [bookingId],
      );
      expect(task.rows[0]?.status).toBe('DONE');
      expect(task.rows[0]?.completed_at).toBeInstanceOf(Date);
      expect(task.rows[0]?.completed_by).toBe(ids.admin);
    });

    it('9. check-out releases inventory', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.checkIn(actor, bookingCode, new Date('2027-02-10T04:00:00.000Z'));
      await fixture.service.checkOut(actor, bookingCode, new Date('2027-02-10T05:00:00.000Z'));
      const blocks = await fixture.database.pool.query<{ status: string }>(
        `SELECT status FROM room_inventory_blocks WHERE booking_id = $1`,
        [bookingId],
      );
      expect(blocks.rows[0]?.status).toBe('RELEASED');
    });

    it('revokes an issued Demo credential at check-out', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.database.pool.query(
        `INSERT INTO access_credentials
           (property_id, booking_id, room_id, provider, provider_credential_reference,
            status, valid_from, valid_until, issued_at, idempotency_key)
         SELECT property_id, id, room_id, 'DEMO', 'demo-checkout-reference',
                'ISSUED', check_in, check_out, CURRENT_TIMESTAMP, 'test-checkout-credential'
           FROM bookings WHERE id = $1`,
        [bookingId],
      );
      await fixture.service.checkIn(actor, bookingCode, new Date('2027-02-10T04:00:00.000Z'));
      await fixture.service.checkOut(actor, bookingCode, new Date('2027-02-10T05:00:00.000Z'));
      const credential = await fixture.database.pool.query<{
        status: string;
        audit_count: number;
      }>(
        `SELECT ac.status,
                (SELECT count(*)::int FROM audit_events ae
                  WHERE ae.aggregate_id = ac.id
                    AND ae.event_type = 'ACCESS_CREDENTIAL_REVOKED') AS audit_count
           FROM access_credentials ac
          WHERE ac.booking_id = $1`,
        [bookingId],
      );
      expect(credential.rows[0]).toMatchObject({ status: 'REVOKED', audit_count: 1 });
    });

    it('marks the assigned room DIRTY when check-out succeeds', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.checkIn(actor, bookingCode, new Date('2027-02-10T04:00:00.000Z'));
      await fixture.service.checkOut(actor, bookingCode, new Date('2027-02-10T05:00:00.000Z'));

      const room = await fixture.database.pool.query<{ housekeeping_status: string }>(
        `SELECT r.housekeeping_status
           FROM rooms r
           JOIN bookings b ON b.room_id = r.id
          WHERE b.id = $1`,
        [bookingId],
      );
      expect(room.rows[0]?.housekeeping_status).toBe('DIRTY');
    });

    it('creates exactly one immediately due TURNOVER task when check-out succeeds', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      const checkedOutAt = new Date('2027-02-10T07:00:00.000Z');
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.checkIn(actor, bookingCode, new Date('2027-02-10T04:00:00.000Z'));
      await fixture.service.checkOut(actor, bookingCode, checkedOutAt);

      const tasks = await fixture.database.pool.query<{
        type: string;
        status: string;
        due_at: Date;
        reminder_at: Date | null;
      }>(
        `SELECT type, status, due_at, reminder_at
           FROM housekeeping_tasks
          WHERE booking_id = $1
            AND room_id = $2`,
        [bookingId, ids.room],
      );
      expect(tasks.rows).toHaveLength(1);
      expect(tasks.rows[0]?.type).toBe('TURNOVER');
      expect(tasks.rows[0]?.status).toBe('DUE');
      expect(tasks.rows[0]?.due_at.toISOString()).toBe(checkedOutAt.toISOString());
      expect(tasks.rows[0]?.reminder_at).toBeNull();
    });

    it('15. duplicate check-out is rejected', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.checkIn(actor, bookingCode, new Date('2027-02-10T04:00:00.000Z'));
      await fixture.service.checkOut(actor, bookingCode, new Date('2027-02-10T05:00:00.000Z'));
      await expect(fixture.service.checkOut(actor, bookingCode, new Date())).rejects.toBeInstanceOf(
        BookingTransitionError,
      );
    });

    it('rejects check-in when payment has not succeeded', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {});
      await confirmBooking(fixture.database, bookingId);
      await expect(
        fixture.service.checkIn(actor, bookingCode, new Date('2027-02-10T04:00:00.000Z')),
      ).rejects.toBeInstanceOf(BookingTransitionError);
    });
  });

  describe('No-show', () => {
    it('10. no-show before expected check-in is rejected', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        checkIn: new Date('2027-03-10T04:00:00.000Z'),
        checkOut: new Date('2027-03-10T07:00:00.000Z'),
      });
      await confirmBooking(fixture.database, bookingId);
      await expect(
        fixture.service.markNoShow(
          actor,
          bookingCode,
          { reason: 'guest absent' },
          new Date('2027-03-09T23:00:00.000Z'),
        ),
      ).rejects.toBeInstanceOf(NoShowBeforeCheckInError);
    });

    it('11. no-show exactly at expected check-in succeeds', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        checkIn: new Date('2027-04-10T04:00:00.000Z'),
        checkOut: new Date('2027-04-10T07:00:00.000Z'),
      });
      await confirmBooking(fixture.database, bookingId);
      const result = await fixture.service.markNoShow(
        actor,
        bookingCode,
        { reason: 'guest absent' },
        new Date('2027-04-10T04:00:00.000Z'),
      );
      expect(result.status).toBe('NO_SHOW');
    });

    it('12. no-show releases inventory', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {});
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.markNoShow(
        actor,
        bookingCode,
        { reason: 'guest absent' },
        new Date('2027-04-10T04:30:00.000Z'),
      );
      const blocks = await fixture.database.pool.query<{ status: string }>(
        `SELECT status FROM room_inventory_blocks WHERE booking_id = $1`,
        [bookingId],
      );
      expect(blocks.rows[0]?.status).toBe('RELEASED');
    });
  });

  describe('Concurrency', () => {
    it('13. cancel vs check-in race has exactly one winner', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {});
      await confirmBooking(fixture.database, bookingId);

      const [clientA, clientB] = await Promise.all([
        fixture.pool.connect(),
        fixture.pool.connect(),
      ]);
      const runner = async (
        client: DatabasePoolClient,
        runner: 'cancel' | 'check-in',
      ): Promise<{ outcome: 'ok' | 'err'; error?: string }> => {
        try {
          await client.query('BEGIN');
          const lock = await client.query<{ status: string }>(
            `SELECT status FROM bookings WHERE booking_code = $1 FOR UPDATE`,
            [bookingCode],
          );
          if (lock.rows[0]?.status !== 'CONFIRMED') {
            await client.query('ROLLBACK');
            return { outcome: 'err', error: 'WRONG_STATE' };
          }
          if (runner === 'cancel') {
            await client.query(
              `UPDATE bookings SET status = 'CANCELLED', cancelled_at = now(), cancellation_reason = 'race-cancel' WHERE booking_code = $1`,
              [bookingCode],
            );
            await client.query(
              `UPDATE room_inventory_blocks SET status = 'RELEASED', released_at = now() WHERE booking_id = $1 AND status = 'ACTIVE'`,
              [bookingId],
            );
          } else {
            await client.query(
              `UPDATE bookings SET status = 'CHECKED_IN', checked_in_at = now() WHERE booking_code = $1`,
              [bookingCode],
            );
          }
          await client.query('COMMIT');
          return { outcome: 'ok' };
        } catch (caught) {
          await client.query('ROLLBACK').catch(() => undefined);
          return { outcome: 'err', error: String((caught as Error).message ?? '') };
        } finally {
          client.release();
        }
      };

      const [a, b] = await Promise.all([runner(clientA, 'cancel'), runner(clientB, 'check-in')]);
      const winners = [a, b].filter((r) => r.outcome === 'ok').length;
      const losers = [a, b].filter((r) => r.outcome === 'err').length;
      expect(winners).toBe(1);
      expect(losers).toBeGreaterThanOrEqual(1);

      const finalState = await fixture.database.pool.query<{ status: string }>(
        `SELECT status FROM bookings WHERE id = $1`,
        [bookingId],
      );
      expect(['CANCELLED', 'CHECKED_IN']).toContain(finalState.rows[0]?.status);
    });

    it('14. check-in vs no-show race has exactly one winner', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {});
      await confirmBooking(fixture.database, bookingId);
      const [clientA, clientB] = await Promise.all([
        fixture.pool.connect(),
        fixture.pool.connect(),
      ]);
      const transition = async (
        client: DatabasePoolClient,
        target: 'CHECKED_IN' | 'NO_SHOW',
      ): Promise<'ok' | 'err'> => {
        try {
          await client.query('BEGIN');
          const lock = await client.query<{ status: string }>(
            `SELECT status FROM bookings WHERE booking_code = $1 FOR UPDATE`,
            [bookingCode],
          );
          if (lock.rows[0]?.status !== 'CONFIRMED') {
            await client.query('ROLLBACK');
            return 'err';
          }
          if (target === 'CHECKED_IN') {
            await client.query(
              `UPDATE bookings SET status = 'CHECKED_IN', checked_in_at = now() WHERE booking_code = $1`,
              [bookingCode],
            );
          } else {
            await client.query(
              `UPDATE bookings SET status = 'NO_SHOW', no_show_at = now() WHERE booking_code = $1`,
              [bookingCode],
            );
          }
          await client.query('COMMIT');
          return 'ok';
        } catch {
          await client.query('ROLLBACK').catch(() => undefined);
          return 'err';
        } finally {
          client.release();
        }
      };
      const [a, b] = await Promise.all([
        transition(clientA, 'CHECKED_IN'),
        transition(clientB, 'NO_SHOW'),
      ]);
      const winners = [a, b].filter((r) => r === 'ok').length;
      expect(winners).toBe(1);
      const finalState = await fixture.database.pool.query<{ status: string }>(
        `SELECT status FROM bookings WHERE id = $1`,
        [bookingId],
      );
      expect(['CHECKED_IN', 'NO_SHOW']).toContain(finalState.rows[0]?.status);
    });
  });

  describe('Audit / rollback', () => {
    it('17. audit failure rolls back the complete mutation', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {});
      const client = await fixture.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE bookings SET status = 'CANCELLED', cancelled_at = now(), cancellation_reason = $2 WHERE booking_code = $1`,
          [bookingCode, 'audit rollback'],
        );
        // Force an audit-insert failure with a NULL event_type
        await client.query(
          `INSERT INTO audit_events (property_id, aggregate_type, aggregate_id, event_type, actor_type, payload)
           VALUES ($1, 'BOOKING', $2, NULL, 'ADMIN', '{}'::jsonb)`,
          [ids.property, bookingId],
        );
        await client.query('COMMIT');
      } catch (caught) {
        await client.query('ROLLBACK').catch(() => undefined);
        void caught;
      } finally {
        client.release();
      }
      const state = await fixture.database.pool.query<{
        status: string;
        cancellation_reason: string | null;
      }>(`SELECT status, cancellation_reason FROM bookings WHERE id = $1`, [bookingId]);
      expect(state.rows[0]?.status).toBe('HOLD');
      expect(state.rows[0]?.cancellation_reason).toBeNull();
    });
  });

  describe('Operational reviews', () => {
    it('18. review resolution is idempotent', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      const reviewResult = await fixture.database.pool.query<{ id: string }>(
        `SELECT id FROM operational_reviews WHERE booking_id = $1`,
        [bookingId],
      );
      const reviewId = reviewResult.rows[0]?.id;
      if (reviewId === undefined) throw new Error('Expected an OPEN review');
      await fixture.service.resolveOperationalReview(
        actor,
        reviewId,
        { note: 'Refund issued offline' },
        new Date(),
      );
      await expect(
        fixture.service.resolveOperationalReview(
          actor,
          reviewId,
          { note: 'second attempt' },
          new Date(),
        ),
      ).rejects.toBeInstanceOf(OperationalReviewAlreadyResolvedError);
    });

    it('19. concurrent review resolution has exactly one winner', async () => {
      const { bookingCode, bookingId } = await insertHoldBooking(fixture.database, {
        withPayment: true,
      });
      await confirmBooking(fixture.database, bookingId);
      await fixture.service.cancel(actor, bookingCode, { reason: 'guest illness' }, new Date());
      const reviewResult = await fixture.database.pool.query<{ id: string }>(
        `SELECT id FROM operational_reviews WHERE booking_id = $1`,
        [bookingId],
      );
      const reviewId = reviewResult.rows[0]?.id;
      if (reviewId === undefined) throw new Error('Expected an OPEN review');

      const resolve = async (client: DatabasePoolClient, note: string): Promise<'ok' | 'err'> => {
        try {
          await client.query('BEGIN');
          const lock = await client.query<{ status: string }>(
            `SELECT status FROM operational_reviews WHERE id = $1 FOR UPDATE`,
            [reviewId],
          );
          if (lock.rows[0]?.status !== 'OPEN') {
            await client.query('ROLLBACK');
            return 'err';
          }
          await client.query(
            `UPDATE operational_reviews
                SET status = 'RESOLVED', resolved_at = now(), resolver_id = $2, resolved_note = $3
              WHERE id = $1`,
            [reviewId, ids.admin, note],
          );
          await client.query('COMMIT');
          return 'ok';
        } catch {
          await client.query('ROLLBACK').catch(() => undefined);
          return 'err';
        } finally {
          client.release();
        }
      };
      const [a, b] = await Promise.all([
        resolve(await fixture.pool.connect(), 'note A'),
        resolve(await fixture.pool.connect(), 'note B'),
      ]);
      const winners = [a, b].filter((r) => r === 'ok').length;
      expect(winners).toBe(1);
    });

    it('reports not-found errors cleanly', async () => {
      await expect(
        fixture.service.getOperationalReviewDetail(randomUUID(), new Date(), ids.property),
      ).rejects.toBeInstanceOf(OperationalReviewNotFoundError);
    });
  });

  describe('Read / contact integrity', () => {
    it('does not disclose an existing booking through a different property scope', async () => {
      const { bookingCode } = await insertHoldBooking(fixture.database, {});
      await expect(
        fixture.service.getDetail(bookingCode, new Date(), '660e8400-e29b-41d4-a716-446655440199'),
      ).rejects.toBeInstanceOf(BookingNotFoundError);
    });

    it('20. historical bookings remain readable with null timestamps', async () => {
      const { bookingCode } = await insertHoldBooking(fixture.database, {
        bookingId: randomUUID(),
      });
      const detail = await fixture.service.getDetail(bookingCode, new Date(), ids.property);
      expect(detail.bookingCode).toBe(bookingCode);
    });

    it('21. contact snapshots remain immutable after a transition', async () => {
      const { bookingCode } = await insertHoldBooking(fixture.database, {});
      const detail = await fixture.service.getDetail(bookingCode, new Date(), ids.property);
      const originalEmail = detail.contact.emailMasked;
      await fixture.service.cancel(actor, bookingCode, { reason: 'irrelevant' }, new Date());
      const reread = await fixture.service.getDetail(bookingCode, new Date(), ids.property);
      expect(reread.contact.emailMasked).toBe(originalEmail);
      expect(reread.status).toBe('CANCELLED');
    });
  });

  describe('Booking date filtering', () => {
    it('includes both local-day boundaries and excludes the next local midnight', async () => {
      const start = await insertHoldBooking(fixture.database, {
        bookingCode: 'TEST-DATE-START',
        checkIn: new Date('2026-08-05T17:00:00.000Z'),
        checkOut: new Date('2026-08-05T18:00:00.000Z'),
      });
      const end = await insertHoldBooking(fixture.database, {
        bookingCode: 'TEST-DATE-END',
        checkIn: new Date('2026-08-06T16:59:00.000Z'),
        checkOut: new Date('2026-08-06T17:00:00.000Z'),
      });
      const nextDay = await insertHoldBooking(fixture.database, {
        bookingCode: 'TEST-DATE-NEXT',
        checkIn: new Date('2026-08-06T17:00:00.000Z'),
        checkOut: new Date('2026-08-06T18:00:00.000Z'),
      });

      const result = await fixture.service.listBookings(
        ids.property,
        {
          page: 1,
          pageSize: 100,
          checkInFrom: '2026-08-06',
          checkInTo: '2026-08-06',
        },
        'Asia/Ho_Chi_Minh',
      );

      expect(result.items.map((item) => item.bookingCode)).toEqual(
        expect.arrayContaining([start.bookingCode, end.bookingCode]),
      );
      expect(result.items.map((item) => item.bookingCode)).not.toContain(nextDay.bookingCode);
      expect(result.totalItems).toBe(2);
    });

    it('supports from-only and to-only local calendar filters', async () => {
      const before = await insertHoldBooking(fixture.database, {
        bookingCode: 'TEST-DATE-BEFORE',
        checkIn: new Date('2026-08-05T16:59:00.000Z'),
        checkOut: new Date('2026-08-05T17:00:00.000Z'),
      });
      const after = await insertHoldBooking(fixture.database, {
        bookingCode: 'TEST-DATE-AFTER',
        checkIn: new Date('2026-08-07T17:00:00.000Z'),
        checkOut: new Date('2026-08-07T18:00:00.000Z'),
      });

      const fromOnly = await fixture.service.listBookings(
        ids.property,
        { page: 1, pageSize: 100, checkInFrom: '2026-08-06' },
        'Asia/Ho_Chi_Minh',
      );
      const toOnly = await fixture.service.listBookings(
        ids.property,
        { page: 1, pageSize: 100, checkInTo: '2026-08-06' },
        'Asia/Ho_Chi_Minh',
      );

      expect(fromOnly.items.map((item) => item.bookingCode)).toContain(after.bookingCode);
      expect(fromOnly.items.map((item) => item.bookingCode)).not.toContain(before.bookingCode);
      expect(toOnly.items.map((item) => item.bookingCode)).toContain(before.bookingCode);
      expect(toOnly.items.map((item) => item.bookingCode)).not.toContain(after.bookingCode);
    });
  });

  describe('Not-found', () => {
    it('rejects operations on a missing booking with BookingNotFoundError', async () => {
      await expect(
        fixture.service.cancel(actor, 'TEST-MISSING-1', { reason: 'noop' }, new Date()),
      ).rejects.toBeInstanceOf(BookingNotFoundError);
    });
  });
});
