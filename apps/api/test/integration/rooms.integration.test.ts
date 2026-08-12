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
import { RoomOperationsRepository } from '../../src/booking/repositories/room-operations.repository.js';
import { RoomOperationsService } from '../../src/booking/services/room-operations.service.js';

const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['catalog.room.manage'],
  propertyIds: ['550e8400-e29b-41d4-a716-446655440010'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'rooms-integration',
};

const cleanerId = '550e8400-e29b-41d4-a716-446655440002';
const replacementCleanerId = '550e8400-e29b-41d4-a716-446655440003';
const crossPropertyCleanerId = '550e8400-e29b-41d4-a716-446655440004';
const cleanerActor: ActorContext = {
  ...actor,
  userId: cleanerId,
  email: 'cleaner@example.test',
  displayName: 'Cleaner',
  profileCode: 'HOUSEKEEPING_STAFF',
  permissions: ['housekeeping.task.update'],
};
const replacementCleanerActor: ActorContext = {
  ...cleanerActor,
  userId: replacementCleanerId,
  email: 'replacement.cleaner@example.test',
  displayName: 'Replacement cleaner',
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
      `INSERT INTO users (id, name, email, role, status)
       VALUES
         ($1, 'Administrator', 'admin@example.test', 'SUPER_ADMIN', 'ACTIVE'),
         ($2, 'Cleaner', 'cleaner@example.test', 'ADMIN', 'ACTIVE'),
         ($3, 'Replacement cleaner', 'replacement-cleaner@example.test', 'ADMIN', 'ACTIVE')`,
      [actor.userId, cleanerId, replacementCleanerId],
    );
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone) VALUES ('550e8400-e29b-41d4-a716-446655440010','MAIN','Main','Asia/Ho_Chi_Minh');
       INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ('550e8400-e29b-41d4-a716-446655440020','550e8400-e29b-41d4-a716-446655440010','STANDARD','Standard',0);
       INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy) VALUES ('550e8400-e29b-41d4-a716-446655440030','550e8400-e29b-41d4-a716-446655440010','550e8400-e29b-41d4-a716-446655440020','DLX','Deluxe',2,0,2);
       INSERT INTO admin_departments (id, code, name) VALUES ('550e8400-e29b-41d4-a716-446655440040','HOUSEKEEPING','Housekeeping');
       INSERT INTO admin_memberships (user_id, department_id, role, status) VALUES
         ('550e8400-e29b-41d4-a716-446655440002','550e8400-e29b-41d4-a716-446655440040','HOUSEKEEPING_STAFF','ACTIVE'),
         ('550e8400-e29b-41d4-a716-446655440003','550e8400-e29b-41d4-a716-446655440040','HOUSEKEEPING_STAFF','ACTIVE');
       INSERT INTO admin_property_memberships (user_id, property_id, status) VALUES
         ('550e8400-e29b-41d4-a716-446655440002','550e8400-e29b-41d4-a716-446655440010','ACTIVE'),
         ('550e8400-e29b-41d4-a716-446655440003','550e8400-e29b-41d4-a716-446655440010','ACTIVE');`,
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
    await expect(catalog.listRooms(actor, { page: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [expect.objectContaining({ roomNumber: '101', status: 'INACTIVE' })],
    });
  });

  it('keeps PEACE_HOME concept placeholders out of physical-room views', async () => {
    const peaceHomePropertyId = '550e8400-e29b-41d4-a716-446655440011';
    const peaceHomeTierId = '550e8400-e29b-41d4-a716-446655440021';
    const peaceHomeRoomTypeId = '550e8400-e29b-41d4-a716-446655440031';
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
         VALUES ($1, 'PEACE_HOME', 'Peace Home', 'Asia/Ho_Chi_Minh')`,
      [peaceHomePropertyId],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
         VALUES ($1, $2, 'STANDARD', 'Standard', 1)`,
      [peaceHomeTierId, peaceHomePropertyId],
    );
    await database.pool.query(
      `INSERT INTO room_types
         (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
         VALUES ($1, $2, $3, 'STANDARD', 'Standard', 2, 1, 3)`,
      [peaceHomeRoomTypeId, peaceHomePropertyId, peaceHomeTierId],
    );
    await database.pool.query(
      `INSERT INTO rooms
         (property_id, room_type_id, room_number, physical_room_code, status, housekeeping_status)
         VALUES
           ($1, $2, '94BDT-WabiG01', '94BDT-WabiG01', 'ACTIVE', 'CLEAN'),
           ($1, $2, 'Nami', 'Nami', 'ACTIVE', 'CLEAN')`,
      [peaceHomePropertyId, peaceHomeRoomTypeId],
    );

    const operations = new RoomOperationsService(new RoomOperationsRepository(database.pool));
    const response = await operations.list(
      peaceHomePropertyId,
      {
        from: '2027-02-10T00:00:00.000Z',
        to: '2027-02-10T08:00:00.000Z',
      },
      new Date('2027-02-10T00:00:00.000Z'),
      'PEACE_HOME',
    );
    expect(response.items.map((item) => item.physicalRoomCode)).toEqual(['94BDT-WabiG01']);

    const peaceHomeRooms = await new CatalogRepository(
      createDatabaseClient(database.pool),
    ).listRooms(peaceHomePropertyId, 1, 20, 'PEACE_HOME');
    expect(peaceHomeRooms.map((room) => room.physicalRoomCode)).toEqual(['94BDT-WabiG01']);
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
      catalog.assignRoomHousekeeping(actor, room.id, { assigneeId: cleanerId, expectedVersion: 0 }),
    ).resolves.toMatchObject({ assigneeId: cleanerId, version: 1 });
    const assignedTask = (
      await database.pool.query<{
        assigned_to: string | null;
        assigned_by: string | null;
        assigned_at: Date | null;
        version: number;
      }>(
        `SELECT assigned_to, assigned_by, assigned_at, version
           FROM housekeeping_tasks
          WHERE room_id = $1`,
        [room.id],
      )
    ).rows[0];
    expect(assignedTask).toMatchObject({
      assigned_to: cleanerId,
      assigned_by: actor.userId,
      version: 1,
    });
    expect(assignedTask?.assigned_at).toBeInstanceOf(Date);

    await expect(
      catalog.assignRoomHousekeeping(actor, room.id, {
        assigneeId: replacementCleanerId,
        expectedVersion: 1,
      }),
    ).resolves.toMatchObject({ assigneeId: replacementCleanerId, version: 2 });
    const reassignedTask = (
      await database.pool.query<{ assigned_to: string | null; version: number }>(
        `SELECT assigned_to, version FROM housekeeping_tasks WHERE room_id = $1`,
        [room.id],
      )
    ).rows[0];
    expect(reassignedTask).toEqual({ assigned_to: replacementCleanerId, version: 2 });
    await expect(
      catalog.assignRoomHousekeeping(actor, room.id, { assigneeId: cleanerId, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: 'ROOM_HOUSEKEEPING_ASSIGNMENT_CONFLICT' });

    await expect(
      catalog.updateRoomHousekeeping(actor, room.id, { status: 'CLEAN', expectedVersion: 2 }),
    ).rejects.toMatchObject({
      code: 'ROOM_HOUSEKEEPING_INVALID_TRANSITION',
    });
    await expect(
      catalog.updateRoomHousekeeping(cleanerActor, room.id, {
        status: 'CLEANING',
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_HOUSEKEEPING_VERSION_CONFLICT' });
    await expect(
      catalog.updateRoomHousekeeping(replacementCleanerActor, room.id, {
        status: 'CLEANING',
        expectedVersion: 2,
      }),
    ).resolves.toMatchObject({ housekeepingStatus: 'CLEANING' });
    const startedTask = (
      await database.pool.query<{
        status: string;
        started_at: Date | null;
        started_by: string | null;
        version: number;
      }>(
        `SELECT status, started_at, started_by, version FROM housekeeping_tasks WHERE room_id = $1`,
        [room.id],
      )
    ).rows[0];
    expect(startedTask?.status).toBe('IN_PROGRESS');
    expect(startedTask?.started_at).toBeInstanceOf(Date);
    expect(startedTask?.started_by).toBe(replacementCleanerActor.userId);
    expect(startedTask?.version).toBe(3);

    await expect(
      catalog.updateRoomHousekeeping(replacementCleanerActor, room.id, {
        status: 'CLEAN',
        expectedVersion: 3,
      }),
    ).resolves.toMatchObject({
      housekeepingStatus: 'CLEAN',
    });
    const completedTask = (
      await database.pool.query<{
        status: string;
        completed_at: Date | null;
        completed_by: string | null;
        version: number;
      }>(
        `SELECT status, completed_at, completed_by, version FROM housekeeping_tasks WHERE room_id = $1`,
        [room.id],
      )
    ).rows[0];
    expect(completedTask?.status).toBe('DONE');
    expect(completedTask?.completed_at).toBeInstanceOf(Date);
    expect(completedTask?.completed_by).toBe(replacementCleanerActor.userId);
    expect(completedTask?.version).toBe(4);

    await expect(
      catalog.verifyRoomHousekeeping(actor, room.id, { expectedVersion: 4 }),
    ).resolves.toMatchObject({ version: 5 });
    const verifiedTask = (
      await database.pool.query<{
        verified_by: string | null;
        verified_at: Date | null;
        version: number;
      }>(`SELECT verified_by, verified_at, version FROM housekeeping_tasks WHERE room_id = $1`, [
        room.id,
      ])
    ).rows[0];
    expect(verifiedTask).toMatchObject({ verified_by: actor.userId, version: 5 });
    expect(verifiedTask?.verified_at).toBeInstanceOf(Date);

    await expect(
      catalog.reopenRoomHousekeeping(actor, room.id, {
        expectedVersion: 5,
        reason: 'Verification found incomplete turnover.',
      }),
    ).resolves.toMatchObject({ version: 6 });
    const reopened = (
      await database.pool.query<{
        status: string;
        completed_at: Date | null;
        reopened_by: string | null;
        reopened_at: Date | null;
        reopen_reason: string | null;
        version: number;
        housekeeping_status: string;
      }>(
        `SELECT ht.status, ht.completed_at, ht.reopened_by, ht.reopened_at, ht.reopen_reason,
                ht.version, r.housekeeping_status
           FROM housekeeping_tasks ht
           JOIN rooms r ON r.id = ht.room_id
          WHERE ht.room_id = $1`,
        [room.id],
      )
    ).rows[0];
    expect(reopened).toMatchObject({
      status: 'DUE',
      completed_at: null,
      reopened_by: actor.userId,
      reopen_reason: 'Verification found incomplete turnover.',
      version: 6,
      housekeeping_status: 'DIRTY',
    });
    expect(reopened?.reopened_at).toBeInstanceOf(Date);
  });

  it('denies a turnover assignment to a staff member outside the room property', async () => {
    const room = await catalog.createRoom(actor, {
      roomTypeId: '550e8400-e29b-41d4-a716-446655440030',
      roomNumber: '104',
    });
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
         VALUES ('550e8400-e29b-41d4-a716-446655440050', 'OTHER', 'Other', 'Asia/Ho_Chi_Minh')`,
    );
    await database.pool.query(
      `INSERT INTO users (id, name, email, role, status)
         VALUES ($1, 'Other property cleaner', 'other.cleaner@example.test', 'ADMIN', 'ACTIVE')`,
      [crossPropertyCleanerId],
    );
    await database.pool.query(
      `INSERT INTO admin_memberships (user_id, department_id, role, status)
         VALUES ($1, '550e8400-e29b-41d4-a716-446655440040', 'HOUSEKEEPING_STAFF', 'ACTIVE')`,
      [crossPropertyCleanerId],
    );
    await database.pool.query(
      `INSERT INTO admin_property_memberships (user_id, property_id, status)
         VALUES ($1, '550e8400-e29b-41d4-a716-446655440050', 'ACTIVE')`,
      [crossPropertyCleanerId],
    );
    await database.pool.query(`UPDATE rooms SET housekeeping_status = 'DIRTY' WHERE id = $1`, [
      room.id,
    ]);
    await database.pool.query(
      `INSERT INTO housekeeping_tasks (property_id, room_id, type, status, due_at)
         VALUES ($1, $2, 'TURNOVER', 'DUE', CURRENT_TIMESTAMP)`,
      [room.propertyId, room.id],
    );

    await expect(
      catalog.assignRoomHousekeeping(actor, room.id, {
        assigneeId: crossPropertyCleanerId,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_HOUSEKEEPING_ASSIGNMENT_CONFLICT' });
    await expect(
      database.pool.query<{ assigned_to: string | null; version: number }>(
        `SELECT assigned_to, version FROM housekeeping_tasks WHERE room_id = $1`,
        [room.id],
      ),
    ).resolves.toMatchObject({ rows: [{ assigned_to: null, version: 0 }] });
  });

  it('does not render a future scheduled task as active cleaning work', async () => {
    const room = await catalog.createRoom(actor, {
      roomTypeId: '550e8400-e29b-41d4-a716-446655440030',
      roomNumber: '105',
    });
    await database.pool.query(
      `INSERT INTO housekeeping_tasks (property_id, room_id, type, status, due_at)
       VALUES ($1, $2, 'ARRIVAL_PREP', 'SCHEDULED', CURRENT_TIMESTAMP + interval '1 day')`,
      [room.propertyId, room.id],
    );
    const now = new Date();
    const response = await new RoomOperationsService(
      new RoomOperationsRepository(database.pool),
    ).list(
      room.propertyId,
      {
        from: now.toISOString(),
        to: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
      },
      now,
    );

    expect(response.items.find((item) => item.roomId === room.id)).toMatchObject({
      activeHousekeepingTask: null,
      displayGroup: 'ready',
    });
  });

  it('returns merged inventory-free windows and the active housekeeping task from PostgreSQL', async () => {
    const room = await catalog.createRoom(actor, {
      roomTypeId: '550e8400-e29b-41d4-a716-446655440030',
      roomNumber: '103',
    });
    const maintenance = await database.pool.query<{ id: string }>(
      `INSERT INTO maintenance_blocks (property_id, room_id, starts_at, ends_at, reason)
       VALUES ($1, $2, '2027-02-10T01:00:00.000Z', '2027-02-10T03:00:00.000Z', 'test')
       RETURNING id`,
      [room.propertyId, room.id],
    );
    await database.pool.query(
      `INSERT INTO room_inventory_blocks
         (property_id, room_id, maintenance_block_id, block_type, status, starts_at, ends_at)
       VALUES ($1, $2, $3, 'MAINTENANCE', 'ACTIVE', '2027-02-10T05:00:00.000Z', '2027-02-10T06:00:00.000Z')`,
      [room.propertyId, room.id, maintenance.rows[0]?.id],
    );
    await database.pool.query(
      `INSERT INTO housekeeping_tasks (property_id, room_id, type, status, due_at)
       VALUES ($1, $2, 'TURNOVER', 'DUE', '2027-02-10T01:00:00.000Z')`,
      [room.propertyId, room.id],
    );
    const operations = new RoomOperationsService(new RoomOperationsRepository(database.pool));

    const response = await operations.list(room.propertyId, {
      from: '2027-02-10T00:00:00.000Z',
      to: '2027-02-10T08:00:00.000Z',
    });
    const item = response.items.find((candidate) => candidate.roomId === room.id);
    expect(item).toMatchObject({
      activeHousekeepingTask: { type: 'TURNOVER', status: 'DUE' },
      freeWindows: [
        { startsAt: '2027-02-10T00:00:00.000Z', endsAt: '2027-02-10T01:00:00.000Z' },
        { startsAt: '2027-02-10T03:00:00.000Z', endsAt: '2027-02-10T05:00:00.000Z' },
        { startsAt: '2027-02-10T06:00:00.000Z', endsAt: '2027-02-10T08:00:00.000Z' },
      ],
    });
  });
});
