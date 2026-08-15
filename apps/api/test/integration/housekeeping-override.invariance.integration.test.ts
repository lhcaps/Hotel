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
  userId: '550e8400-e29b-41d4-a716-446655440600',
  email: 'manager@example.test',
  displayName: 'Housekeeping Manager',
  role: 'ADMIN',
  profileCode: 'HOUSEKEEPING_MANAGER',
  permissions: ['housekeeping.task.manage', 'housekeeping.task.read'],
  propertyIds: ['550e8400-e29b-41d4-a716-446655440610'],
  sessionId: '550e8400-e29b-41d4-a716-446655440601',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'override-housekeeping',
};

const propertyId = '550e8400-e29b-41d4-a716-446655440610';
const tierId = '550e8400-e29b-41d4-a716-446655440611';
const roomTypeId = '550e8400-e29b-41d4-a716-446655440612';
const staffId = '550e8400-e29b-41d4-a716-446655440613';
const departmentId = '550e8400-e29b-41d4-a716-446655440614';
const managerMembershipId = '550e8400-e29b-41d4-a716-446655440615';

async function countActiveTurnover(pool: GuardedTestDatabase['pool'], roomId: string) {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM housekeeping_tasks
       WHERE property_id = $1 AND room_id = $2 AND type = 'TURNOVER'
         AND status IN ('SCHEDULED','DUE','IN_PROGRESS')`,
    [propertyId, roomId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function currentVersion(pool: GuardedTestDatabase['pool'], taskId: string) {
  const result = await pool.query<{ version: number }>(
    `SELECT version FROM housekeeping_tasks WHERE id = $1`,
    [taskId],
  );
  return result.rows[0]?.version ?? -1;
}

async function latestTurnoverTaskId(pool: GuardedTestDatabase['pool'], roomId: string) {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM housekeeping_tasks
       WHERE property_id = $1 AND room_id = $2 AND type = 'TURNOVER'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    [propertyId, roomId],
  );
  return result.rows[0]?.id;
}

async function latestArrivalPrepTaskId(pool: GuardedTestDatabase['pool'], roomId: string) {
  const result = await pool.query<{ id: string; version: number }>(
    `SELECT id, version FROM housekeeping_tasks
       WHERE property_id = $1 AND room_id = $2 AND type = 'ARRIVAL_PREP'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    [propertyId, roomId],
  );
  return result.rows[0];
}

describe('housekeeping manual override invariants', () => {
  let database: GuardedTestDatabase;
  let catalog: CatalogService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
      const client = createDatabaseClient(prepared.pool);
      catalog = new CatalogService(client, new CatalogRepository(client), new AuditRepository());
      await prepared.pool.query(
        `INSERT INTO users (id, name, email, role, status)
         VALUES ('${managerActor.userId}', 'Manager', 'manager@example.test', 'ADMIN', 'ACTIVE'),
                ('${staffId}', 'Staff', 'staff@example.test', 'ADMIN', 'ACTIVE');
         INSERT INTO properties (id, code, name, timezone)
         VALUES ('${propertyId}','HK','Housekeeping Test','Asia/Ho_Chi_Minh');
         INSERT INTO price_tiers (id, property_id, code, name, sort_order)
         VALUES ('${tierId}','${propertyId}','STD','Standard',0);
         INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
         VALUES ('${roomTypeId}','${propertyId}','${tierId}','STD','Standard',2,0,2);
         INSERT INTO admin_departments (id, code, name)
         VALUES ('${departmentId}','HK','Housekeeping');
         INSERT INTO admin_memberships (id, user_id, department_id, role, status)
         VALUES ('${managerMembershipId}','${managerActor.userId}','${departmentId}','HOUSEKEEPING_MANAGER','ACTIVE');`,
      );
    });
  });

  afterAll(async () => database?.dispose());

  it('manual DIRTY with no task creates exactly one actionable TURNOVER', async () => {
    const created = await catalog.createRoom(managerActor, {
      roomTypeId,
      roomNumber: 'HK-D-1',
    });
    await database.pool.query(`UPDATE rooms SET housekeeping_status = 'CLEAN' WHERE id = $1`, [
      created.id,
    ]);

    await catalog.overrideRoomHousekeeping(managerActor, created.id, {
      status: 'DIRTY',
      expectedVersion: 0,
      reason: 'manual',
    });

    expect(await countActiveTurnover(database.pool, created.id)).toBe(1);
    const room = await database.pool.query<{ housekeeping_status: string }>(
      `SELECT housekeeping_status FROM rooms WHERE id = $1`,
      [created.id],
    );
    expect(room.rows[0]?.housekeeping_status).toBe('DIRTY');
    const taskId = await latestTurnoverTaskId(database.pool, created.id);
    const task = await database.pool.query<{ status: string; booking_id: string | null }>(
      `SELECT status, booking_id FROM housekeeping_tasks WHERE id = $1`,
      [taskId],
    );
    expect(task.rows[0]?.status).toBe('DUE');
    expect(task.rows[0]?.booking_id).toBeNull();
  });

  it('repeat manual DIRTY keeps exactly one actionable TURNOVER', async () => {
    const created = await catalog.createRoom(managerActor, {
      roomTypeId,
      roomNumber: 'HK-D-2',
    });
    await database.pool.query(`UPDATE rooms SET housekeeping_status = 'CLEAN' WHERE id = $1`, [
      created.id,
    ]);

    await catalog.overrideRoomHousekeeping(managerActor, created.id, {
      status: 'DIRTY',
      expectedVersion: 0,
      reason: 'manual 1',
    });
    const firstTaskId = await latestTurnoverTaskId(database.pool, created.id);
    expect(firstTaskId).toBeDefined();
    if (firstTaskId === undefined) throw new Error('expected task to exist');
    const firstVersion = await currentVersion(database.pool, firstTaskId);

    await catalog.overrideRoomHousekeeping(managerActor, created.id, {
      status: 'DIRTY',
      expectedVersion: firstVersion,
      reason: 'manual 2',
    });
    expect(await countActiveTurnover(database.pool, created.id)).toBe(1);
  });

  it('manual CLEANING creates TURNOVER IN_PROGRESS and sets room CLEANING', async () => {
    const created = await catalog.createRoom(managerActor, {
      roomTypeId,
      roomNumber: 'HK-CL-1',
    });
    await database.pool.query(`UPDATE rooms SET housekeeping_status = 'DIRTY' WHERE id = $1`, [
      created.id,
    ]);

    await catalog.overrideRoomHousekeeping(managerActor, created.id, {
      status: 'CLEANING',
      expectedVersion: 0,
      reason: 'start cleaning',
    });

    const room = await database.pool.query<{ housekeeping_status: string }>(
      `SELECT housekeeping_status FROM rooms WHERE id = $1`,
      [created.id],
    );
    expect(room.rows[0]?.housekeeping_status).toBe('CLEANING');
    const task = await database.pool.query<{ status: string }>(
      `SELECT status FROM housekeeping_tasks WHERE room_id = $1 AND type = 'TURNOVER' AND status = 'IN_PROGRESS'`,
      [created.id],
    );
    expect(task.rows[0]?.status).toBe('IN_PROGRESS');
  });

  it('manual CLEAN reconciles active TURNOVER to DONE and sets room CLEAN', async () => {
    const created = await catalog.createRoom(managerActor, {
      roomTypeId,
      roomNumber: 'HK-C-1',
    });
    await database.pool.query(`UPDATE rooms SET housekeeping_status = 'DIRTY' WHERE id = $1`, [
      created.id,
    ]);

    await catalog.overrideRoomHousekeeping(managerActor, created.id, {
      status: 'CLEANING',
      expectedVersion: 0,
      reason: 'begin',
    });
    const taskId = await latestTurnoverTaskId(database.pool, created.id);
    if (taskId === undefined) throw new Error('expected task to exist');
    const version = await currentVersion(database.pool, taskId);

    await catalog.overrideRoomHousekeeping(managerActor, created.id, {
      status: 'CLEAN',
      expectedVersion: version,
      reason: 'finished',
    });

    const room = await database.pool.query<{ housekeeping_status: string }>(
      `SELECT housekeeping_status FROM rooms WHERE id = $1`,
      [created.id],
    );
    expect(room.rows[0]?.housekeeping_status).toBe('CLEAN');
    const active = await countActiveTurnover(database.pool, created.id);
    expect(active).toBe(0);
    const done = await database.pool.query<{ status: string }>(
      `SELECT status FROM housekeeping_tasks WHERE room_id = $1 AND type = 'TURNOVER' AND status = 'DONE'`,
      [created.id],
    );
    expect(done.rows[0]?.status).toBe('DONE');
  });

  it('ARRIVAL_PREP lifecycle does not mutate room cleanliness', async () => {
    const created = await catalog.createRoom(managerActor, {
      roomTypeId,
      roomNumber: 'HK-ARR-1',
    });
    await database.pool.query(`UPDATE rooms SET housekeeping_status = 'CLEAN' WHERE id = $1`, [
      created.id,
    ]);

    const bookingId = '550e8400-e29b-41d4-a716-446655440690';
    await database.pool.query(
      `INSERT INTO bookings (id, property_id, room_type_id, room_id, customer_user_id, booking_code, status, check_in, check_out, adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot, hold_expires_at)
       VALUES ($1,$2,$3,$4,$5,'ARR-1','CONFIRMED',
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day', 1, 0, 'VND', 0, 0, 0, '{"source":"manual"}'::jsonb,
               CURRENT_TIMESTAMP + INTERVAL '2 days')`,
      [bookingId, propertyId, roomTypeId, created.id, staffId],
    );
    const inserted = await database.pool.query<{ id: string }>(
      `INSERT INTO housekeeping_tasks (property_id, room_id, booking_id, type, status, due_at)
       VALUES ($1,$2,$3,'ARRIVAL_PREP','DUE', CURRENT_TIMESTAMP) RETURNING id`,
      [propertyId, created.id, bookingId],
    );
    const taskId = inserted.rows[0]?.id;
    expect(taskId).toBeDefined();
    if (taskId === undefined) throw new Error('expected ARRIVAL_PREP task id');

    await catalog.startHousekeepingTask(managerActor, taskId, { expectedVersion: 0 });
    const afterStart = await latestArrivalPrepTaskId(database.pool, created.id);
    await catalog.completeHousekeepingTask(managerActor, taskId, {
      expectedVersion: afterStart?.version ?? 1,
    });

    const room = await database.pool.query<{ housekeeping_status: string }>(
      `SELECT housekeeping_status FROM rooms WHERE id = $1`,
      [created.id],
    );
    expect(room.rows[0]?.housekeeping_status).toBe('CLEAN');
  });
});
