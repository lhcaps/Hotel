import { describe, expect, it, vi } from 'vitest';

import { AdminSessionService } from '../src/auth/admin-session.service.js';

describe('AdminSessionService', () => {
  it('returns no actor for an absent session or disabled account', async () => {
    const absent = new AdminSessionService(
      { getSession: vi.fn().mockResolvedValue(null) },
      { findUser: vi.fn() },
    );
    await expect(absent.getActor({ headers: {}, id: 'request-id' })).resolves.toBeNull();

    const disabled = new AdminSessionService(
      {
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'user-id', email: 'admin@example.test', name: 'Admin' },
          session: { id: 'session-id', expiresAt: new Date('2027-01-01T00:00:00.000Z') },
        }),
      },
      {
        findUser: vi.fn().mockResolvedValue({
          id: 'user-id',
          email: 'admin@example.test',
          name: 'Admin',
          role: 'ADMIN',
          status: 'DISABLED',
        }),
      },
    );
    await expect(disabled.getActor({ headers: {}, id: 'request-id' })).resolves.toBeNull();
  });

  it('derives an ADMIN actor from a valid session and active database user', async () => {
    const service = new AdminSessionService(
      {
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'user-id', email: 'admin@example.test', name: 'Admin' },
          session: { id: 'session-id', expiresAt: new Date('2027-01-01T00:00:00.000Z') },
        }),
      },
      {
        findUser: vi.fn().mockResolvedValue({
          id: 'user-id',
          email: 'admin@example.test',
          name: 'Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        }),
      },
    );

    await expect(
      service.getActor({ headers: { 'x-correlation-id': 'correlation-id' }, id: 'request-id' }),
    ).resolves.toMatchObject({
      userId: 'user-id',
      role: 'ADMIN',
      requestId: 'request-id',
      correlationId: 'correlation-id',
    });
  });
});
