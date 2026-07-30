import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardedTestDatabase } from '../../src/testing.js';
import {
  IDS,
  createMigratedTestDatabase,
  insertBooking,
  insertCatalogFixture,
  postgresErrorCode,
} from './helpers.js';

const QUOTE_INSERT = `
  INSERT INTO quotes
    (id, property_id, room_type_id, check_in, check_out, adults, children,
     currency, base_amount_vnd, extra_amount_vnd, total_amount_vnd,
     pricing_snapshot, expires_at)
  VALUES ($1, $2, $3, '2027-01-10T04:00:00.000Z', '2027-01-10T07:00:00.000Z', 1, 0,
          'VND', 359000, 0, 359000, $4::jsonb, CURRENT_TIMESTAMP + interval '15 minutes')
`;

const DIGEST32 = Buffer.alloc(32, 7);
const DIGEST31 = Buffer.alloc(31, 7);
const DIGEST33 = Buffer.alloc(33, 7);

async function insertQuote(pool: GuardedTestDatabase['pool'], id: string): Promise<void> {
  await pool.query(QUOTE_INSERT, [
    id,
    IDS.property,
    IDS.roomType,
    JSON.stringify({ ruleVersion: 'phase-4-pricing-availability-v1', totalAmountVnd: 359000 }),
  ]);
}

async function insertTestBooking(
  pool: GuardedTestDatabase['pool'],
  overrides: Parameters<typeof insertBooking>[1] = {},
): Promise<string> {
  const id = overrides.id ?? randomUUID();
  await insertBooking(pool, { ...overrides, id });
  return id;
}

async function insertContact(
  pool: GuardedTestDatabase['pool'],
  bookingId: string,
  overrides: {
    readonly fullName?: string;
    readonly normalizedEmail?: string;
    readonly normalizedPhoneE164?: string;
    readonly emailDigest?: Buffer;
  } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO booking_contacts
       (id, booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      randomUUID(),
      bookingId,
      overrides.fullName ?? 'Nguyen Van A',
      overrides.normalizedEmail ?? 'guest@example.test',
      overrides.normalizedPhoneE164 ?? '+84901234567',
      overrides.emailDigest ?? DIGEST32,
    ],
  );
}

async function insertOtpChallenge(
  pool: GuardedTestDatabase['pool'],
  bookingId: string,
  overrides: {
    readonly id?: string;
    readonly nonce?: Buffer;
    readonly emailDigest?: Buffer;
    readonly requestIpDigest?: Buffer;
    readonly challengeRefDigest?: Buffer;
    readonly attempts?: number;
    readonly maxAttempts?: number;
    readonly expiresAt?: string;
    readonly createdAt?: string;
    readonly consumedAt?: string | null;
    readonly replacedAt?: string | null;
  } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO guest_otp_challenges
       (id, booking_id, nonce, email_digest, request_ip_digest, challenge_ref_digest,
        attempts, max_attempts, expires_at, consumed_at, replaced_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      overrides.id ?? randomUUID(),
      bookingId,
      overrides.nonce ?? DIGEST32,
      overrides.emailDigest ?? DIGEST32,
      overrides.requestIpDigest ?? DIGEST32,
      overrides.challengeRefDigest ?? DIGEST32,
      overrides.attempts ?? 0,
      overrides.maxAttempts ?? 5,
      overrides.expiresAt ?? '2026-12-01T00:10:00.000Z',
      overrides.consumedAt ?? null,
      overrides.replacedAt ?? null,
      overrides.createdAt ?? '2026-12-01T00:00:00.000Z',
    ],
  );
}

async function insertGuestSession(
  pool: GuardedTestDatabase['pool'],
  bookingId: string,
  overrides: {
    readonly tokenDigest?: Buffer;
    readonly createdIpDigest?: Buffer | null;
    readonly expiresAt?: string;
    readonly createdAt?: string;
  } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO guest_sessions
       (id, booking_id, token_digest, expires_at, created_ip_digest, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      randomUUID(),
      bookingId,
      overrides.tokenDigest ?? DIGEST32,
      overrides.expiresAt ?? '2026-12-01T00:30:00.000Z',
      overrides.createdIpDigest ?? null,
      overrides.createdAt ?? '2026-12-01T00:00:00.000Z',
    ],
  );
}

describe('phase 5 schema integrity', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    database = await createMigratedTestDatabase();
    await insertCatalogFixture(database.pool);
  });

  afterAll(async () => {
    await database.dispose();
  });

  describe('quote relationship', () => {
    it('allows a NULL quote_id for historical rows', async () => {
      await expect(insertTestBooking(database.pool)).resolves.toBeDefined();
    });

    it('accepts one non-null quote and rejects a second booking for the same quote regardless of status', async () => {
      const quoteId = randomUUID();
      await insertQuote(database.pool, quoteId);

      await insertTestBooking(database.pool, {
        quoteId,
        status: 'EXPIRED',
        expiredAt: '2026-12-01T00:16:00.000Z',
      });

      const error = await insertTestBooking(database.pool, { quoteId }).catch(
        (cause: unknown) => cause,
      );
      expect(postgresErrorCode(error)).toBe('23505');
    });

    it('rejects a booking referencing an unknown quote', async () => {
      const error = await insertTestBooking(database.pool, {
        quoteId: randomUUID(),
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(error)).toBe('23503');
    });
  });

  describe('booking immutability widening', () => {
    it('rejects updates to every newly-protected field', async () => {
      const bookingId = await insertTestBooking(database.pool);

      const mutations: ReadonlyArray<[string, unknown]> = [
        ['booking_code', 'RM-2222-2222-2222'],
        ['check_in', '2027-01-10T05:00:00.000Z'],
        ['adults', 2],
        ['currency', 'USD'],
      ];

      for (const [column, value] of mutations) {
        const error = await database.pool
          .query(`UPDATE bookings SET ${column} = $1 WHERE id = $2`, [value, bookingId])
          .catch((cause: unknown) => cause);
        expect(postgresErrorCode(error)).toBe('P0001');
      }
    });

    it('still allows the HOLD to EXPIRED transition while preserving hold_expires_at', async () => {
      const bookingId = await insertTestBooking(database.pool);

      await expect(
        database.pool.query(
          `UPDATE bookings SET status = 'EXPIRED', expired_at = hold_expires_at WHERE id = $1`,
          [bookingId],
        ),
      ).resolves.toMatchObject({ rowCount: 1 });
    });
  });

  describe('booking contacts', () => {
    it('allows exactly one contact per booking and rejects a second', async () => {
      const bookingId = await insertTestBooking(database.pool);
      await insertContact(database.pool, bookingId);

      const error = await insertContact(database.pool, bookingId).catch((cause: unknown) => cause);
      expect(postgresErrorCode(error)).toBe('23505');
    });

    it('rejects UPDATE and DELETE', async () => {
      const bookingId = await insertTestBooking(database.pool);
      await insertContact(database.pool, bookingId);

      const updateError = await database.pool
        .query(`UPDATE booking_contacts SET full_name = 'Changed' WHERE booking_id = $1`, [
          bookingId,
        ])
        .catch((cause: unknown) => cause);
      expect(postgresErrorCode(updateError)).toBe('P0001');

      const deleteError = await database.pool
        .query(`DELETE FROM booking_contacts WHERE booking_id = $1`, [bookingId])
        .catch((cause: unknown) => cause);
      expect(postgresErrorCode(deleteError)).toBe('P0001');
    });

    it('rejects empty normalized fields', async () => {
      const bookingId = await insertTestBooking(database.pool);
      const error = await insertContact(database.pool, bookingId, { fullName: '   ' }).catch(
        (cause: unknown) => cause,
      );
      expect(postgresErrorCode(error)).toBe('23514');
    });

    it('rejects an email digest that is not exactly 32 bytes and accepts one that is', async () => {
      const bookingId = await insertTestBooking(database.pool);

      const tooShort = await insertContact(database.pool, bookingId, {
        emailDigest: DIGEST31,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(tooShort)).toBe('23514');

      const tooLong = await insertContact(database.pool, bookingId, {
        emailDigest: DIGEST33,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(tooLong)).toBe('23514');

      await expect(insertContact(database.pool, bookingId)).resolves.not.toThrow();
    });
  });

  describe('guest otp challenges', () => {
    it('rejects a second active challenge for the same booking', async () => {
      const bookingId = await insertTestBooking(database.pool);
      await insertOtpChallenge(database.pool, bookingId);

      const error = await insertOtpChallenge(database.pool, bookingId).catch(
        (cause: unknown) => cause,
      );
      expect(postgresErrorCode(error)).toBe('23505');
    });

    it('allows a new active challenge once the prior one is consumed or replaced', async () => {
      const bookingId = await insertTestBooking(database.pool);
      const consumedId = randomUUID();
      await insertOtpChallenge(database.pool, bookingId, {
        id: consumedId,
        consumedAt: '2026-12-01T00:05:00.000Z',
      });
      await expect(insertOtpChallenge(database.pool, bookingId)).resolves.not.toThrow();

      await database.pool.query(
        `UPDATE guest_otp_challenges SET replaced_at = CURRENT_TIMESTAMP WHERE booking_id = $1 AND consumed_at IS NULL`,
        [bookingId],
      );
      await expect(insertOtpChallenge(database.pool, bookingId)).resolves.not.toThrow();
    });

    it('rejects a 31-byte nonce and a 33-byte challenge_ref_digest', async () => {
      const bookingId = await insertTestBooking(database.pool);

      const badNonce = await insertOtpChallenge(database.pool, bookingId, {
        nonce: DIGEST31,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(badNonce)).toBe('23514');

      const badChallengeRefDigest = await insertOtpChallenge(database.pool, bookingId, {
        challengeRefDigest: DIGEST33,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(badChallengeRefDigest)).toBe('23514');
    });

    it('enforces attempts and expiry constraints', async () => {
      const bookingId = await insertTestBooking(database.pool);

      const negativeAttempts = await insertOtpChallenge(database.pool, bookingId, {
        attempts: -1,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(negativeAttempts)).toBe('23514');

      const attemptsExceedMax = await insertOtpChallenge(database.pool, bookingId, {
        attempts: 6,
        maxAttempts: 5,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(attemptsExceedMax)).toBe('23514');

      const badExpiry = await insertOtpChallenge(database.pool, bookingId, {
        createdAt: '2026-12-01T00:00:00.000Z',
        expiresAt: '2026-12-01T00:00:00.000Z',
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(badExpiry)).toBe('23514');
    });
  });

  describe('guest sessions', () => {
    it('does not expose a raw token column', async () => {
      const columns = await database.pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'guest_sessions'`,
      );
      const names = columns.rows.map((row) => row.column_name);
      expect(names).not.toEqual(expect.arrayContaining(['token', 'raw_token']));
    });

    it('rejects a duplicate token_digest', async () => {
      const bookingId = await insertTestBooking(database.pool);
      await insertGuestSession(database.pool, bookingId);

      const error = await insertGuestSession(database.pool, bookingId).catch(
        (cause: unknown) => cause,
      );
      expect(postgresErrorCode(error)).toBe('23505');
    });

    it('rejects invalid digest lengths', async () => {
      const bookingId = await insertTestBooking(database.pool);
      const error = await insertGuestSession(database.pool, bookingId, {
        tokenDigest: DIGEST31,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(error)).toBe('23514');
    });

    it('enforces expires_at > created_at', async () => {
      const bookingId = await insertTestBooking(database.pool);
      const error = await insertGuestSession(database.pool, bookingId, {
        createdAt: '2026-12-01T00:00:00.000Z',
        expiresAt: '2026-12-01T00:00:00.000Z',
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(error)).toBe('23514');
    });
  });

  describe('outbox leases', () => {
    async function insertOutboxEvent(
      bookingId: string,
      overrides: {
        readonly status?: string;
        readonly leaseId?: string | null;
        readonly claimedAt?: string | null;
        readonly leaseExpiresAt?: string | null;
        readonly publishedAt?: string | null;
      } = {},
    ): Promise<unknown> {
      return database.pool.query(
        `INSERT INTO outbox_events
           (property_id, aggregate_type, aggregate_id, event_type, payload, status,
            lease_id, claimed_at, lease_expires_at, published_at)
         VALUES ($1, 'BOOKING', $2, 'BOOKING_CONFIRMED', '{}'::jsonb, $3, $4, $5, $6, $7)`,
        [
          IDS.property,
          bookingId,
          overrides.status ?? 'PENDING',
          overrides.leaseId ?? null,
          overrides.claimedAt ?? null,
          overrides.leaseExpiresAt ?? null,
          overrides.publishedAt ?? null,
        ],
      );
    }

    it('accepts a fully populated lease and rejects a partially populated one', async () => {
      const bookingId = await insertTestBooking(database.pool);

      await expect(
        insertOutboxEvent(bookingId, {
          leaseId: randomUUID(),
          claimedAt: '2026-12-01T00:00:00.000Z',
          leaseExpiresAt: '2026-12-01T00:05:00.000Z',
        }),
      ).resolves.toMatchObject({ rowCount: 1 });

      const error = await insertOutboxEvent(bookingId, {
        leaseId: randomUUID(),
        claimedAt: '2026-12-01T00:00:00.000Z',
        leaseExpiresAt: null,
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(error)).toBe('23514');
    });

    it('rejects PUBLISHED and FAILED rows that still carry a lease', async () => {
      const bookingId = await insertTestBooking(database.pool);

      const publishedWithLease = await insertOutboxEvent(bookingId, {
        status: 'PUBLISHED',
        publishedAt: '2026-12-01T00:00:00.000Z',
        leaseId: randomUUID(),
        claimedAt: '2026-12-01T00:00:00.000Z',
        leaseExpiresAt: '2026-12-01T00:05:00.000Z',
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(publishedWithLease)).toBe('23514');

      const failedWithLease = await insertOutboxEvent(bookingId, {
        status: 'FAILED',
        leaseId: randomUUID(),
        claimedAt: '2026-12-01T00:00:00.000Z',
        leaseExpiresAt: '2026-12-01T00:05:00.000Z',
      }).catch((cause: unknown) => cause);
      expect(postgresErrorCode(failedWithLease)).toBe('23514');
    });

    it('migrates existing phase 4 outbox rows safely with NULL lease fields', async () => {
      const bookingId = await insertTestBooking(database.pool);
      await expect(insertOutboxEvent(bookingId)).resolves.toMatchObject({ rowCount: 1 });
    });
  });

  describe('forbidden schema', () => {
    it('never introduces raw OTP, plaintext challenge ref, or removed columns/tables', async () => {
      const forbiddenColumns = await database.pool.query<{
        table_name: string;
        column_name: string;
      }>(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name IN ('raw_otp', 'otp_code', 'challenge_ref', 'contact_hash', 'original_hold_expires_at')`,
      );
      expect(forbiddenColumns.rows).toEqual([]);

      const forbiddenTables = await database.pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'guest_otp_challenge_refs'`,
      );
      expect(forbiddenTables.rows).toEqual([]);
    });
  });
});
