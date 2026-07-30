import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import {
  GuestSessionInvalidError,
  GuestSessionRequiredError,
  GuestSessionService,
  GuestSessionWrongBookingError,
} from '../../src/booking/services/guest-session.service.js';
import {
  digestSessionToken,
  type GuestSessionRepository,
  type GuestSessionRecord,
} from '../../src/booking/repositories/guest-session.repository.js';
import type { GuestAccessSecrets } from '../../src/booking/repositories/guest-access.repository.js';
import { DIGEST_DOMAIN_LABELS, computeDigest } from '@room/booking';

const SECRETS: GuestAccessSecrets = {
  otpSecret: Buffer.from('z'.repeat(48), 'utf8'),
  challengeRefSecret: Buffer.from('y'.repeat(48), 'utf8'),
  sessionSecret: Buffer.from('a'.repeat(48), 'utf8'),
  ipDigestSecret: Buffer.from('x'.repeat(48), 'utf8'),
};

function sessionRecord(overrides: Partial<GuestSessionRecord> = {}): GuestSessionRecord {
  return {
    sessionId: 'session-1',
    bookingId: '00000000-0000-0000-0000-000000000001',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function services(overrides: {
  findActive?: (digest: Buffer, now: Date) => Promise<GuestSessionRecord | null>;
}) {
  const repository = {
    findActiveSession: vi.fn().mockImplementation(overrides.findActive ?? (async () => null)),
  } as unknown as GuestSessionRepository;
  return {
    service: new GuestSessionService(repository, SECRETS),
    repository,
  };
}

describe('GuestSessionService', () => {
  it('rejects a missing token with GuestSessionRequiredError', async () => {
    const { service } = services({});
    await expect(service.authenticate(null, new Date())).rejects.toBeInstanceOf(
      GuestSessionRequiredError,
    );
  });

  it('hashes the token with the session secret before lookup', async () => {
    const token = Buffer.from('a'.repeat(48), 'utf8');
    const { service, repository } = services({
      findActive: async () => sessionRecord(),
    });
    await service.authenticate(token, new Date('2026-07-23T00:00:00.000Z'));
    const expectedDigest = digestSessionToken(SECRETS.sessionSecret, token);
    expect(repository.findActiveSession).toHaveBeenCalledWith(
      expectedDigest,
      new Date('2026-07-23T00:00:00.000Z'),
    );
  });

  it('produces a digest equivalent to computeDigest under the session domain', () => {
    const token = Buffer.from('a'.repeat(48), 'utf8');
    const expected = computeDigest({
      secretKey: SECRETS.sessionSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.guestSession,
      parts: [token],
    });
    expect(digestSessionToken(SECRETS.sessionSecret, token).equals(expected)).toBe(true);
  });

  it('rejects an unknown session with GuestSessionInvalidError', async () => {
    const { service } = services({});
    await expect(
      service.authenticate(Buffer.alloc(8), new Date('2026-07-23T00:00:00.000Z')),
    ).rejects.toBeInstanceOf(GuestSessionInvalidError);
  });

  it('returns the session on success', async () => {
    const expires = new Date('2027-01-01T00:00:00.000Z');
    const { service } = services({
      findActive: async () => sessionRecord({ expiresAt: expires }),
    });
    const result = await service.authenticate(
      Buffer.alloc(8),
      new Date('2026-07-23T00:00:00.000Z'),
    );
    expect(result.bookingId).toBe('00000000-0000-0000-0000-000000000001');
    expect(result.expiresAt).toBe(expires);
  });

  it('rejects a session bound to a different booking with GuestSessionWrongBookingError', async () => {
    const { service } = services({
      findActive: async () => sessionRecord(),
    });
    await expect(
      service.requireForBooking(
        Buffer.alloc(8),
        '99999999-0000-0000-0000-000000000001',
        new Date('2026-07-23T00:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(GuestSessionWrongBookingError);
  });

  it('returns the matching session on requireForBooking', async () => {
    const { service } = services({
      findActive: async () => sessionRecord(),
    });
    const result = await service.requireForBooking(
      Buffer.alloc(8),
      '00000000-0000-0000-0000-000000000001',
      new Date('2026-07-23T00:00:00.000Z'),
    );
    expect(result.bookingId).toBe('00000000-0000-0000-0000-000000000001');
  });
});
