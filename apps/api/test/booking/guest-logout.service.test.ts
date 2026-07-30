import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import { GuestLogoutService } from '../../src/booking/services/guest-logout.service.js';
import type { GuestAccessRepository } from '../../src/booking/repositories/guest-access.repository.js';
import type { GuestSessionService } from '../../src/booking/services/guest-session.service.js';

function services(overrides: {
  revokeSession?: (input: { tokenDigest: Buffer; now: Date }) => Promise<void>;
}) {
  const repository = {
    revokeSession: vi.fn().mockImplementation(overrides.revokeSession ?? (async () => undefined)),
  } as unknown as GuestAccessRepository;
  const session = {
    digestForRevoke: vi.fn().mockReturnValue(Buffer.from('digest', 'utf8')),
  } as unknown as GuestSessionService;
  return {
    service: new GuestLogoutService(repository, session),
    repository,
    session,
  };
}

describe('GuestLogoutService', () => {
  it('does not call the repository when no token is present', async () => {
    const { service, repository } = services({});
    const now = new Date('2026-07-23T00:00:00.000Z');
    const response = await service.logout(null, now);
    expect(repository.revokeSession).not.toHaveBeenCalled();
    expect(response.loggedOutAt).toBe(now.toISOString());
  });

  it('revokes the matching session digest when a token is provided', async () => {
    const { service, repository, session } = services({
      revokeSession: async () => undefined,
    });
    const token = Buffer.from('a'.repeat(48), 'utf8');
    const now = new Date('2026-07-23T00:00:00.000Z');
    await service.logout(token, now);
    expect(session.digestForRevoke).toHaveBeenCalledWith(token);
    expect(repository.revokeSession).toHaveBeenCalledWith({
      tokenDigest: Buffer.from('digest', 'utf8'),
      now,
    });
  });
});
