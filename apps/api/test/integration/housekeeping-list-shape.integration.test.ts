import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { AuditRepository } from '../../src/catalog/audit.repository.js';
import { CatalogRepository } from '../../src/catalog/catalog.repository.js';
import { CatalogService } from '../../src/catalog/catalog.service.js';

const managerActor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440500',
  email: 'manager@example.test',
  displayName: 'Housekeeping Manager',
  role: 'ADMIN',
  profileCode: 'HOUSEKEEPING_MANAGER',
  permissions: ['housekeeping.task.manage', 'housekeeping.task.read'],
  propertyIds: ['550e8400-e29b-41d4-a716-446655440510'],
  sessionId: '550e8400-e29b-41d4-a716-446655440501',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'housekeeping-list-shape',
};

const propertyId = '550e8400-e29b-41d4-a716-446655440510';
const tierId = '550e8400-e29b-41d4-a716-446655440511';
const roomTypeId = '550e8400-e29b-41d4-a716-446655440512';

describe('housekeeping list API contract', () => {
  let database: GuardedTestDatabase;
  let catalog: CatalogService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
      const client = createDatabaseClient(prepared.pool);
      await prepared.pool.query(
        `INSERT INTO users (id, name, email, role, status)
         VALUES ('550e8400-e29b-41d4-a716-446655440500', 'Manager', 'manager@example.test', 'ADMIN', 'ACTIVE');
         INSERT INTO properties (id, code, name, timezone) VALUES ('${propertyId}','HK','Housekeeping Test','Asia/Ho_Chi_Minh');
         INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ('${tierId}','${propertyId}','STD','Standard',0);
         INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
         VALUES ('${roomTypeId}','${propertyId}','${tierId}','STD','Standard',2,0,2);`,
      );
      catalog = new CatalogService(client, new CatalogRepository(client), new AuditRepository());
    });
  });

  afterAll(async () => database?.dispose());

  it('returns the {items:[...]} envelope from the service seam', async () => {
    const inserted = await database.pool.query<{ id: string }>(
      `INSERT INTO rooms (property_id, room_type_id, room_number, physical_room_code, status, housekeeping_status)
       VALUES ($1, $2, 'HK-1', 'HK-1', 'ACTIVE', 'DIRTY') RETURNING id`,
      [propertyId, roomTypeId],
    );
    const roomId = inserted.rows[0]?.id;
    expect(roomId).toBeDefined();
    await database.pool.query(
      `INSERT INTO housekeeping_tasks (property_id, room_id, type, status, due_at)
       VALUES ($1, $2, 'TURNOVER', 'DUE', CURRENT_TIMESTAMP)`,
      [propertyId, roomId],
    );
    const result = await catalog.listHousekeepingTasks(managerActor);
    expect(Array.isArray(result)).toBe(false);
    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          type: 'TURNOVER',
          status: 'DUE',
          housekeepingStatus: 'DIRTY',
        }),
      ],
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('returns {items: []} when no tasks exist', async () => {
    const result = await catalog.listHousekeepingTasks(managerActor);
    expect(Array.isArray(result)).toBe(false);
    expect(Array.isArray(result.items)).toBe(true);
    for (const item of result.items) {
      expect(typeof item.taskId).toBe('string');
      expect(item.type).toMatch(/^(ARRIVAL_PREP|TURNOVER)$/);
      expect(item.status).toMatch(/^(SCHEDULED|DUE|IN_PROGRESS|DONE|CANCELLED)$/);
    }
  });
});
