import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { AuditRepository } from '../../src/catalog/audit.repository.js';
import { CatalogConflictError } from '../../src/catalog/catalog.errors.js';
import { CatalogRepository } from '../../src/catalog/catalog.repository.js';
import { CatalogService } from '../../src/catalog/catalog.service.js';

const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['catalog.property.manage', 'catalog.price_tier.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'integration-request',
};

function service(database: DatabaseClient, audit = new AuditRepository()): CatalogService {
  return new CatalogService(database, new CatalogRepository(database), audit);
}

describe('property and price-tier catalog transactions', () => {
  let database: GuardedTestDatabase;
  let client: DatabaseClient;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required for integration tests');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    client = createDatabaseClient(database.pool);
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
       VALUES ('550e8400-e29b-41d4-a716-446655440010', 'MAIN', 'Main property', 'Asia/Ho_Chi_Minh')`,
    );
  });

  afterAll(async () => {
    await database?.dispose();
  });

  it('persists a property update and its scrubbed audit event atomically', async () => {
    const result = await service(client).updateProperty(actor, {
      code: 'main-renamed',
      name: 'Renamed property',
    });

    expect(result).toMatchObject({
      code: 'MAIN-RENAMED',
      name: 'Renamed property',
      currency: 'VND',
    });
    await expect(
      database.pool.query(`SELECT code, name FROM properties WHERE id = $1`, [result.id]),
    ).resolves.toMatchObject({ rows: [{ code: 'MAIN-RENAMED', name: 'Renamed property' }] });
    await expect(
      database.pool.query(
        `SELECT aggregate_type, event_type, actor_id, payload
           FROM audit_events
          WHERE aggregate_id = $1`,
        [result.id],
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          aggregate_type: 'PROPERTY',
          event_type: 'PROPERTY_UPDATED',
          actor_id: actor.userId,
          payload: { code: 'MAIN-RENAMED', name: 'Renamed property' },
        },
      ],
    });
  });

  it('rolls back the catalog mutation if audit persistence fails', async () => {
    const failingAudit = {
      write: async (): Promise<void> => Promise.reject(new Error('audit unavailable')),
    };
    await expect(
      service(client, failingAudit).updateProperty(actor, {
        code: 'BROKEN',
        name: 'Should not persist',
      }),
    ).rejects.toThrow('audit unavailable');
    await expect(database.pool.query(`SELECT code FROM properties LIMIT 1`)).resolves.toMatchObject(
      {
        rows: [{ code: 'MAIN-RENAMED' }],
      },
    );
  });

  it('maps duplicate price tiers to a conflict and keeps the existing row', async () => {
    const catalog = service(client);
    await catalog.createPriceTier(actor, { code: 'standard', name: 'Standard', sortOrder: 0 });
    await expect(
      catalog.createPriceTier(actor, { code: 'standard', name: 'Different name', sortOrder: 1 }),
    ).rejects.toBeInstanceOf(CatalogConflictError);
    await expect(
      database.pool.query(`SELECT code, name FROM price_tiers ORDER BY code`),
    ).resolves.toMatchObject({ rows: [{ code: 'STANDARD', name: 'Standard' }] });
  });

  it('updates and archives a tier as audited state transitions without deleting history', async () => {
    const catalog = service(client);
    const tier = await catalog.createPriceTier(actor, {
      code: 'premium',
      name: 'Premium',
      sortOrder: 2,
    });
    await expect(
      catalog.updatePriceTier(actor, tier.id, {
        code: 'premium-plus',
        name: 'Premium Plus',
        sortOrder: 3,
      }),
    ).resolves.toMatchObject({ code: 'PREMIUM-PLUS', status: 'ACTIVE' });
    await expect(
      catalog.archivePriceTier(actor, tier.id, { archive: true }),
    ).resolves.toMatchObject({
      status: 'INACTIVE',
    });
    await expect(
      database.pool.query(`SELECT code, status FROM price_tiers WHERE id = $1`, [tier.id]),
    ).resolves.toMatchObject({ rows: [{ code: 'PREMIUM-PLUS', status: 'INACTIVE' }] });
    await expect(
      database.pool.query(
        `SELECT count(*)::int AS count FROM audit_events WHERE aggregate_id = $1`,
        [tier.id],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 3 }] });
  });
});
