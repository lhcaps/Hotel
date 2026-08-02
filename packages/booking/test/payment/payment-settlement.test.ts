import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { migrateDatabase } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import * as booking from '../../src/index.js';
import { normalizeContact } from '../../src/contact.js';
import {
  seedBookingHoldFixture,
  seedConsumedExpiredBooking,
} from '../fixtures/booking-hold-fixtures.js';

const paymentCore = booking as typeof booking & {
  createPaymentAttempt(input: {
    pool: GuardedTestDatabase['pool'];
    propertyId: string;
    bookingId: string;
    provider: 'MOMO';
    idempotencyKey: string;
    now: Date;
  }): Promise<{ providerOrderId: string }>;
  markPaymentAttemptInitiationUnknown(input: {
    pool: GuardedTestDatabase['pool'];
    provider: 'MOMO';
    providerOrderId: string;
    requestId: string;
  }): Promise<void>;
  applyVerifiedPaymentEvent(input: {
    pool: GuardedTestDatabase['pool'];
    provider: 'MOMO';
    eventKey: string;
    providerOrderId: string;
    providerTransactionId: string;
    normalizedOutcome: 'SUCCEEDED';
    amountVnd: bigint;
    currency: 'VND';
    occurredAt: Date;
    rawBodyDigest: Buffer;
    verificationMarker: 'VERIFIED_BY_ADAPTER';
  }): Promise<{ processingStatus: string }>;
  confirmNoChargeBooking(input: {
    pool: GuardedTestDatabase['pool'];
    propertyId: string;
    bookingId: string;
    idempotencyKey: string;
    actor: { type: 'SYSTEM'; requestId: string };
  }): Promise<{ paymentId: string; confirmationSource: string }>;
};

describe('verified payment settlement', () => {
  let database: GuardedTestDatabase | undefined;

  afterEach(async () => {
    await database?.dispose();
    database = undefined;
  });

  it('preserves a timed-out provider order for a later verified success', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Unknown Outcome', email: 'unknown-outcome@example.test', phone: '+84901234570' },
      Buffer.alloc(32, 25),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'unknown-outcome-attempt-001',
      now: new Date(),
    });

    await paymentCore.markPaymentAttemptInitiationUnknown({
      pool: database.pool,
      provider: 'MOMO',
      providerOrderId: attempt.providerOrderId,
      requestId: 'unknown-outcome-request-001',
    });

    await expect(
      database.pool.query<{ status: string; review_code: string }>(
        'SELECT status, review_code FROM payment_attempts WHERE provider_order_id = $1',
        [attempt.providerOrderId],
      ),
    ).resolves.toMatchObject({
      rows: [{ status: 'REVIEW_REQUIRED', review_code: 'MOMO_INITIATION_OUTCOME_UNKNOWN' }],
    });
    await expect(
      paymentCore.applyVerifiedPaymentEvent({
        pool: database.pool,
        provider: 'MOMO',
        eventKey: 'unknown-outcome-event-001',
        providerOrderId: attempt.providerOrderId,
        providerTransactionId: 'momo-unknown-outcome-001',
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: 359000n,
        currency: 'VND',
        occurredAt: new Date(),
        rawBodyDigest: Buffer.alloc(32, 25),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
    ).resolves.toEqual({ processingStatus: 'PROCESSED' });
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'CONFIRMED' }] });
  });

  it('atomically succeeds the payment, confirms the HOLD, and writes settlement outbox records', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Settlement Fixture', email: 'settlement@example.test', phone: '+84901234569' },
      Buffer.alloc(32, 3),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'settle-attempt-001',
      now: new Date(),
    });

    const result = await paymentCore.applyVerifiedPaymentEvent({
      pool: database.pool,
      provider: 'MOMO',
      eventKey: 'settle-event-001',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'momo-transaction-001',
      normalizedOutcome: 'SUCCEEDED',
      amountVnd: 359000n,
      currency: 'VND',
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 4),
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });

    expect(result.processingStatus).toBe('PROCESSED');
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'CONFIRMED' }] });
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM payments WHERE booking_id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'SUCCEEDED' }] });
    await expect(
      database.pool.query<{
        type: string;
        status: string;
        due_at: Date;
        reminder_at: Date;
      }>(
        `SELECT type, status, due_at, reminder_at
           FROM housekeeping_tasks
          WHERE booking_id = $1`,
        [held.bookingId],
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          type: 'ARRIVAL_PREP',
          status: 'SCHEDULED',
        },
      ],
    });
    const outbox = await database.pool.query<{ event_type: string }>(
      `SELECT event_type FROM outbox_events WHERE property_id = $1 ORDER BY event_type`,
      [seeded.propertyId],
    );
    expect(outbox.rows.map((row) => row.event_type)).toEqual(
      expect.arrayContaining(['payment.succeeded', 'booking.confirmed']),
    );
  });

  it('redeems the already-reserved coupon in the same verified-success settlement', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      {
        fullName: 'Coupon Settlement',
        email: 'coupon-settlement@example.test',
        phone: '+84901234560',
      },
      Buffer.alloc(32, 5),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const couponId = randomUUID();
    await database.pool.query(
      `INSERT INTO coupons
         (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd,
          percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd,
          valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'PAYMENT-COUPON', 'ACTIVE', 'FIXED', 1000, NULL, NULL, 0,
               CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '1 day', true, 10, NULL)`,
      [couponId, seeded.propertyId],
    );
    // The Phase 5 fixture creates an immutable non-coupon quote. This test
    // exercises payment settlement against the persisted coupon lifecycle,
    // so it follows the existing redemption test fixture's disposable-DB
    // trigger bypass rather than mutating that immutable quote/booking.
    await database.pool.query(
      'ALTER TABLE booking_coupon_applications DISABLE TRIGGER booking_coupon_applications_validate_insert',
    );
    await database.pool.query(
      `INSERT INTO booking_coupon_applications
         (property_id, booking_id, coupon_id, customer_email_digest, application_status, quota_reserved,
          discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, reserved_at)
       VALUES ($1, $2, $3, $4, 'RESERVED', true, 'FIXED', 1000, NULL, NULL,
               0, 359000, 0, 359000, 'PAYMENT-COUPON', CURRENT_TIMESTAMP)`,
      [seeded.propertyId, held.bookingId, couponId, contact.emailDigest],
    );
    await database.pool.query(
      'ALTER TABLE booking_coupon_applications ENABLE TRIGGER booking_coupon_applications_validate_insert',
    );
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'coupon-attempt-001',
      now: new Date(),
    });

    await paymentCore.applyVerifiedPaymentEvent({
      pool: database.pool,
      provider: 'MOMO',
      eventKey: 'coupon-event-001',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'momo-coupon-001',
      normalizedOutcome: 'SUCCEEDED',
      amountVnd: 359000n,
      currency: 'VND',
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 6),
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });

    await expect(
      database.pool.query<{ application_status: string; redemption_event_key: string | null }>(
        `SELECT application_status, redemption_event_key FROM booking_coupon_applications WHERE booking_id = $1`,
        [held.bookingId],
      ),
    ).resolves.toMatchObject({
      rows: [{ application_status: 'REDEEMED', redemption_event_key: 'coupon-event-001' }],
    });
  });

  it('retains a verified success for a released coupon as COUPON_RELEASED review', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Released Coupon', email: 'released-coupon@example.test', phone: '+84901234568' },
      Buffer.alloc(32, 22),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const couponId = randomUUID();
    await database.pool.query(
      `INSERT INTO coupons
         (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd,
          percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd,
          valid_from, valid_until, applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, 'RELEASED-PAYMENT-COUPON', 'ACTIVE', 'FIXED', 1000, NULL, NULL, 0,
               CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '1 day', true, 10, NULL)`,
      [couponId, seeded.propertyId],
    );
    await database.pool.query(
      'ALTER TABLE booking_coupon_applications DISABLE TRIGGER booking_coupon_applications_validate_insert',
    );
    await database.pool.query(
      `INSERT INTO booking_coupon_applications
         (property_id, booking_id, coupon_id, customer_email_digest, application_status, quota_reserved,
          discount_type, fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
          minimum_order_amount_vnd, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
          coupon_code_snapshot, released_at)
       VALUES ($1, $2, $3, $4, 'RELEASED', false, 'FIXED', 1000, NULL, NULL,
               0, 359000, 0, 359000, 'RELEASED-PAYMENT-COUPON', CURRENT_TIMESTAMP)`,
      [seeded.propertyId, held.bookingId, couponId, contact.emailDigest],
    );
    await database.pool.query(
      'ALTER TABLE booking_coupon_applications ENABLE TRIGGER booking_coupon_applications_validate_insert',
    );
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'released-coupon-attempt',
      now: new Date(),
    });
    await expect(
      paymentCore.applyVerifiedPaymentEvent({
        pool: database.pool,
        provider: 'MOMO',
        eventKey: 'released-coupon-event',
        providerOrderId: attempt.providerOrderId,
        providerTransactionId: 'momo-released-coupon',
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: 359000n,
        currency: 'VND',
        occurredAt: new Date(),
        rawBodyDigest: Buffer.alloc(32, 23),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
    ).resolves.toEqual({ processingStatus: 'REVIEW_REQUIRED' });
    await expect(
      database.pool.query<{ review_code: string }>(
        `SELECT review_code FROM payment_attempts WHERE provider_order_id = $1`,
        [attempt.providerOrderId],
      ),
    ).resolves.toMatchObject({ rows: [{ review_code: 'COUPON_RELEASED' }] });
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'HOLD' }] });
  });

  it('records the same provider event key as an idempotent duplicate without a second confirmation', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Duplicate Fixture', email: 'duplicate@example.test', phone: '+84901234561' },
      Buffer.alloc(32, 7),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'duplicate-attempt-001',
      now: new Date(),
    });
    const event = {
      pool: database.pool,
      provider: 'MOMO' as const,
      eventKey: 'duplicate-event-001',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'momo-duplicate-001',
      normalizedOutcome: 'SUCCEEDED' as const,
      amountVnd: 359000n,
      currency: 'VND' as const,
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 8),
      verificationMarker: 'VERIFIED_BY_ADAPTER' as const,
    };
    await paymentCore.applyVerifiedPaymentEvent(event);
    await expect(paymentCore.applyVerifiedPaymentEvent(event)).resolves.toEqual({
      processingStatus: 'DUPLICATE',
    });
    await expect(
      database.pool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM audit_events WHERE aggregate_id = $1 AND event_type = 'booking.confirmed_by_payment'`,
        [held.bookingId],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('confirms a zero-amount HOLD without creating a provider attempt', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'No Charge Fixture', email: 'no-charge@example.test', phone: '+84901234562' },
      Buffer.alloc(32, 9),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
      baseAmountVnd: 0,
      totalAmountVnd: 0,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });

    const result = await paymentCore.confirmNoChargeBooking({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      idempotencyKey: 'no-charge-001',
      actor: { type: 'SYSTEM', requestId: 'no-charge-request-001' },
    });

    expect(result.confirmationSource).toBe('NO_CHARGE');
    await expect(
      paymentCore.confirmNoChargeBooking({
        pool: database.pool,
        propertyId: seeded.propertyId,
        bookingId: held.bookingId,
        idempotencyKey: 'no-charge-001',
        actor: { type: 'SYSTEM', requestId: 'no-charge-request-002' },
      }),
    ).resolves.toEqual(result);
    await expect(
      paymentCore.confirmNoChargeBooking({
        pool: database.pool,
        propertyId: seeded.propertyId,
        bookingId: held.bookingId,
        idempotencyKey: 'no-charge-conflict',
        actor: { type: 'SYSTEM', requestId: 'no-charge-request-003' },
      }),
    ).rejects.toThrow('PAYMENT_IDEMPOTENCY_CONFLICT');
    await expect(
      database.pool.query<{ status: string; confirmation_source: string }>(
        `SELECT status, confirmation_source FROM payments WHERE id = $1`,
        [result.paymentId],
      ),
    ).resolves.toMatchObject({ rows: [{ status: 'SUCCEEDED', confirmation_source: 'NO_CHARGE' }] });
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'CONFIRMED' }] });
    await expect(
      database.pool.query<{ count: number }>('SELECT count(*)::int AS count FROM payment_attempts'),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it('does not confirm a zero-amount HOLD when its inventory was released', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      {
        fullName: 'No Charge Inventory',
        email: 'no-charge-inventory@example.test',
        phone: '+84901234569',
      },
      Buffer.alloc(32, 24),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
      baseAmountVnd: 0,
      totalAmountVnd: 0,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    await database.pool.query(
      `UPDATE room_inventory_blocks
          SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP
        WHERE booking_id = $1`,
      [held.bookingId],
    );

    await expect(
      paymentCore.confirmNoChargeBooking({
        pool: database.pool,
        propertyId: seeded.propertyId,
        bookingId: held.bookingId,
        idempotencyKey: 'no-charge-released-inventory',
        actor: { type: 'SYSTEM', requestId: 'no-charge-inventory' },
      }),
    ).rejects.toThrow('PAYMENT_INVENTORY_RELEASED');
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'HOLD' }] });
  });

  it('retains an amount-mismatched verified success as REVIEW_REQUIRED without confirming the HOLD', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Review Fixture', email: 'review@example.test', phone: '+84901234563' },
      Buffer.alloc(32, 10),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'review-attempt-001',
      now: new Date(),
    });

    await expect(
      paymentCore.applyVerifiedPaymentEvent({
        pool: database.pool,
        provider: 'MOMO',
        eventKey: 'review-event-001',
        providerOrderId: attempt.providerOrderId,
        providerTransactionId: 'momo-review-001',
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: 1n,
        currency: 'VND',
        occurredAt: new Date(),
        rawBodyDigest: Buffer.alloc(32, 11),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
    ).resolves.toEqual({ processingStatus: 'REVIEW_REQUIRED' });

    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'HOLD' }] });
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM payments WHERE booking_id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'REVIEW_REQUIRED' }] });
    await expect(
      database.pool.query<{ status: string; review_code: string }>(
        'SELECT status, review_code FROM payment_attempts WHERE provider_order_id = $1',
        [attempt.providerOrderId],
      ),
    ).resolves.toMatchObject({
      rows: [{ status: 'REVIEW_REQUIRED', review_code: 'AMOUNT_MISMATCH' }],
    });
    await expect(
      database.pool.query<{ processing_status: string; rejection_code: string }>(
        'SELECT processing_status, rejection_code FROM payment_provider_events WHERE event_key = $1',
        ['review-event-001'],
      ),
    ).resolves.toMatchObject({
      rows: [{ processing_status: 'REVIEW_REQUIRED', rejection_code: 'AMOUNT_MISMATCH' }],
    });
  });

  it('records a verified failed attempt without changing the payment aggregate or HOLD', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Failed Fixture', email: 'failed@example.test', phone: '+84901234564' },
      Buffer.alloc(32, 12),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'failed-attempt-001',
      now: new Date(),
    });
    await expect(
      paymentCore.applyVerifiedPaymentEvent({
        pool: database.pool,
        provider: 'MOMO',
        eventKey: 'failed-event-001',
        providerOrderId: attempt.providerOrderId,
        providerTransactionId: 'momo-failed-001',
        normalizedOutcome: 'FAILED',
        amountVnd: 359000n,
        currency: 'VND',
        occurredAt: new Date(),
        rawBodyDigest: Buffer.alloc(32, 13),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
    ).resolves.toEqual({ processingStatus: 'PROCESSED' });
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'HOLD' }] });
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM payments WHERE booking_id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'PENDING' }] });
    await expect(
      database.pool.query<{ status: string; failure_code: string }>(
        'SELECT status, failure_code FROM payment_attempts WHERE provider_order_id = $1',
        [attempt.providerOrderId],
      ),
    ).resolves.toMatchObject({ rows: [{ status: 'FAILED', failure_code: 'PROVIDER_FAILED' }] });
  });

  it('records a repeated provider transaction on another attempt as TRANSACTION_CONFLICT', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Transaction Fixture', email: 'transaction@example.test', phone: '+84901234565' },
      Buffer.alloc(32, 14),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const first = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'transaction-attempt-001',
      now: new Date(),
    });
    const second = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'transaction-attempt-002',
      now: new Date(),
    });
    await paymentCore.applyVerifiedPaymentEvent({
      pool: database.pool,
      provider: 'MOMO',
      eventKey: 'transaction-event-001',
      providerOrderId: first.providerOrderId,
      providerTransactionId: 'momo-shared-transaction',
      normalizedOutcome: 'SUCCEEDED',
      amountVnd: 359000n,
      currency: 'VND',
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 15),
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });
    await expect(
      paymentCore.applyVerifiedPaymentEvent({
        pool: database.pool,
        provider: 'MOMO',
        eventKey: 'transaction-event-002',
        providerOrderId: second.providerOrderId,
        providerTransactionId: 'momo-shared-transaction',
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: 359000n,
        currency: 'VND',
        occurredAt: new Date(),
        rawBodyDigest: Buffer.alloc(32, 16),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
    ).resolves.toEqual({ processingStatus: 'REVIEW_REQUIRED' });
    await expect(
      database.pool.query<{ review_code: string }>(
        'SELECT review_code FROM payment_attempts WHERE provider_order_id = $1',
        [second.providerOrderId],
      ),
    ).resolves.toMatchObject({ rows: [{ review_code: 'TRANSACTION_CONFLICT' }] });
  });

  it('does not confirm a HOLD whose booking inventory block was released', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Inventory Fixture', email: 'inventory@example.test', phone: '+84901234566' },
      Buffer.alloc(32, 18),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    await database.pool.query(
      `UPDATE room_inventory_blocks
          SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP
        WHERE booking_id = $1`,
      [held.bookingId],
    );
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'inventory-attempt-001',
      now: new Date(),
    });
    await expect(
      paymentCore.applyVerifiedPaymentEvent({
        pool: database.pool,
        provider: 'MOMO',
        eventKey: 'inventory-event-001',
        providerOrderId: attempt.providerOrderId,
        providerTransactionId: 'momo-inventory-001',
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: 359000n,
        currency: 'VND',
        occurredAt: new Date(),
        rawBodyDigest: Buffer.alloc(32, 19),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
    ).resolves.toEqual({ processingStatus: 'REVIEW_REQUIRED' });
    await expect(
      database.pool.query<{ review_code: string }>(
        'SELECT review_code FROM payment_attempts WHERE provider_order_id = $1',
        [attempt.providerOrderId],
      ),
    ).resolves.toMatchObject({ rows: [{ review_code: 'INVENTORY_RELEASED' }] });
  });

  it('records a verified success after HOLD expiry as BOOKING_EXPIRED without resurrecting the booking', async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const contact = normalizeContact(
      { fullName: 'Late Fixture', email: 'late@example.test', phone: '+84901234567' },
      Buffer.alloc(32, 20),
    );
    const seeded = await seedBookingHoldFixture(database.pool, {
      quoteId: randomUUID(),
      contact,
      singleAvailableRoom: true,
    });
    const held = await seedConsumedExpiredBooking(database.pool, {
      quoteId: seeded.quoteId,
      propertyId: seeded.propertyId,
      roomTypeId: seeded.roomTypeId,
      roomId: seeded.roomId,
      contact,
    });
    const attempt = await paymentCore.createPaymentAttempt({
      pool: database.pool,
      propertyId: seeded.propertyId,
      bookingId: held.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'late-attempt-001',
      now: new Date(),
    });
    await database.pool.query(
      `UPDATE bookings SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [held.bookingId],
    );
    await database.pool.query(
      `UPDATE room_inventory_blocks SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE booking_id = $1`,
      [held.bookingId],
    );
    await expect(
      paymentCore.applyVerifiedPaymentEvent({
        pool: database.pool,
        provider: 'MOMO',
        eventKey: 'late-event-001',
        providerOrderId: attempt.providerOrderId,
        providerTransactionId: 'momo-late-001',
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: 359000n,
        currency: 'VND',
        occurredAt: new Date(),
        rawBodyDigest: Buffer.alloc(32, 21),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
    ).resolves.toEqual({ processingStatus: 'REVIEW_REQUIRED' });
    await expect(
      database.pool.query<{ review_code: string }>(
        'SELECT review_code FROM payment_attempts WHERE provider_order_id = $1',
        [attempt.providerOrderId],
      ),
    ).resolves.toMatchObject({ rows: [{ review_code: 'BOOKING_EXPIRED' }] });
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        held.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'EXPIRED' }] });
  });
});
