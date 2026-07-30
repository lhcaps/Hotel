/**
 * Skip rules for the booking.otp.requested outbox event.
 *
 * Every skip is terminal — `finalizeOutboxSuccess` will publish the event
 * so it never retries. A stale event that points at a challenge that no
 * longer exists must not retry forever.
 */

import { Buffer } from 'node:buffer';

export type OtpSkipReason =
  | 'CHALLENGE_GONE'
  | 'CHALLENGE_CONSUMED'
  | 'CHALLENGE_REPLACED'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_ATTEMPTS_EXHAUSTED'
  | 'EMAIL_DIGEST_MISMATCH'
  | 'BOOKING_GONE'
  | 'BOOKING_NOT_ACCESSIBLE'
  | 'CONTACT_GONE';

export interface OtpChallengeLookupRow {
  readonly challenge_id: string | null;
  readonly email_digest: Buffer | null;
  readonly attempts: number | null;
  readonly max_attempts: number | null;
  readonly expires_at: Date | string | null;
  readonly consumed_at: Date | string | null;
  readonly replaced_at: Date | string | null;
  readonly booking_status: string | null;
  readonly contact_email_digest: Buffer | null;
}

export interface OtpSkipDecision {
  readonly skip: boolean;
  readonly reason: OtpSkipReason | null;
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

const ACCESSIBLE_BOOKING_STATUSES = new Set(['HOLD', 'CONFIRMED']);

export function decideOtpSkip(row: OtpChallengeLookupRow, currentTime: Date): OtpSkipDecision {
  if (row.challenge_id === null) {
    return { skip: true, reason: 'CHALLENGE_GONE' };
  }
  if (row.booking_status === null) {
    return { skip: true, reason: 'BOOKING_GONE' };
  }
  if (row.contact_email_digest === null) {
    return { skip: true, reason: 'CONTACT_GONE' };
  }
  if (row.consumed_at !== null) {
    return { skip: true, reason: 'CHALLENGE_CONSUMED' };
  }
  if (row.replaced_at !== null) {
    return { skip: true, reason: 'CHALLENGE_REPLACED' };
  }
  if (row.attempts !== null && row.max_attempts !== null && row.attempts >= row.max_attempts) {
    return { skip: true, reason: 'CHALLENGE_ATTEMPTS_EXHAUSTED' };
  }
  if (
    row.expires_at !== null &&
    parseSqlTimestamp(row.expires_at, 'expires_at').getTime() <= currentTime.getTime()
  ) {
    return { skip: true, reason: 'CHALLENGE_EXPIRED' };
  }
  if (
    !row.email_digest ||
    !row.contact_email_digest ||
    !row.email_digest.equals(row.contact_email_digest)
  ) {
    return { skip: true, reason: 'EMAIL_DIGEST_MISMATCH' };
  }
  if (!ACCESSIBLE_BOOKING_STATUSES.has(row.booking_status)) {
    return { skip: true, reason: 'BOOKING_NOT_ACCESSIBLE' };
  }
  return { skip: false, reason: null };
}
