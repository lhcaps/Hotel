import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '@room/database';
import { createDatabasePool, migrateDatabase } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import type { OutboxEventSeed } from './outbox-types.js';

export interface OutboxFixture {
  readonly database: GuardedTestDatabase;
  readonly pool: DatabasePool;
  createPool(applicationName: string): DatabasePool;
  close(): Promise<void>;
}

export interface HoldBookingOptions {
  readonly propertyName?: string;
  readonly roomTypeName?: string;
  readonly bookingStatus?: 'HOLD' | 'EXPIRED' | 'CONFIRMED' | 'CANCELLED';
  readonly expiredAt?: Date | null;
  readonly contact?: {
    readonly fullName?: string;
    readonly normalizedEmail?: string;
    readonly normalizedPhoneE164?: string;
  } | null;
  readonly finalAmountVnd?: number;
  readonly currency?: string;
  readonly checkIn?: Date;
  readonly checkOut?: Date;
  readonly holdExpiresAt?: Date;
}

export interface SeededBookingHold {
  readonly bookingId: string;
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly recipientEmail: string;
}

export async function createOutboxFixture(): Promise<OutboxFixture> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (baseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL is required');
  }
  const database = await createPreparedGuardedTestDatabase(baseUrl, async (guarded) => {
    await migrateDatabase(guarded.databaseUrl);
  });
  const pool = createDatabasePool(database.databaseUrl, {
    max: 8,
    applicationName: 'task6-fixture',
  });
  const extraPools: DatabasePool[] = [];

  return {
    database,
    pool,
    createPool(applicationName) {
      const result = createDatabasePool(database.databaseUrl, { max: 2, applicationName });
      extraPools.push(result);
      return result;
    },
    async close() {
      await Promise.all(extraPools.map((extraPool) => extraPool.end()));
      await pool.end();
      await database.dispose();
    },
  };
}

export async function seedBookingHold(
  pool: DatabasePool,
  options: HoldBookingOptions = {},
): Promise<SeededBookingHold> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const bookingId = randomUUID();
  const status = options.bookingStatus ?? 'HOLD';
  const recipientEmail = options.contact?.normalizedEmail ?? 'guest@example.test';
  const defaultCheckIn = new Date('2027-01-10T04:00:00.000Z');
  const defaultCheckOut = new Date('2027-01-10T07:00:00.000Z');
  const defaultHoldExpiresAt = new Date('2027-01-10T03:45:00.000Z');
  const checkIn = options.checkIn ?? defaultCheckIn;
  const checkOut = options.checkOut ?? defaultCheckOut;
  const holdExpiresAt = options.holdExpiresAt ?? defaultHoldExpiresAt;

  await pool.query(
    `INSERT INTO properties (id, code, name, timezone)
     VALUES ($1, $2, $3, 'Asia/Ho_Chi_Minh')`,
    [propertyId, `TASK6_${propertyId.slice(0, 8)}`, options.propertyName ?? 'Task 6 property'],
  );
  await pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
     VALUES ($1, $2, 'TASK6_TIER', 'Task 6 tier', 1)`,
    [tierId, propertyId],
  );
  await pool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
     VALUES ($1, $2, $3, 'TASK6_ROOM', $4, 2, 0, 2)`,
    [roomTypeId, propertyId, tierId, options.roomTypeName ?? 'Task 6 room type'],
  );
  await pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number)
     VALUES ($1, $2, $3, 'T6-1')`,
    [roomId, propertyId, roomTypeId],
  );
  await pool.query(
    `INSERT INTO bookings
       (id, property_id, room_type_id, room_id, booking_code, status,
        check_in, check_out, adults, children, currency,
        gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
        price_snapshot, hold_expires_at, expired_at, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6::booking_status,
        $7, $8, 1, 0, $9,
        $10, 0, $10,
        '{"source":"task6"}'::jsonb,
        $11, $12, CURRENT_TIMESTAMP - interval '2 days', CURRENT_TIMESTAMP - interval '2 days')`,
    [
      bookingId,
      propertyId,
      roomTypeId,
      roomId,
      `TASK6-${bookingId.slice(0, 8)}`,
      status,
      checkIn,
      checkOut,
      options.currency ?? 'VND',
      BigInt(options.finalAmountVnd ?? 1_000_000),
      holdExpiresAt,
      options.expiredAt ?? null,
    ],
  );

  if (options.contact !== null) {
    const emailDigest = Buffer.alloc(32, 1);
    await pool.query(
      `INSERT INTO booking_contacts
         (id, booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        bookingId,
        options.contact?.fullName ?? 'Nguyen Van A',
        recipientEmail,
        options.contact?.normalizedPhoneE164 ?? '+84901234567',
        emailDigest,
      ],
    );
  }

  return {
    bookingId,
    propertyId,
    roomTypeId,
    roomId,
    recipientEmail,
  };
}

export async function seedOutboxEvent(pool: DatabasePool, seed: OutboxEventSeed): Promise<void> {
  await pool.query(
    `INSERT INTO outbox_events
       (id, property_id, aggregate_type, aggregate_id, event_type, payload,
        status, attempt_count, available_at, published_at,
        lease_id, claimed_at, lease_expires_at, last_error_category)
     VALUES
       ($1, NULL, $2, $3, $4, $5::jsonb,
        $6, $7, $8, $9,
        $10, $11, $12, $13)`,
    [
      seed.id,
      seed.aggregateType ?? 'BOOKING',
      seed.aggregateId,
      seed.eventType,
      JSON.stringify(seed.payload ?? {}),
      seed.status ?? 'PENDING',
      seed.attemptCount ?? 0,
      seed.availableAt ?? new Date(),
      seed.publishedAt ?? null,
      seed.leaseId ?? null,
      seed.claimedAt ?? null,
      seed.leaseExpiresAt ?? null,
      seed.lastErrorCategory ?? null,
    ],
  );
}

export async function readOutboxEvent(
  pool: DatabasePool,
  id: string,
): Promise<{
  status: string;
  attemptCount: number;
  availableAt: Date;
  publishedAt: Date | null;
  leaseId: string | null;
  claimedAt: Date | null;
  leaseExpiresAt: Date | null;
  lastErrorCategory: string | null;
} | null> {
  const result = await pool.query<{
    status: string;
    attempt_count: number;
    available_at: Date;
    published_at: Date | null;
    lease_id: string | null;
    claimed_at: Date | null;
    lease_expires_at: Date | null;
    last_error_category: string | null;
  }>(
    `SELECT status, attempt_count, available_at, published_at,
            lease_id, claimed_at, lease_expires_at, last_error_category
       FROM outbox_events WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    status: row.status,
    attemptCount: row.attempt_count,
    availableAt: row.available_at,
    publishedAt: row.published_at,
    leaseId: row.lease_id,
    claimedAt: row.claimed_at,
    leaseExpiresAt: row.lease_expires_at,
    lastErrorCategory: row.last_error_category,
  };
}

export interface SeedOtpChallengeOptions {
  readonly bookingId: string;
  readonly emailDigest?: Buffer;
  readonly nonce?: Buffer;
  readonly requestIpDigest?: Buffer;
  readonly challengeRefDigest?: Buffer;
  readonly attempts?: number;
  readonly expiresAt: Date;
  readonly consumedAt?: Date | null;
  readonly replacedAt?: Date | null;
  readonly createdAt?: Date;
}

export async function seedOtpChallenge(
  pool: DatabasePool,
  options: SeedOtpChallengeOptions,
): Promise<string> {
  const id = randomUUID();
  // Match the contact email digest produced by seedBookingHold when no
  // override is supplied, so default OTP fixture state lines up.
  const emailDigest = options.emailDigest ?? Buffer.alloc(32, 0x01);
  const nonce = options.nonce ?? Buffer.alloc(32, 0x11);
  const requestIpDigest = options.requestIpDigest ?? Buffer.alloc(32, 0x22);
  const challengeRefDigest = options.challengeRefDigest ?? Buffer.alloc(32, 0x33);
  // If the caller wants to insert a challenge with an "already expired"
  // expires_at, they can pass an explicit createdAt in the past so the
  // expires_at > created_at CHECK constraint still holds.
  const createdAt = options.createdAt ?? new Date();
  await pool.query(
    `INSERT INTO guest_otp_challenges
       (id, booking_id, nonce, email_digest, request_ip_digest, challenge_ref_digest,
        attempts, max_attempts, expires_at, consumed_at, replaced_at, created_at)
     VALUES
       ($1, $2, $3, $4, $5, $6,
        $7, 5, $8, $9, $10, $11)`,
    [
      id,
      options.bookingId,
      nonce,
      emailDigest,
      requestIpDigest,
      challengeRefDigest,
      options.attempts ?? 0,
      options.expiresAt,
      options.consumedAt ?? null,
      options.replacedAt ?? null,
      createdAt,
    ],
  );
  return id;
}
