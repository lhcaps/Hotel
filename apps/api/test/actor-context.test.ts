import { describe, expect, it } from 'vitest';

import { createActorContext } from '../src/auth/actor-context.js';

describe('actor context', () => {
  it('projects only server-derived safe identity and permissions', () => {
    const actor = createActorContext({
      user: {
        id: 'user-id',
        email: 'admin@example.test',
        name: 'Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      session: { id: 'session-id', expiresAt: new Date('2027-01-01T00:00:00.000Z') },
      requestId: 'request-id',
      correlationId: 'correlation-id',
    });

    expect(actor).toMatchObject({
      userId: 'user-id',
      email: 'admin@example.test',
      displayName: 'Admin',
      role: 'ADMIN',
      sessionId: 'session-id',
      sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      requestId: 'request-id',
      correlationId: 'correlation-id',
    });
    expect(actor.permissions).toContain('catalog.room.manage');
    expect(actor.permissions).toContain('audit.read');
    expect(JSON.stringify(actor)).not.toMatch(/token|password|hash/i);
  });
});
