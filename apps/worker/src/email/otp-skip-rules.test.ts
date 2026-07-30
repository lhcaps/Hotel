import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';

import { decideOtpSkip, type OtpChallengeLookupRow } from './otp-skip-rules.js';

const NOW = new Date('2026-07-23T10:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 600_000);
const PAST = new Date(NOW.getTime() - 1);
const EMAIL_DIGEST = Buffer.alloc(32, 0xaa);
const OTHER_DIGEST = Buffer.alloc(32, 0xbb);

function activeRow(overrides: Partial<OtpChallengeLookupRow> = {}): OtpChallengeLookupRow {
  return {
    challenge_id: '11111111-1111-1111-1111-111111111111',
    email_digest: EMAIL_DIGEST,
    attempts: 0,
    max_attempts: 5,
    expires_at: FUTURE,
    consumed_at: null,
    replaced_at: null,
    booking_status: 'HOLD',
    contact_email_digest: EMAIL_DIGEST,
    ...overrides,
  };
}

describe('decideOtpSkip', () => {
  it('does not skip an active challenge', () => {
    expect(decideOtpSkip(activeRow(), NOW)).toEqual({ skip: false, reason: null });
  });

  it('skips when the challenge row is missing', () => {
    expect(decideOtpSkip(activeRow({ challenge_id: null }), NOW)).toEqual({
      skip: true,
      reason: 'CHALLENGE_GONE',
    });
  });

  it('skips when the challenge has been consumed', () => {
    expect(decideOtpSkip(activeRow({ consumed_at: NOW }), NOW)).toEqual({
      skip: true,
      reason: 'CHALLENGE_CONSUMED',
    });
  });

  it('skips when the challenge has been replaced', () => {
    expect(decideOtpSkip(activeRow({ replaced_at: NOW }), NOW)).toEqual({
      skip: true,
      reason: 'CHALLENGE_REPLACED',
    });
  });

  it('skips when the challenge is expired', () => {
    expect(decideOtpSkip(activeRow({ expires_at: PAST }), NOW)).toEqual({
      skip: true,
      reason: 'CHALLENGE_EXPIRED',
    });
  });

  it('skips when attempts are exhausted', () => {
    expect(decideOtpSkip(activeRow({ attempts: 5 }), NOW)).toEqual({
      skip: true,
      reason: 'CHALLENGE_ATTEMPTS_EXHAUSTED',
    });
  });

  it('skips when email digest does not match the contact digest', () => {
    expect(decideOtpSkip(activeRow({ email_digest: OTHER_DIGEST }), NOW)).toEqual({
      skip: true,
      reason: 'EMAIL_DIGEST_MISMATCH',
    });
  });

  it('skips when booking status is not accessible', () => {
    expect(decideOtpSkip(activeRow({ booking_status: 'EXPIRED' }), NOW)).toEqual({
      skip: true,
      reason: 'BOOKING_NOT_ACCESSIBLE',
    });
    expect(decideOtpSkip(activeRow({ booking_status: 'CANCELLED' }), NOW)).toEqual({
      skip: true,
      reason: 'BOOKING_NOT_ACCESSIBLE',
    });
  });

  it('skips when the contact row is gone', () => {
    expect(decideOtpSkip(activeRow({ contact_email_digest: null }), NOW)).toEqual({
      skip: true,
      reason: 'CONTACT_GONE',
    });
  });

  it('skips when the booking is gone', () => {
    expect(decideOtpSkip(activeRow({ booking_status: null }), NOW)).toEqual({
      skip: true,
      reason: 'BOOKING_GONE',
    });
  });

  it('accepts CONFIRMED bookings as accessible', () => {
    expect(decideOtpSkip(activeRow({ booking_status: 'CONFIRMED' }), NOW)).toEqual({
      skip: false,
      reason: null,
    });
  });

  it('uses PostgreSQL time (currentTime is explicit)', () => {
    // An expiry exactly equal to "now" must skip.
    expect(decideOtpSkip(activeRow({ expires_at: NOW }), NOW)).toEqual({
      skip: true,
      reason: 'CHALLENGE_EXPIRED',
    });
  });
});
