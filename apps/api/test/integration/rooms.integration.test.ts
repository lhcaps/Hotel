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
  permissions: ['catalog.room.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'rooms-integration',
};

describe('physical room catalog transactions', () => {
  let database: GuardedTestDatabase;
  let catalog: CatalogService;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    catalog = new CatalogService(client, new CatalogRepository(client), new AuditRepository());
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone) VALUES ('550e8400-e29b-41d4-a716-446655440010','MAIN','Main','Asia/Ho_Chi_Minh'); INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ('550e8400-e29b-41d4-a716-446655440020','550e8400-e29b-41d4-a716-446655440010','STANDARD','Standard',0); INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy) VALUES ('550e8400-e29b-41d4-a716-446655440030','550e8400-e29b-41d4-a716-446655440010','550e8400-e29b-41d4-a716-446655440020','DLX','Deluxe',2,0,2);`,
    );
  });
  afterAll(async () => database?.dispose());
  it('creates, archives, and deterministically lists rooms without hard deletion', async () => {
    const room = await catalog.createRoom(actor, {
      roomTypeId: '550e8400-e29b-41d4-a716-446655440030',
      roomNumber: '101',
    });
    await expect(
      catalog.createRoom(actor, {
        roomTypeId: '550e8400-e29b-41d4-a716-446655440030',
        roomNumber: '101',
      }),
    ).rejects.toBeInstanceOf(CatalogConflictError);
    await expect(catalog.archiveRoom(actor, room.id, { archive: true })).resolves.toMatchObject({
      status: 'INACTIVE',
    });
    await expect(catalog.listRooms({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [expect.objectContaining({ roomNumber: '101', status: 'INACTIVE' })],
    });
  });

  it('advances the turnover task with the required DIRTY, CLEANING, CLEAN lifecycle', async () => {
    const room = await catalog.createRoom(actor, {
      roomTypeId: '550e8400-e29b-41d4-a716-446655440030',
      roomNumber: '102',
    });
    await database.pool.query(`UPDATE rooms SET housekeeping_status = 'DIRTY' WHERE id = $1`, [
      room.id,
    ]);
    await database.pool.query(
      `INSERT INTO housekeeping_tasks (property_id, room_id, type, status, due_at)
       VALUES ($2, $1, 'TURNOVER', 'DUE', CURRENT_TIMESTAMP)`,
      [room.id, room.propertyId],
    );

    await expect(
      catalog.updateRoomHousekeeping(actor, room.id, { status: 'CLEAN' }),
    ).rejects.toMatchObject({
      code: 'ROOM_HOUSEKEEPING_INVALID_TRANSITION',
    });
    await expect(
      catalog.updateRoomHousekeeping(actor, room.id, { status: 'CLEANING' }),
    ).resolves.toMatchObject({ housekeepingStatus: 'CLEANING' });
    expect(
      (
        await database.pool.query<{ status: string; started_at: Date | null }>(
          `SELECT status, started_at FROM housekeeping_tasks WHERE room_id = $1`,
          [room.id],
        )
      ).rows[0],
    ).toMatchObject({ status: 'IN_PROGRESS', started_at: expect.any(Date) });

    await expect(
      catalog.updateRoomHousekeeping(actor, room.id, { status: 'CLEAN' }),
    ).resolves.toMatchObject({
      housekeepingStatus: 'CLEAN',
    });
    expect(
      (
        await database.pool.query<{ status: string; completed_at: Date | null }>(
          `SELECT status, completed_at FROM housekeeping_tasks WHERE room_id = $1`,
          [room.id],
        )
      ).rows[0],
    ).toMatchObject({ status: 'DONE', completed_at: expect.any(Date) });
  });
});
