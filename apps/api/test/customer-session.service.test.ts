import { describe, expect, it, vi } from 'vitest';

import {
  CustomerSessionRequiredError,
  CustomerSessionService,
} from '../src/auth/customer-session.service.js';

describe('CustomerSessionService — security boundary', () => {
  it('rejects when no session is present', async () => {
    const service = new CustomerSessionService({
      getActor: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.requireCustomer({ headers: {}, id: 'req-1' }),
    ).rejects.toBeInstanceOf(CustomerSessionRequiredError);
  });

  it('rejects when an ADMIN session is presented on a CUSTOMER route', async () => {
    const service = new CustomerSessionService({
      getActor: vi.fn().mockResolvedValue({
        userId: 'admin-1',
        email: 'admin@example.test',
        displayName: 'Admin',
        role: 'ADMIN',
        permissions: ['admin:read'],
        sessionId: 'session-1',
        sessionExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
        requestId: 'req-2',
      }),
    });
    await expect(
      service.requireCustomer({ headers: {}, id: 'req-2' }),
    ).rejects.toMatchObject({ name: 'CustomerSessionRequiredError' });
  });

  it('returns null for an anonymous or non-CUSTOMER session probe', async () => {
    const anonymous = new CustomerSessionService({ getActor: vi.fn().mockResolvedValue(null) });
    const admin = new CustomerSessionService({
      getActor: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
    });

    await expect(anonymous.getCustomer({ headers: {}, id: 'probe-anonymous' })).resolves.toBeNull();
    await expect(admin.getCustomer({ headers: {}, id: 'probe-admin' })).resolves.toBeNull();
  });

  it('returns the actor for an ACTIVE CUSTOMER session', async () => {
    const actor = {
      userId: 'customer-1',
      email: 'customer@example.test',
      displayName: 'Customer',
      role: 'CUSTOMER' as const,
      permissions: ['booking:read:self'],
      sessionId: 'session-2',
      sessionExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
      requestId: 'req-3',
    };
    const service = new CustomerSessionService({
      getActor: vi.fn().mockResolvedValue(actor),
    });
    await expect(
      service.requireCustomer({
        headers: { 'x-correlation-id': 'corr-3' },
        id: 'req-3',
      }),
    ).resolves.toMatchObject({
      userId: 'customer-1',
      role: 'CUSTOMER',
    });
  });

  it('passes the request id and headers to the underlying session reader', async () => {
    const actor = {
      userId: 'customer-3',
      email: 'customer-3@example.test',
      displayName: 'Customer Three',
      role: 'CUSTOMER' as const,
      permissions: [],
      sessionId: 'session-4',
      sessionExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
      requestId: 'req-4',
    };
    const getActor = vi.fn().mockResolvedValue(actor);
    const service = new CustomerSessionService({ getActor });
    await service.requireCustomer({
      headers: { 'x-correlation-id': 'corr-4' },
      id: 'req-4',
    });
    expect(getActor).toHaveBeenCalledWith({
      headers: { 'x-correlation-id': 'corr-4' },
      id: 'req-4',
    });
  });

  it('does not leak ADMIN actor context when a CUSTOMER request is made', async () => {
    // Defensive: the CUSTOMER service must reject any role != CUSTOMER
    // even if the underlying reader mistakenly returns an actor of
    // some other role (e.g., future GUEST role). For now, the only
    // other role is ADMIN.
    const service = new CustomerSessionService({
      getActor: vi.fn().mockResolvedValue({
        userId: 'admin-99',
        email: 'admin-99@example.test',
        displayName: 'Admin',
        role: 'ADMIN',
        permissions: [],
        sessionId: 'session-x',
        sessionExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
        requestId: 'req-5',
      }),
    });
    await expect(
      service.requireCustomer({ headers: {}, id: 'req-5' }),
    ).rejects.toBeInstanceOf(CustomerSessionRequiredError);
  });
});
