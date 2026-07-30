import { Buffer } from 'node:buffer';
import { computeDigest, DIGEST_DOMAIN_LABELS } from '@room/booking';

import {
  digestSessionToken,
  type GuestSessionRepository,
} from '../repositories/guest-session.repository.js';
import type { GuestAccessSecrets } from '../repositories/guest-access.repository.js';

export class GuestSessionRequiredError extends Error {
  public readonly code = 'GUEST_SESSION_REQUIRED';
  public constructor() {
    super('Guest session cookie is required');
    this.name = 'GuestSessionRequiredError';
  }
}

export class GuestSessionInvalidError extends Error {
  public readonly code = 'GUEST_SESSION_INVALID';
  public constructor() {
    super('Guest session is invalid, expired, or revoked');
    this.name = 'GuestSessionInvalidError';
  }
}

export class GuestSessionWrongBookingError extends Error {
  public readonly code = 'GUEST_SESSION_INVALID';
  public constructor() {
    super('Guest session is not bound to this booking');
    this.name = 'GuestSessionWrongBookingError';
  }
}

export interface AuthenticatedSession {
  readonly sessionId: string;
  readonly bookingId: string;
  readonly expiresAt: Date;
}

export class GuestSessionService {
  public constructor(
    private readonly repository: GuestSessionRepository,
    private readonly secrets: GuestAccessSecrets,
  ) {}

  public authenticate(token: Buffer | null, now: Date): Promise<AuthenticatedSession> {
    if (token === null) return Promise.reject(new GuestSessionRequiredError());
    const tokenDigest = digestSessionToken(this.secrets.sessionSecret, token);
    return this.repository
      .findActiveSession(tokenDigest, now)
      .then((record) => {
        if (record === null) throw new GuestSessionInvalidError();
        return {
          sessionId: record.sessionId,
          bookingId: record.bookingId,
          expiresAt: record.expiresAt,
        };
      });
  }

  public requireForBooking(
    token: Buffer | null,
    expectedBookingId: string,
    now: Date,
  ): Promise<AuthenticatedSession> {
    return this.authenticate(token, now).then((session) => {
      if (session.bookingId !== expectedBookingId) {
        throw new GuestSessionWrongBookingError();
      }
      return session;
    });
  }

  public digestForRevoke(token: Buffer): Buffer {
    return computeDigest({
      secretKey: this.secrets.sessionSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.guestSession,
      parts: [token],
    });
  }
}