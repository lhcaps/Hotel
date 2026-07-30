/**
 * Loads the canonical context for sending a `booking.otp.requested` email.
 *
 * Joins `guest_otp_challenges` + `bookings` + `booking_contacts` in one
 * query. The booking/contact/challenge invariants already in the schema
 * guarantee:
 * - one contact per booking (`booking_contacts_booking_id_uq`),
 * - one active challenge per booking
 *   (`guest_otp_challenges_one_active_booking_uq`),
 * - one booking per `booking_code` per property
 *   (`bookings_property_booking_code_uq`).
 *
 * The challenge UUID and booking UUID are validated against the payload
 * `challengeId`/`bookingId` so an outbox payload that has been swapped
 * between events is rejected without sending an email.
 */

import { Buffer } from 'node:buffer';
import { type DatabasePool } from '@room/database';

export interface OtpChallengeContext {
  readonly bookingCode: string;
  readonly expiresAt: Date;
  readonly nonce: Buffer;
  readonly emailDigest: Buffer;
  readonly contactEmailDigest: Buffer;
  readonly challengeId: string;
  readonly bookingStatus: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly consumedAt: Date | null;
  readonly replacedAt: Date | null;
}

interface OtpContextRow {
  readonly challenge_id: string;
  readonly booking_id: string;
  readonly nonce: Buffer;
  readonly email_digest: Buffer;
  readonly contact_email_digest: Buffer;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly expires_at: Date;
  readonly consumed_at: Date | null;
  readonly replaced_at: Date | null;
  readonly booking_code: string;
  readonly booking_status: string;
}

function parseSqlTimestamp(value: Date | string, field: string): Date {
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}: ${String(value)}`);
  }
  return parsed;
}

export async function loadOtpContext(
  pool: DatabasePool,
  bookingId: string,
  challengeId: string,
): Promise<OtpChallengeContext | null> {
  const result = await pool.query<OtpContextRow>(
    `SELECT goc.id            AS challenge_id,
            goc.booking_id    AS booking_id,
            goc.nonce         AS nonce,
            goc.email_digest  AS email_digest,
            goc.attempts      AS attempts,
            goc.max_attempts  AS max_attempts,
            goc.expires_at    AS expires_at,
            goc.consumed_at   AS consumed_at,
            goc.replaced_at   AS replaced_at,
            b.booking_code    AS booking_code,
            b.status          AS booking_status,
            bc.email_digest   AS contact_email_digest
       FROM guest_otp_challenges goc
       JOIN bookings b          ON b.id = goc.booking_id
       JOIN booking_contacts bc ON bc.booking_id = b.id
      WHERE goc.id = $1
        AND goc.booking_id = $2`,
    [challengeId, bookingId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    challengeId: row.challenge_id,
    bookingCode: row.booking_code,
    bookingStatus: row.booking_status,
    expiresAt: parseSqlTimestamp(row.expires_at, 'expires_at'),
    nonce: row.nonce,
    emailDigest: row.email_digest,
    contactEmailDigest: row.contact_email_digest,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    consumedAt: row.consumed_at === null ? null : parseSqlTimestamp(row.consumed_at, 'consumed_at'),
    replacedAt: row.replaced_at === null ? null : parseSqlTimestamp(row.replaced_at, 'replaced_at'),
  };
}
