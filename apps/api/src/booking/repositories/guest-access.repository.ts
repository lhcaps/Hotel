/**
 * Repository for the public guest-access flow.
 *
 * Encapsulates the three write transactions Phase 5 needs:
 *  - requestOtp:  find booking, look up contact digest, rate-limit,
 *                 replace active challenge, insert challenge + outbox.
 *  - consumeChallenge: verify challenge state, increment attempts or
 *                 consume + insert session + audit + outbox.
 *  - revokeSessionByDigest: idempotent logout.
 *
 * All write paths go through raw SQL on a checked-out pool client so
 * we can use SELECT FOR UPDATE without fighting Drizzle's transaction
 * type for bytea columns. Read paths can use the drizzle client.
 */

import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';

import { sql, type DatabaseClient, type DatabasePool } from '@room/database';
import {
  computeDigest,
  DIGEST_DOMAIN_LABELS,
  deriveChallengeRef,
  deriveOtp,
  generateDecoyChallengeRef,
  normalizeBookingCode,
  normalizeChallengeRef,
  type NormalizedContact,
} from '@room/booking';

export interface GuestAccessRateLimitConfig {
  readonly requestWindowMs: number;
  readonly requestLimit: number;
  readonly ipWindowMs: number;
  readonly ipLimit: number;
  readonly resendCooldownMs: number;
  readonly otpTtlMs: number;
  readonly sessionTtlMs: number;
}

export interface GuestAccessSecrets {
  readonly otpSecret: Buffer;
  readonly challengeRefSecret: Buffer;
  readonly sessionSecret: Buffer;
  readonly ipDigestSecret: Buffer;
}

export interface RequestOtpParams {
  readonly bookingCode: string;
  readonly contact: NormalizedContact;
  readonly requestIpDigest: Buffer;
  readonly now: Date;
}

export type RequestOtpOutcome =
  | {
      readonly kind: 'CHALLENGE_ISSUED';
      readonly challengeRef: string;
      readonly challengeId: string;
      readonly expiresAt: Date;
      readonly cooldownSeconds: number;
      readonly serverTime: Date;
    }
  | { readonly kind: 'DECOY_ISSUED'; readonly challengeRef: string; readonly serverTime: Date }
  | {
      readonly kind: 'OTP_RATE_LIMITED';
      readonly retryAfterSeconds: number;
      readonly serverTime: Date;
    };

export interface ConsumeOtpParams {
  readonly challengeRef: string;
  readonly otp: string;
  readonly requestIpDigest: Buffer;
  readonly now: Date;
}

export type ConsumeOtpOutcome =
  | {
      readonly kind: 'CONSUMED';
      readonly bookingId: string;
      readonly bookingCode: string;
      readonly sessionId: string;
      readonly sessionToken: Buffer;
      readonly sessionExpiresAt: Date;
    }
  | { readonly kind: 'OTP_INVALID_OR_EXPIRED'; readonly serverTime: Date };

export interface RevokeSessionParams {
  readonly tokenDigest: Buffer;
  readonly now: Date;
}

export interface CreateCheckoutSessionParams {
  readonly bookingId: string;
  readonly now: Date;
}

export interface BookingContactLookup {
  readonly bookingId: string;
  readonly propertyId: string;
  readonly contactEmailDigest: Buffer | null;
}

export interface ActiveChallengeLookup {
  readonly challengeId: string;
  readonly createdAt: Date;
}

interface BookingRow {
  booking_id: string;
  property_id: string;
  status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  booking_code: string;
  contact_email_digest: Buffer | null;
}

interface ActiveChallengeRow {
  challenge_id: string;
  created_at: Date | string;
}

function parseSqlTimestamp(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

export class GuestAccessRepository {
  public constructor(
    private readonly pool: DatabasePool,
    private readonly database: DatabaseClient,
    private readonly secrets: GuestAccessSecrets,
    private readonly config: GuestAccessRateLimitConfig,
  ) {}

  public async lookupBookingForOtpRequest(
    normalizedBookingCode: string,
  ): Promise<BookingContactLookup | null> {
    const result = await this.database.execute<BookingRow & Record<string, unknown>>(
      sql`SELECT b.id              AS booking_id,
                 b.property_id     AS property_id,
                 b.status          AS status,
                 b.booking_code    AS booking_code,
                 bc.email_digest   AS contact_email_digest
            FROM bookings b
            LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
           WHERE b.booking_code = ${normalizedBookingCode}`,
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      bookingId: row.booking_id,
      propertyId: row.property_id,
      contactEmailDigest: row.contact_email_digest,
    };
  }

  /**
   * Creates a session used only by the path-scoped payment cookie issued
   * immediately after a guest creates their own booking. It cannot be sent
   * to booking-detail or OTP routes, so payment initiation remains one step
   * without weakening guest-access verification.
   */
  public async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<{ readonly token: Buffer; readonly expiresAt: Date }> {
    const now = params.now;
    const token = randomBytes(32);
    const tokenDigest = computeDigest({
      secretKey: this.secrets.sessionSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.guestSession,
      parts: [token],
    });
    const expiresAt = new Date(now.getTime() + this.config.sessionTtlMs);
    await this.pool.query(
      `INSERT INTO guest_sessions
         (id, booking_id, token_digest, created_ip_digest, expires_at, revoked_at, created_at)
       VALUES ($1, $2, $3, NULL, $4, NULL, $5)`,
      [randomUUID(), params.bookingId, tokenDigest, expiresAt, now],
    );
    return { token, expiresAt };
  }

  public async findActiveChallenge(bookingId: string): Promise<ActiveChallengeLookup | null> {
    const result = await this.database.execute<ActiveChallengeRow & Record<string, unknown>>(
      sql`SELECT id            AS challenge_id,
                 created_at    AS created_at
            FROM guest_otp_challenges
           WHERE booking_id = ${bookingId}
             AND consumed_at IS NULL
             AND replaced_at IS NULL
           LIMIT 1`,
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      challengeId: row.challenge_id,
      createdAt: parseSqlTimestamp(row.created_at, 'created_at'),
    };
  }

  public async requestOtp(params: RequestOtpParams): Promise<RequestOtpOutcome> {
    const normalizedCode = normalizeBookingCode(params.bookingCode);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const nowResult = await client.query<{ database_now: Date }>(
        'SELECT CURRENT_TIMESTAMP AS database_now',
      );
      const databaseNowRaw = nowResult.rows[0]?.database_now;
      const databaseNow =
        databaseNowRaw === undefined
          ? params.now
          : databaseNowRaw instanceof Date
            ? databaseNowRaw
            : new Date(databaseNowRaw);

      const bookingResult = await client.query<BookingRow>(
        `SELECT b.id            AS booking_id,
                b.property_id   AS property_id,
                b.status        AS status,
                b.booking_code  AS booking_code
           FROM bookings b
          WHERE b.booking_code = $1
          FOR UPDATE`,
        [normalizedCode],
      );
      const bookingRow = bookingResult.rows[0];

      let contactEmailDigest: Buffer | null = null;
      if (bookingRow !== undefined) {
        const contactResult = await client.query<{ email_digest: Buffer | null }>(
          `SELECT email_digest FROM booking_contacts WHERE booking_id = $1`,
          [bookingRow.booking_id],
        );
        contactEmailDigest = contactResult.rows[0]?.email_digest ?? null;
      }

      if (bookingRow === undefined || contactEmailDigest === null) {
        await client.query('COMMIT');
        return {
          kind: 'DECOY_ISSUED',
          challengeRef: generateDecoyChallengeRef(),
          serverTime: databaseNow,
        };
      }

      const contactDigestMatches =
        contactEmailDigest.length === params.contact.emailDigest.length &&
        Buffer.compare(contactEmailDigest, params.contact.emailDigest) === 0;

      if (!contactDigestMatches) {
        await client.query('COMMIT');
        return {
          kind: 'DECOY_ISSUED',
          challengeRef: generateDecoyChallengeRef(),
          serverTime: databaseNow,
        };
      }

      if (bookingRow.status !== 'HOLD' && bookingRow.status !== 'CONFIRMED') {
        await client.query('COMMIT');
        return {
          kind: 'DECOY_ISSUED',
          challengeRef: generateDecoyChallengeRef(),
          serverTime: databaseNow,
        };
      }

      // Rate-limit counters use database time, not the request time.
      const requestCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM guest_otp_challenges
          WHERE booking_id = $1
            AND email_digest = $2
            AND created_at > $3::timestamptz - ($4::bigint * INTERVAL '1 millisecond')`,
        [bookingRow.booking_id, contactEmailDigest, databaseNow, this.config.requestWindowMs],
      );
      const requestCount = Number(requestCountResult.rows[0]?.count ?? '0');
      if (requestCount >= this.config.requestLimit) {
        await client.query('COMMIT');
        return {
          kind: 'OTP_RATE_LIMITED',
          retryAfterSeconds: Math.ceil(this.config.requestWindowMs / 1000),
          serverTime: databaseNow,
        };
      }

      const ipCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM guest_otp_challenges
          WHERE request_ip_digest = $1
            AND created_at > $2::timestamptz - ($3::bigint * INTERVAL '1 millisecond')`,
        [params.requestIpDigest, databaseNow, this.config.ipWindowMs],
      );
      const ipCount = Number(ipCountResult.rows[0]?.count ?? '0');
      if (ipCount >= this.config.ipLimit) {
        await client.query('COMMIT');
        return {
          kind: 'OTP_RATE_LIMITED',
          retryAfterSeconds: Math.ceil(this.config.ipWindowMs / 1000),
          serverTime: databaseNow,
        };
      }

      // Replace any active challenge for this booking. Mark it
      // `replaced_at` so the OTP skip rules and the consume path
      // recognize that it can never verify.
      await client.query(
        `UPDATE guest_otp_challenges
            SET replaced_at = $2::timestamptz
          WHERE booking_id = $1
            AND consumed_at IS NULL
            AND replaced_at IS NULL`,
        [bookingRow.booking_id, databaseNow],
      );

      const challengeId = randomUUID();
      const nonce = randomBytes(32);
      const expiresAt = new Date(databaseNow.getTime() + this.config.otpTtlMs);
      const challengeRef = deriveChallengeRef({
        secretKey: this.secrets.challengeRefSecret,
        challengeId,
      });
      const challengeRefDigest = computeDigest({
        secretKey: this.secrets.challengeRefSecret,
        domainLabel: DIGEST_DOMAIN_LABELS.challengeRef,
        parts: [Buffer.from(normalizeChallengeRef(challengeRef), 'utf8')],
      });

      await client.query(
        `INSERT INTO guest_otp_challenges
           (id, booking_id, nonce, email_digest, request_ip_digest,
            challenge_ref_digest, attempts, max_attempts, expires_at,
            consumed_at, replaced_at, created_at)
         VALUES
           ($1, $2, $3, $4, $5,
            $6, 0, 5, $7,
            NULL, NULL, $8)`,
        [
          challengeId,
          bookingRow.booking_id,
          nonce,
          contactEmailDigest,
          params.requestIpDigest,
          challengeRefDigest,
          expiresAt,
          databaseNow,
        ],
      );

      // The expires_at CHECK constraint requires expires_at > created_at.
      // Defensive guard: the constraint is the source of truth but we
      // re-check here so a clock skew regression does not surface as a
      // confusing 500.
      if (expiresAt.getTime() <= databaseNow.getTime()) {
        throw new Error('OTP expires_at must be strictly after created_at');
      }

      await client.query(
        `INSERT INTO outbox_events
           (id, property_id, aggregate_type, aggregate_id, event_type,
            payload, status, attempt_count, available_at, published_at,
            lease_id, claimed_at, lease_expires_at, last_error_category)
         VALUES
           (gen_random_uuid(), $1, 'BOOKING', $2, 'booking.otp.requested',
            $3::jsonb, 'PENDING', 0, $4, NULL,
            NULL, NULL, NULL, NULL)`,
        [
          bookingRow.property_id,
          bookingRow.booking_id,
          JSON.stringify({
            eventVersion: 1,
            bookingId: bookingRow.booking_id,
            challengeId,
          }),
          databaseNow,
        ],
      );

      await client.query(
        `INSERT INTO audit_events
           (property_id, aggregate_type, aggregate_id, event_type, payload,
            actor_type, actor_id, occurred_at)
         VALUES
           ($1, 'BOOKING', $2, 'booking.otp.requested',
            $3::jsonb, 'GUEST', NULL, $4)`,
        [
          bookingRow.property_id,
          bookingRow.booking_id,
          JSON.stringify({
            eventVersion: 1,
            challengeId,
            emailDigestLength: contactEmailDigest.length,
          }),
          databaseNow,
        ],
      );

      await client.query('COMMIT');

      return {
        kind: 'CHALLENGE_ISSUED',
        challengeRef,
        challengeId,
        expiresAt,
        cooldownSeconds: Math.ceil(this.config.resendCooldownMs / 1000),
        serverTime: databaseNow,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async consumeOtp(params: ConsumeOtpParams): Promise<ConsumeOtpOutcome> {
    const normalizedRef = normalizeChallengeRef(params.challengeRef);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const nowResult = await client.query<{ database_now: Date }>(
        'SELECT CURRENT_TIMESTAMP AS database_now',
      );
      const databaseNowRaw = nowResult.rows[0]?.database_now;
      const databaseNow =
        databaseNowRaw === undefined
          ? params.now
          : databaseNowRaw instanceof Date
            ? databaseNowRaw
            : new Date(databaseNowRaw);

      const lookupResult = await client.query<ChallengeLookupRow>(
        `SELECT goc.id           AS challenge_id,
                goc.booking_id   AS booking_id,
                goc.nonce        AS nonce,
                goc.email_digest AS email_digest,
                goc.attempts     AS attempts,
                goc.max_attempts AS max_attempts,
                goc.expires_at   AS expires_at,
                goc.consumed_at  AS consumed_at,
                goc.replaced_at  AS replaced_at,
                goc.challenge_ref_digest AS challenge_ref_digest,
                b.booking_code   AS booking_code,
                b.property_id    AS property_id,
                b.status         AS booking_status
           FROM guest_otp_challenges goc
           JOIN bookings b ON b.id = goc.booking_id
          WHERE goc.challenge_ref_digest = $1
          FOR UPDATE`,
        [
          computeDigest({
            secretKey: this.secrets.challengeRefSecret,
            domainLabel: DIGEST_DOMAIN_LABELS.challengeRef,
            parts: [Buffer.from(normalizedRef, 'utf8')],
          }),
        ],
      );
      const challengeRow = lookupResult.rows[0];

      const failureOutcome: ConsumeOtpOutcome = {
        kind: 'OTP_INVALID_OR_EXPIRED',
        serverTime: databaseNow,
      };

      if (challengeRow === undefined) {
        await client.query('COMMIT');
        return failureOutcome;
      }
      if (challengeRow.consumed_at !== null || challengeRow.replaced_at !== null) {
        await client.query('COMMIT');
        return failureOutcome;
      }
      if (challengeRow.booking_status !== 'HOLD' && challengeRow.booking_status !== 'CONFIRMED') {
        await client.query('COMMIT');
        return failureOutcome;
      }
      if (challengeRow.attempts >= challengeRow.max_attempts) {
        await client.query('COMMIT');
        return failureOutcome;
      }
      const expiresAt = parseSqlTimestamp(challengeRow.expires_at, 'expires_at');
      if (expiresAt.getTime() <= databaseNow.getTime()) {
        await client.query('COMMIT');
        return failureOutcome;
      }

      const expectedOtp = deriveOtp({
        secretKey: this.secrets.otpSecret,
        labelByteSequence: challengeRow.nonce,
      });
      const otpMatches =
        typeof params.otp === 'string' &&
        params.otp.length === expectedOtp.length &&
        timingSafeEqualStrings(params.otp, expectedOtp);

      if (!otpMatches) {
        await client.query(
          `UPDATE guest_otp_challenges
              SET attempts = attempts + 1
            WHERE id = $1`,
          [challengeRow.challenge_id],
        );
        await client.query('COMMIT');
        return failureOutcome;
      }

      const sessionToken = randomBytes(32);
      const sessionTokenDigest = computeDigest({
        secretKey: this.secrets.sessionSecret,
        domainLabel: DIGEST_DOMAIN_LABELS.guestSession,
        parts: [sessionToken],
      });
      const sessionExpiresAt = new Date(databaseNow.getTime() + this.config.sessionTtlMs);
      const sessionId = randomUUID();

      await client.query(
        `UPDATE guest_otp_challenges
            SET consumed_at = $2::timestamptz
          WHERE id = $1`,
        [challengeRow.challenge_id, databaseNow],
      );

      if (sessionExpiresAt.getTime() <= databaseNow.getTime()) {
        throw new Error('session expires_at must be strictly after created_at');
      }

      await client.query(
        `INSERT INTO guest_sessions
           (id, booking_id, token_digest, created_ip_digest,
            expires_at, revoked_at, created_at)
         VALUES
           ($1, $2, $3, $4,
            $5, NULL, $6)`,
        [
          sessionId,
          challengeRow.booking_id,
          sessionTokenDigest,
          params.requestIpDigest,
          sessionExpiresAt,
          databaseNow,
        ],
      );

      await client.query(
        `INSERT INTO audit_events
           (property_id, aggregate_type, aggregate_id, event_type, payload,
            actor_type, actor_id, occurred_at)
         VALUES
           ($1, 'GUEST_SESSION', $2, 'guest.session.issued',
            '{"eventVersion":1}'::jsonb, 'GUEST', NULL, $3)`,
        [challengeRow.property_id, sessionId, databaseNow],
      );

      await client.query('COMMIT');

      return {
        kind: 'CONSUMED',
        bookingId: challengeRow.booking_id,
        bookingCode: challengeRow.booking_code,
        sessionId,
        sessionToken,
        sessionExpiresAt,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async revokeSession(params: RevokeSessionParams): Promise<Date> {
    const result = await this.pool.query<{ revoked_at: Date | string | null }>(
      `UPDATE guest_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
        WHERE token_digest = $1
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        RETURNING revoked_at`,
      [params.tokenDigest],
    );
    if (result.rows.length === 0) {
      return params.now;
    }
    const value = result.rows[0]?.revoked_at;
    if (value === null || value === undefined) return params.now;
    return value instanceof Date ? value : new Date(value);
  }
}

interface ChallengeLookupRow {
  challenge_id: string;
  booking_id: string;
  nonce: Buffer;
  email_digest: Buffer;
  attempts: number;
  max_attempts: number;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  replaced_at: Date | string | null;
  challenge_ref_digest: Buffer;
  booking_code: string;
  property_id: string;
  booking_status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
