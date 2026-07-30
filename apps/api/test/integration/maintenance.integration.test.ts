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
  permissions: ['catalog.maintenance.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'maintenance-integration',
};
describe('maintenance inventory ledger', () => {
  let database: GuardedTestDatabase;
  let catalog: CatalogService;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (d) =>
      migrateDatabase(d.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    catalog = new CatalogService(client, new CatalogRepository(client), new AuditRepository());
    await database.pool.query(
      `INSERT INTO properties (id,code,name,timezone) VALUES ('550e8400-e29b-41d4-a716-446655440010','MAIN','Main','Asia/Ho_Chi_Minh');INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES ('550e8400-e29b-41d4-a716-446655440020','550e8400-e29b-41d4-a716-446655440010','STANDARD','Standard',0);INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy) VALUES ('550e8400-e29b-41d4-a716-446655440030','550e8400-e29b-41d4-a716-446655440010','550e8400-e29b-41d4-a716-446655440020','DLX','Deluxe',2,0,2);INSERT INTO rooms (id,property_id,room_type_id,room_number) VALUES ('550e8400-e29b-41d4-a716-446655440040','550e8400-e29b-41d4-a716-446655440010','550e8400-e29b-41d4-a716-446655440030','101');`,
    );
  });
  afterAll(async () => database?.dispose());
  it('creates and cancels source plus ledger atomically, retaining touching-range availability', async () => {
    const first = await catalog.createMaintenanceBlock(actor, {
      roomId: '550e8400-e29b-41d4-a716-446655440040',
      startsAt: '2027-01-01T10:00:00.000Z',
      endsAt: '2027-01-01T12:00:00.000Z',
      reason: 'Repair',
    });
    await expect(catalog.listMaintenanceBlocks({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: first.id, status: 'ACTIVE' })],
    });
    await expect(
      catalog.createMaintenanceBlock(actor, {
        roomId: '550e8400-e29b-41d4-a716-446655440040',
        startsAt: '2027-01-01T11:00:00.000Z',
        endsAt: '2027-01-01T13:00:00.000Z',
        reason: 'Overlap',
      }),
    ).rejects.toBeInstanceOf(CatalogConflictError);
    await catalog.cancelMaintenanceBlock(actor, first.id);
    await expect(catalog.cancelMaintenanceBlock(actor, first.id)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    const audit = await database.pool.query<{ event_type: string }>(
      'SELECT event_type FROM audit_events WHERE aggregate_id = $1 ORDER BY occurred_at ASC',
      [first.id],
    );
    expect(audit.rows.map((row) => row.event_type)).toEqual([
      'MAINTENANCE_CREATED',
      'MAINTENANCE_CANCELLED',
    ]);
    await expect(
      catalog.createMaintenanceBlock(actor, {
        roomId: '550e8400-e29b-41d4-a716-446655440040',
        startsAt: '2027-01-01T12:00:00.000Z',
        endsAt: '2027-01-01T13:00:00.000Z',
        reason: 'Touching',
      }),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
  });
});
