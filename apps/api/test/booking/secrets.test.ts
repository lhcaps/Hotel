import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import { loadGuestSecrets } from '../../src/booking/secrets.js';

const valid: Parameters<typeof loadGuestSecrets>[0] = {
  GUEST_OTP_SECRET: 'a'.repeat(48),
  GUEST_CHALLENGE_REF_SECRET: 'b'.repeat(48),
  GUEST_SESSION_SECRET: 'c'.repeat(48),
  BOOKING_IP_DIGEST_SECRET: 'd'.repeat(48),
};

describe('loadGuestSecrets', () => {
  it('returns Buffer-typed secrets of the expected shape', () => {
    const secrets = loadGuestSecrets(valid);
    expect(secrets.otpSecret).toBeInstanceOf(Buffer);
    expect(secrets.otpSecret.length).toBe(48);
    expect(secrets.challengeRefSecret.length).toBe(48);
    expect(secrets.sessionSecret.length).toBe(48);
    expect(secrets.ipDigestSecret.length).toBe(48);
  });

  it.each([
    ['GUEST_OTP_SECRET'],
    ['GUEST_CHALLENGE_REF_SECRET'],
    ['GUEST_SESSION_SECRET'],
    ['BOOKING_IP_DIGEST_SECRET'],
  ] as const)('rejects short secrets for %s', (field) => {
    expect(() => loadGuestSecrets({ ...valid, [field]: 'short' })).toThrow(/at least 32/);
  });
});
