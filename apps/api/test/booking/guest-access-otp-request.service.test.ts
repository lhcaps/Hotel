import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import {
  GuestAccessOtpRequestService,
  OtpRateLimitedError,
} from '../../src/booking/services/guest-access-otp-request.service.js';
import type {
  GuestAccessRateLimitConfig,
  GuestAccessRepository,
  GuestAccessSecrets,
  RequestOtpParams,
  RequestOtpOutcome,
} from '../../src/booking/repositories/guest-access.repository.js';

const SECRETS: GuestAccessSecrets = {
  otpSecret: Buffer.from('a'.repeat(48), 'utf8'),
  challengeRefSecret: Buffer.from('b'.repeat(48), 'utf8'),
  sessionSecret: Buffer.from('c'.repeat(48), 'utf8'),
  ipDigestSecret: Buffer.from('d'.repeat(48), 'utf8'),
};

const CONFIG: GuestAccessRateLimitConfig = {
  requestWindowMs: 5 * 60 * 1000,
  requestLimit: 5,
  ipWindowMs: 10 * 60 * 1000,
  ipLimit: 20,
  resendCooldownMs: 60 * 1000,
  otpTtlMs: 5 * 60 * 1000,
  sessionTtlMs: 30 * 60 * 1000,
};

function serviceWith(outcome: RequestOtpOutcome) {
  const repository = {
    requestOtp: vi.fn(async (_params: RequestOtpParams) => outcome),
  } as unknown as GuestAccessRepository;
  const service = new GuestAccessOtpRequestService(repository, SECRETS, CONFIG);
  return { service, repository };
}

const CHALLENGE_REF = 'ABCDEF123456789ABCDEF123456789YY';
const DECOY_REF = 'YQM2WD6CXUN58GHBUFYW86E5CTCTXTG1';

describe('GuestAccessOtpRequestService', () => {
  it('returns the issued challenge ref with the issued cooldown', async () => {
    const { service, repository } = serviceWith({
      kind: 'CHALLENGE_ISSUED',
      challengeRef: CHALLENGE_REF,
      challengeId: '11111111-1111-4111-8111-111111111111',
      expiresAt: new Date('2027-01-01T00:05:00.000Z'),
      cooldownSeconds: 60,
      serverTime: new Date('2026-07-23T00:00:00.000Z'),
    });
    const result = await service.request(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'guest@example.com' },
      '203.0.113.1',
    );
    expect(result.challengeRef).toBe(CHALLENGE_REF);
    expect(result.cooldownSeconds).toBe(60);
    expect(result.expiresAt).toBe('2027-01-01T00:05:00.000Z');
    expect(repository.requestOtp).toHaveBeenCalledTimes(1);
  });

  it('lowers the email to match the digest case', async () => {
    const { service, repository } = serviceWith({
      kind: 'CHALLENGE_ISSUED',
      challengeRef: CHALLENGE_REF,
      challengeId: '11111111-1111-4111-8111-111111111111',
      expiresAt: new Date('2027-01-01T00:05:00.000Z'),
      cooldownSeconds: 0,
      serverTime: new Date('2026-07-23T00:00:00.000Z'),
    });
    await service.request(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'Guest@Example.com' },
      '203.0.113.1',
    );
    const call = (repository.requestOtp as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as RequestOtpParams;
    expect(call.contact.email).toBe('guest@example.com');
  });

  it('throws OtpRateLimitedError when the repository signals rate-limit', async () => {
    const { service } = serviceWith({
      kind: 'OTP_RATE_LIMITED',
      retryAfterSeconds: 90,
      serverTime: new Date('2026-07-23T00:00:00.000Z'),
    });
    await expect(
      service.request(
        { bookingCode: 'RM-AB12-CD34-EF56', email: 'guest@example.com' },
        '203.0.113.1',
      ),
    ).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED', retryAfterSeconds: 90 });
  });

  it('returns the decoy challenge ref with zero cooldown and a synthesised expiry', async () => {
    const { service } = serviceWith({
      kind: 'DECOY_ISSUED',
      challengeRef: DECOY_REF,
      serverTime: new Date('2026-07-23T00:00:00.000Z'),
    });
    const result = await service.request(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'guest@example.com' },
      '203.0.113.1',
    );
    expect(result.challengeRef).toBe(DECOY_REF);
    expect(result.cooldownSeconds).toBe(0);
    expect(new Date(result.expiresAt).getTime()).toBe(new Date('2026-07-23T00:05:00.000Z').getTime());
  });

  it('rejects invalid input via Zod', async () => {
    const { service } = serviceWith({
      kind: 'DECOY_ISSUED',
      challengeRef: DECOY_REF,
      serverTime: new Date(),
    });
    await expect(
      service.request({ bookingCode: 'rm', email: 'not-email' }, '203.0.113.1'),
    ).rejects.toBeTruthy();
  });

  it('exposes the OTP rate-limit code and retry-after on the error', () => {
    const error = new OtpRateLimitedError(45);
    expect(error.code).toBe('OTP_RATE_LIMITED');
    expect(error.retryAfterSeconds).toBe(45);
    expect(error.name).toBe('OtpRateLimitedError');
  });
});
