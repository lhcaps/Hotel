import { ServiceUnavailableException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from '../src/health/health.controller.js';
import { HealthService, ReadinessError } from '../src/health/health.service.js';

describe('HealthController', () => {
  it('returns a sanitized 503 body with the server request ID', async () => {
    const readinessError = new ReadinessError({
      configuration: 'up',
      postgres: 'up',
      schema: 'down',
      redis: 'up',
    });
    Object.assign(readinessError, {
      cause: new Error('postgresql://user:secret@host/schema_metadata SELECT migration'),
    });
    const healthService = {
      ready: vi.fn().mockRejectedValue(readinessError),
    } as unknown as HealthService;
    const controller = new HealthController(healthService);
    const request = {
      id: 'server-request-503',
      headers: {},
    } as FastifyRequest;

    let caught: unknown;
    try {
      await controller.ready(request);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ServiceUnavailableException);
    const exception = caught as ServiceUnavailableException;
    expect(exception.getStatus()).toBe(503);
    expect(exception.getResponse()).toEqual({
      service: 'api',
      status: 'not_ready',
      checks: { configuration: 'up', postgres: 'up', schema: 'down', redis: 'up' },
      requestId: 'server-request-503',
    });
    expect(JSON.stringify(exception.getResponse())).not.toMatch(
      /postgresql|secret|schema_metadata|select|migration/i,
    );
  });
});
