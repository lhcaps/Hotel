import { Buffer } from 'node:buffer';
import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';
import {
  guestAccessOtpVerifyResponseSchema,
  guestAccessOtpVerifySchema,
  type GuestAccessOtpVerify,
  type GuestAccessOtpVerifyResponse,
} from '@room/contracts';

import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';
import type { GuestAccessRepository } from '../repositories/guest-access.repository.js';

export class OtpInvalidOrExpiredError extends Error {
  public readonly code = 'OTP_INVALID_OR_EXPIRED';
  public constructor() {
    super('OTP is invalid or expired');
    this.name = 'OtpInvalidOrExpiredError';
  }
}

export class GuestAccessOtpVerifyService {
  public constructor(
    private readonly repository: GuestAccessRepository,
    private readonly secrets: GuestAccessSecrets,
  ) {}

  public async verify(
    input: unknown,
    requestIp: string,
    now: Date,
  ): Promise<{
    response: GuestAccessOtpVerifyResponse;
    sessionToken: Buffer;
    bookingCode: string;
  }> {
    const request: GuestAccessOtpVerify = guestAccessOtpVerifySchema.parse(input);

    const requestIpDigest = computeDigest({
      secretKey: this.secrets.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.ipRateLimit,
      parts: [Buffer.from(requestIp, 'utf8')],
    });

    const outcome = await this.repository.consumeOtp({
      challengeRef: request.challengeRef,
      otp: request.otp,
      requestIpDigest,
      now,
    });

    if (outcome.kind !== 'CONSUMED') {
      throw new OtpInvalidOrExpiredError();
    }

    const response = guestAccessOtpVerifyResponseSchema.parse({
      bookingCode: outcome.bookingCode,
      expiresAt: outcome.sessionExpiresAt.toISOString(),
      issuedAt: now.toISOString(),
    });

    return { response, sessionToken: outcome.sessionToken, bookingCode: outcome.bookingCode };
  }
}
