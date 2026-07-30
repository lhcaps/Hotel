import { describe, expect, it } from 'vitest';

import { createApiHttpAdapter } from '../src/http-adapter.js';

describe('API request IDs', () => {
  it('uses a server-generated UUID instead of trusting a supplied request ID', async () => {
    const adapter = createApiHttpAdapter();
    const fastify = adapter.getInstance();
    fastify.get('/request-id', async (request) => ({ requestId: request.id }));

    try {
      const response = await fastify.inject({
        method: 'GET',
        url: '/request-id',
        headers: { 'x-request-id': 'attacker-controlled\r\nvalue' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatch(
        /^\{"requestId":"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"\}$/i,
      );
      expect(response.body).not.toContain('attacker-controlled');
    } finally {
      await fastify.close();
    }
  });
});
