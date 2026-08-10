import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { VersioningType } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrateDatabase } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import { AppModule } from '../../src/app.module.js';
import { AdminSessionService } from '../../src/auth/admin-session.service.js';
import type { ActorContext } from '../../src/auth/actor-context.js';
import { ProblemDetailsFilter } from '../../src/errors/problem-details.filter.js';

const ids = {
  property: '00000000-0000-4000-8000-000000b0ff01',
  nightPlan: '00000000-0000-4000-8000-000000b0ff11',
  extraHourPlan: '00000000-0000-4000-8000-000000b0ff12',
  standardTier: '00000000-0000-4000-8000-000000b0ff21',
  deluxeTier: '00000000-0000-4000-8000-000000b0ff22',
  signatureTier: '00000000-0000-4000-8000-000000b0ff23',
  admin: '00000000-0000-4000-8000-000000b0ff99',
};

const EXACT_PRODUCTION_PRICES = {
  STANDARD: { NIGHT: 499_000n, EXTRA_HOUR: 80_000n },
  DELUXE: { NIGHT: 589_000n, EXTRA_HOUR: 95_000n },
  SIGNATURE: { NIGHT: 689_000n, EXTRA_HOUR: 110_000n },
};

describe('Operations V3 B0 production remediation bootstrap', () => {
  let database: GuardedTestDatabase;
  let application: NestFastifyApplication;

  const mockSuperAdmin: ActorContext = {
    userId: ids.admin,
    email: 'test-super-admin@peacenest.vn',
    displayName: 'Test Super Admin',
    role: 'ADMIN',
    profileCode: 'SUPER_ADMIN',
    accountStatus: 'ACTIVE',
    permissions: ['pricing.policy.draft.create', 'pricing.policy.draft.update'],
    sessionId: randomUUID(),
    sessionExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    requestId: randomUUID(),
    propertyIds: 'ALL',
  };

  function configureApp(app: NestFastifyApplication): void {
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  }

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined)
      throw new Error('TEST_DATABASE_URL required for production remediation integration test');

    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );

    // Insert test data: property, rate plans, tiers, admin user
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
       VALUES ($1, 'B0_REMEDIATION_TEST', 'B0 Remediation Test Property', 'Asia/Ho_Chi_Minh')`,
      [ids.property],
    );

    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES
       ($1, $2, 'STANDARD', 'Standard', 1),
       ($3, $2, 'DELUXE', 'Deluxe', 2),
       ($4, $2, 'SIGNATURE', 'Signature', 3)`,
      [ids.standardTier, ids.property, ids.deluxeTier, ids.signatureTier],
    );

    await database.pool.query(
      `INSERT INTO rate_plans
       (id, property_id, code, name, status, included_duration_minutes, priority, is_base_plan,
         min_duration_minutes_inclusive, max_duration_minutes_inclusive)
       VALUES
        ($1, $2, 'B0_NIGHT', 'B0 Night', 'ACTIVE', 720, 1, true, 60, 1440),
        ($3, $2, 'EXTRA_HOUR', 'B0 Extra Hour', 'ACTIVE', 60, 2, false, NULL, NULL)`,
      [ids.nightPlan, ids.property, ids.extraHourPlan],
    );

    const priceRows: Array<[string, string, bigint]> = [
      [ids.nightPlan, ids.standardTier, EXACT_PRODUCTION_PRICES.STANDARD.NIGHT],
      [ids.nightPlan, ids.deluxeTier, EXACT_PRODUCTION_PRICES.DELUXE.NIGHT],
      [ids.nightPlan, ids.signatureTier, EXACT_PRODUCTION_PRICES.SIGNATURE.NIGHT],
      [ids.extraHourPlan, ids.standardTier, EXACT_PRODUCTION_PRICES.STANDARD.EXTRA_HOUR],
      [ids.extraHourPlan, ids.deluxeTier, EXACT_PRODUCTION_PRICES.DELUXE.EXTRA_HOUR],
      [ids.extraHourPlan, ids.signatureTier, EXACT_PRODUCTION_PRICES.SIGNATURE.EXTRA_HOUR],
    ];
    for (const [ratePlanId, priceTierId, amount] of priceRows) {
      await database.pool.query(
        `INSERT INTO rate_plan_prices (id, property_id, rate_plan_id, price_tier_id, amount_vnd)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), ids.property, ratePlanId, priceTierId, amount],
      );
    }

    await database.pool.query(
      `INSERT INTO users (id, email, name, role) VALUES
       ($1, 'b0-super-admin@remediation.test', 'B0 Super Admin', 'ADMIN')`,
      [ids.admin],
    );

    // The production environment schema rejects `localhost` hosts and the
    // shared placeholder secrets, so build a production-valid configuration
    // that still targets the disposable loopback database via 127.0.0.1.
    const productionDatabaseUrl = database.databaseUrl.replace('localhost', '127.0.0.1');
    Object.assign(process.env, {
      NODE_ENV: 'production',
      LOG_LEVEL: 'silent',
      API_HOST: '127.0.0.1',
      API_PORT: '3299',
      WEB_ORIGIN: 'https://remediation.test',
      AUTH_BASE_URL: 'https://remediation.test/api',
      DATABASE_URL: productionDatabaseUrl,
      REDIS_URL: 'redis://127.0.0.1:6379',
      MAIL_HOST: '127.0.0.1',
      MAIL_PORT: '1025',
      MAIL_FROM: 'no-reply@remediation.test',
      BETTER_AUTH_SECRET: 'production-remediation-better-auth-secret-thirty-two-plus',
      GUEST_OTP_SECRET: 'prod-remediation-guest-otp-secret-value-aaaaaaa',
      GUEST_CHALLENGE_REF_SECRET: 'prod-remediation-challenge-ref-secret-bbbbbbbb',
      GUEST_SESSION_SECRET: 'prod-remediation-guest-session-secret-cccccccc',
      BOOKING_IP_DIGEST_SECRET: 'prod-remediation-ip-digest-secret-dddddddddd',
      BOOKING_ACCESS_QR_SECRET: 'prod-remediation-access-qr-secret-eeeeeeeeee',
      GOOGLE_AUTH_ENABLED: 'false',
      GOOGLE_TRANSLATION_ENABLED: 'false',
      MOMO_ENABLED: 'false',
      VNPAY_ENABLED: 'false',
      PAYMENT_DEMO_ENABLED: 'false',
      OPERATIONS_V3_PRICING_CATALOG_RUNTIME_ENABLED: 'true',
      OPERATIONS_V3_MULTI_NIGHT_PRICING_ENABLED: 'false',
      OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: 'false',
      OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: 'false',
      OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: 'true',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AdminSessionService)
      .useValue({
        getActor: async () => mockSuperAdmin,
      })
      .compile();

    application = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      logger: false,
    });
    configureApp(application);
    await application.init();
  }, 180_000);

  afterAll(async () => {
    await application?.close();
    await database?.dispose();
  }, 60_000);

  it('creates V2 draft through production remediation HTTP path with canonical UUIDs', async () => {
    const effectiveFrom = new Date('2026-08-10T00:00:00+07:00');
    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/admin/pricing-policies/bootstrap',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        idempotencyKey: 'b0-production-remediation-v2-creation',
        nightPlanCode: 'B0_NIGHT',
        extraHourPlanCode: 'EXTRA_HOUR',
        internalName: 'B0 V2 Production Remediation',
        effectiveFrom: effectiveFrom.toISOString(),
        overnightWindow: '21-09',
        dryRun: false,
      },
    });

    expect(response.statusCode).toBe(201);
    const result = response.json() as {
      publicationReady: boolean;
      versionNumber: string;
      created: boolean;
      idempotent: boolean;
      policyId: string;
    };
    expect(result).toMatchObject({
      publicationReady: true,
      versionNumber: '1',
      created: true,
      idempotent: false,
    });

    const policyId = result.policyId;
    expect(policyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const aggregate = await database.pool.query<{ id: string; component_code: string }>(
      `SELECT c.id, c.component_code
       FROM pricing_policy_components c
       JOIN pricing_policy_versions v ON v.id = c.policy_version_id
       WHERE v.id = $1
       ORDER BY c.component_code`,
      [policyId],
    );

    expect(aggregate.rows).toHaveLength(4);
    expect(aggregate.rows.map((r) => r.component_code)).toEqual([
      'B0_CONTINUATION',
      'B0_FINAL_NIGHT',
      'B0_LEADING',
      'B0_TRAILING',
    ]);

    for (const row of aggregate.rows) {
      expect(row.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }

    const prices = await database.pool.query<{
      component_code: string;
      tier_code: string;
      amount_vnd: string;
    }>(
      `SELECT c.component_code, t.code AS tier_code, p.amount_vnd
       FROM pricing_policy_component_prices p
       JOIN pricing_policy_components c ON c.id = p.component_id
       JOIN price_tiers t ON t.id = p.price_tier_id
       JOIN pricing_policy_versions v ON v.id = c.policy_version_id
       WHERE v.id = $1
       ORDER BY c.component_code, t.sort_order`,
      [policyId],
    );

    expect(prices.rows).toHaveLength(12);

    const nightRows = prices.rows.filter(
      (r) => r.component_code === 'B0_CONTINUATION' || r.component_code === 'B0_FINAL_NIGHT',
    );
    const extraRows = prices.rows.filter(
      (r) => r.component_code === 'B0_LEADING' || r.component_code === 'B0_TRAILING',
    );

    for (const row of nightRows) {
      if (row.tier_code === 'STANDARD')
        expect(row.amount_vnd).toBe(EXACT_PRODUCTION_PRICES.STANDARD.NIGHT.toString());
      else if (row.tier_code === 'DELUXE')
        expect(row.amount_vnd).toBe(EXACT_PRODUCTION_PRICES.DELUXE.NIGHT.toString());
      else if (row.tier_code === 'SIGNATURE')
        expect(row.amount_vnd).toBe(EXACT_PRODUCTION_PRICES.SIGNATURE.NIGHT.toString());
    }

    for (const row of extraRows) {
      if (row.tier_code === 'STANDARD')
        expect(row.amount_vnd).toBe(EXACT_PRODUCTION_PRICES.STANDARD.EXTRA_HOUR.toString());
      else if (row.tier_code === 'DELUXE')
        expect(row.amount_vnd).toBe(EXACT_PRODUCTION_PRICES.DELUXE.EXTRA_HOUR.toString());
      else if (row.tier_code === 'SIGNATURE')
        expect(row.amount_vnd).toBe(EXACT_PRODUCTION_PRICES.SIGNATURE.EXTRA_HOUR.toString());
    }
  });

  it('refuses production remediation when gate is disabled (relock)', async () => {
    process.env.OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED = 'false';

    await application.close();
    const relockModuleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AdminSessionService)
      .useValue({
        getActor: async () => mockSuperAdmin,
      })
      .compile();
    application = relockModuleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    );
    configureApp(application);
    await application.init();

    const response = await application.inject({
      method: 'POST',
      url: '/api/v1/admin/pricing-policies/bootstrap',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        idempotencyKey: 'b0-relock-test',
        nightPlanCode: 'B0_NIGHT',
        extraHourPlanCode: 'EXTRA_HOUR',
        internalName: 'B0 Relock Test',
        effectiveFrom: new Date('2026-08-11T00:00:00+07:00').toISOString(),
        overnightWindow: '21-09',
        dryRun: false,
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      type: 'service-unavailable',
      status: 503,
      code: 'PRICING_POLICY_BOOTSTRAP_DISABLED',
    });
  });
});
