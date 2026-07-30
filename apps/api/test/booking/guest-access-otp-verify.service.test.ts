import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import {
  GuestAccessOtpVerifyService,
  OtpInvalidOrExpiredError,
} from '../../src/booking/services/guest-access-otp-verify.service.js';
import type {
  ConsumeOtpParams,
  ConsumeOtpOutcome,
  GuestAccessRepository,
  GuestAccessSecrets,
} from '../../src/booking/repositories/guest-access.repository.js';

const SECRETS: GuestAccessSecrets = {
  otpSecret: Buffer.from('a'.repeat(48), 'utf8'),
  challengeRefSecret: Buffer.from('b'.repeat(48), 'utf8'),
  sessionSecret: Buffer.from('c'.repeat(48), 'utf8'),
  ipDigestSecret: Buffer.from('d'.repeat(48), 'utf8'),
};

function serviceWith(outcome: ConsumeOtpOutcome) {
  const repository = {
    consumeOtp: vi.fn(async (_params: ConsumeOtpParams) => outcome),
  } as unknown as GuestAccessRepository;
  return {
    service: new GuestAccessOtpVerifyService(repository, SECRETS),
    repository,
  };
}

describe('GuestAccessOtpVerifyService', () => {
  it('returns the session token and the response on CONSUMED', async () => {
    const sessionToken = Buffer.from('session-token', 'utf8');
    const { service, repository } = serviceWith({
      kind: 'CONSUMED',
      bookingId: '11111111-1111-4111-8111-111111111111',
      bookingCode: 'RM-AB12-CD34-EF56',
      sessionId: '22222222-2222-4222-8222-222222222222',
      sessionToken,
      sessionExpiresAt: new Date('2027-01-01T00:30:00.000Z'),
    });
    const now = new Date('2026-07-23T00:00:00.000Z');
    const { response, bookingCode } = await service.verify(
      { challengeRef: 'ABCDEF123456789ABCDEF123456789YY', otp: '012345' },
      '203.0.113.1',
      now,
    );
    expect(response.bookingCode).toBe('RM-AB12-CD34-EF56');
    expect(response.expiresAt).toBe('2027-01-01T00:30:00.000Z');
    expect(response.issuedAt).toBe(now.toISOString());
    expect(bookingCode).toBe('RM-AB12-CD34-EF56');
    expect(repository.consumeOtp).toHaveBeenCalledTimes(1);
  });

  it('throws OtpInvalidOrExpiredError when the outcome is OTP_INVALID_OR_EXPIRED', async () => {
    const { service } = serviceWith({
      kind: 'OTP_INVALID_OR_EXPIRED',
      serverTime: new Date('2026-07-23T00:00:00.000Z'),
    });
    await expect(
      service.verify(
        { challengeRef: 'ABCDEF123456789ABCDEF123456789YY', otp: '999999' },
        '203.0.113.1',
        new Date('2026-07-23T00:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(OtpInvalidOrExpiredError);
  });

  it('rejects malformed challenge refs and OTP strings via Zod', async () => {
    const { service } = serviceWith({
      kind: 'OTP_INVALID_OR_EXPIRED',
      serverTime: new Date(),
    });
    await expect(
      service.verify(
        { challengeRef: 'xx', otp: '12345' },
        '203.0.113.1',
        new Date(),
      ),
    ).rejects.toBeTruthy();
  });

  it('exposes the expected code on OtpInvalidOrExpiredError', () => {
    const error = new OtpInvalidOrExpiredError();
    expect(error.code).toBe('OTP_INVALID_OR_EXPIRED');
    expect(error.name).toBe('OtpInvalidOrExpiredError');
  });
});
