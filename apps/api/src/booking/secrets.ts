/**
 * Buffer-typed secrets loaded from the API environment for guest access.
 *
 * The bytes are derived once at boot so HMAC inputs are deterministic.
 * No raw secret value crosses the module boundary.
 */

import { Buffer } from 'node:buffer';

export interface GuestSecrets {
  readonly otpSecret: Buffer;
  readonly challengeRefSecret: Buffer;
  readonly sessionSecret: Buffer;
  readonly ipDigestSecret: Buffer;
}

export interface GuestSecretSource {
  readonly GUEST_OTP_SECRET: string;
  readonly GUEST_CHALLENGE_REF_SECRET: string;
  readonly GUEST_SESSION_SECRET: string;
  readonly BOOKING_IP_DIGEST_SECRET: string;
}

export function loadGuestSecrets(source: GuestSecretSource): GuestSecrets {
  const otpSecret = Buffer.from(source.GUEST_OTP_SECRET, 'utf8');
  const challengeRefSecret = Buffer.from(source.GUEST_CHALLENGE_REF_SECRET, 'utf8');
  const sessionSecret = Buffer.from(source.GUEST_SESSION_SECRET, 'utf8');
  const ipDigestSecret = Buffer.from(source.BOOKING_IP_DIGEST_SECRET, 'utf8');

  const minLength = 32;
  for (const [name, buffer] of [
    ['GUEST_OTP_SECRET', otpSecret],
    ['GUEST_CHALLENGE_REF_SECRET', challengeRefSecret],
    ['GUEST_SESSION_SECRET', sessionSecret],
    ['BOOKING_IP_DIGEST_SECRET', ipDigestSecret],
  ] as const) {
    if (buffer.length < minLength) {
      throw new Error(`${name} must be at least ${minLength} bytes`);
    }
  }

  return { otpSecret, challengeRefSecret, sessionSecret, ipDigestSecret };
}