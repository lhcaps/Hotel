import { EXPECTED_SCHEMA_VERSION, type SchemaStatus } from '@room/database';
import { describe, expect, it, vi } from 'vitest';

import { HealthService } from '../src/health/health.service.js';

const environment = {
  NODE_ENV: 'test' as const,
  LOG_LEVEL: 'silent' as const,
  API_HOST: '127.0.0.1',
  API_PORT: 3001,
  WEB_ORIGIN: 'http://localhost:3000',
  AUTH_BASE_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://room:room@localhost:5432/room_management',
  REDIS_URL: 'redis://localhost:6379',
  MAIL_HOST: 'localhost',
  MAIL_PORT: 1025,
  MAIL_FROM: 'no-reply@room-management.local',
  BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
  GUEST_OTP_SECRET: 'test-guest-otp-secret-32-chars-min-aaaaaa',
  GUEST_CHALLENGE_REF_SECRET: 'test-challenge-ref-secret-32-chars-aaaa',
  GUEST_SESSION_SECRET: 'test-guest-session-secret-32-chars-aaaa',
  BOOKING_IP_DIGEST_SECRET: 'test-ip-digest-secret-32-chars-aaaaa',
  BOOKING_HOLD_DURATION_MS: 900_000,
  GUEST_OTP_TTL_MS: 600_000,
  GUEST_OTP_RESEND_COOLDOWN_MS: 60_000,
  GUEST_OTP_REQUEST_WINDOW_MS: 900_000,
  GUEST_OTP_REQUEST_LIMIT: 3,
  GUEST_OTP_IP_WINDOW_MS: 3_600_000,
  GUEST_OTP_IP_LIMIT: 20,
  GUEST_SESSION_TTL_MS: 1_800_000,
  TRUSTED_PROXY_CIDRS: '',
  MOMO_ENABLED: false,
  MOMO_ENVIRONMENT: 'sandbox' as const,
  PAYMENT_DEMO_ENABLED: false,
  MOMO_REQUEST_TYPE: 'captureWallet' as const,
  MOMO_REQUEST_TIMEOUT_MS: 30_000,
  VNPAY_ENABLED: false,
  VNPAY_ENVIRONMENT: 'sandbox' as const,
  VNPAY_REQUEST_TIMEOUT_MS: 10_000,
  GOOGLE_AUTH_ENABLED: false,
  GOOGLE_TRANSLATION_ENABLED: false,
  GOOGLE_TRANSLATION_TIMEOUT_MS: 3_000,
  ROOM_TEST_OAUTH_BROWSER_ENABLED: false,
  PAYMENT_RECONCILIATION_MAX_ATTEMPTS: 8,
  PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: [60_000, 300_000, 900_000, 3_600_000, 14_400_000],
};

const currentSchema: SchemaStatus = {
  ready: true,
  actualVersion: EXPECTED_SCHEMA_VERSION,
  expectedVersion: EXPECTED_SCHEMA_VERSION,
};

function databaseWith(schemaStatus: SchemaStatus = currentSchema) {
  return {
    ping: vi.fn().mockResolvedValue(undefined),
    schemaStatus: vi.fn().mockResolvedValue(schemaStatus),
  };
}

describe('HealthService', () => {
  it('reports liveness without probing infrastructure', async () => {
    const database = databaseWith();
    const redis = vi.fn().mockRejectedValue(new Error('must not be called'));
    const service = new HealthService(environment, database, redis);

    await expect(service.live()).resolves.toEqual({
      service: 'api',
      status: 'ok',
      checks: { process: 'up' },
    });
    expect(database.ping).not.toHaveBeenCalled();
    expect(database.schemaStatus).not.toHaveBeenCalled();
    expect(redis).not.toHaveBeenCalled();
  });

  it('reports readiness when PostgreSQL, the schema and Redis are current', async () => {
    const service = new HealthService(
      environment,
      databaseWith(),
      vi.fn().mockResolvedValue(undefined),
    );

    await expect(service.ready()).resolves.toEqual({
      service: 'api',
      status: 'ready',
      checks: { configuration: 'up', postgres: 'up', schema: 'up', redis: 'up' },
    });
  });

  it.each([
    ['missing', null],
    ['mismatched', 'phase-1'],
  ])(
    'reports PostgreSQL up but schema down when the schema is %s',
    async (_name, actualVersion) => {
      const service = new HealthService(
        environment,
        databaseWith({
          ready: false,
          actualVersion,
          expectedVersion: EXPECTED_SCHEMA_VERSION,
        }),
        vi.fn().mockResolvedValue(undefined),
      );

      await expect(service.ready({ requestId: 'request-schema' })).rejects.toMatchObject({
        checks: { configuration: 'up', postgres: 'up', schema: 'down', redis: 'up' },
      });
    },
  );

  it('reports PostgreSQL and schema down when PostgreSQL is unavailable', async () => {
    const database = databaseWith();
    database.ping.mockRejectedValue(new Error('postgresql://user:secret@database/private'));
    const service = new HealthService(environment, database, vi.fn().mockResolvedValue(undefined));

    await expect(service.ready({ requestId: 'request-postgres' })).rejects.toMatchObject({
      checks: { configuration: 'up', postgres: 'down', schema: 'down', redis: 'up' },
    });
    expect(database.schemaStatus).not.toHaveBeenCalled();
  });

  it('reports Redis down while PostgreSQL and schema remain up', async () => {
    const service = new HealthService(
      environment,
      databaseWith(),
      vi.fn().mockRejectedValue(new Error('redis://:secret@cache/private')),
    );

    await expect(service.ready({ requestId: 'request-redis' })).rejects.toMatchObject({
      checks: { configuration: 'up', postgres: 'up', schema: 'up', redis: 'down' },
    });
  });
});
