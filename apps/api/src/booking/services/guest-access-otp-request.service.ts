import { Buffer } from 'node:buffer';
import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';
import {
  guestAccessOtpRequestResponseSchema,
  guestAccessOtpRequestSchema,
  type GuestAccessOtpRequest,
  type GuestAccessOtpRequestResponse,
} from '@room/contracts';

import type {
  GuestAccessRateLimitConfig,
  GuestAccessSecrets,
} from '../repositories/guest-access.repository.js';
import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';

export class OtpRateLimitedError extends Error {
  public readonly code = 'OTP_RATE_LIMITED';
  public readonly retryAfterSeconds: number;
  public constructor(retryAfterSeconds: number) {
    super(`OTP rate-limited; retry after ${retryAfterSeconds}s`);
    this.name = 'OtpRateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OtpBookingNotFoundError extends Error {
  public readonly code = 'BOOKING_NOT_FOUND';
  public constructor() {
    super('Booking not found for guest OTP request');
    this.name = 'OtpBookingNotFoundError';
  }
}

export class GuestAccessOtpRequestService {
  public constructor(
    private readonly repository: GuestAccessRepository,
    private readonly secrets: GuestAccessSecrets,
    private readonly config: GuestAccessRateLimitConfig,
  ) {}

  public async request(input: unknown, requestIp: string): Promise<GuestAccessOtpRequestResponse> {
    const request: GuestAccessOtpRequest = guestAccessOtpRequestSchema.parse(input);

    const requestIpDigest = computeDigest({
      secretKey: this.secrets.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.ipRateLimit,
      parts: [Buffer.from(requestIp, 'utf8')],
    });

    const emailDigest = computeDigest({
      secretKey: this.secrets.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from(request.email, 'utf8')],
    });

    const outcome = await this.repository.requestOtp({
      bookingCode: request.bookingCode,
      contact: {
        fullName: '',
        email: request.email,
        phoneE164: '',
        emailDigest,
      },
      requestIpDigest,
      now: new Date(),
    });

    if (outcome.kind === 'OTP_RATE_LIMITED') {
      throw new OtpRateLimitedError(outcome.retryAfterSeconds);
    }

    return guestAccessOtpRequestResponseSchema.parse({
      challengeRef: outcome.challengeRef,
      expiresAt:
        outcome.kind === 'CHALLENGE_ISSUED'
          ? outcome.expiresAt.toISOString()
          : new Date(outcome.serverTime.getTime() + this.config.otpTtlMs).toISOString(),
      cooldownSeconds: outcome.kind === 'CHALLENGE_ISSUED' ? outcome.cooldownSeconds : 0,
      serverTime: outcome.serverTime.toISOString(),
    });
  }
}
