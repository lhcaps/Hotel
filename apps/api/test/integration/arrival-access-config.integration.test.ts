import { Buffer } from 'node:buffer';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArrivalAccessCrypto } from '@room/booking';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { PropertyContextService } from '../../src/catalog/property-context.service.js';
import { ArrivalAccessConfigService } from '../../src/booking/services/arrival-access-config.service.js';
import { ArrivalAccessConfigurationIncompleteError } from '../../src/booking/services/arrival-access-config.service.js';

const propertyId = '51000000-0000-4000-8000-000000000001';
const tierId = '51000000-0000-4000-8000-000000000002';
const roomTypeId = '51000000-0000-4000-8000-000000000003';
const roomId = '51000000-0000-4000-8000-000000000004';

const actor: ActorContext = {
  userId: '51000000-0000-4000-8000-000000000005',
  email: 'arrival-admin@example.test',
  displayName: 'Arrival administrator',
  role: 'SUPER_ADMIN',
  permissions: ['arrival.access.read', 'arrival.access.manage'],
  propertyIds: [propertyId],
  sessionId: '51000000-0000-4000-8000-000000000006',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'arrival-access-integration',
};

describe('encrypted arrival access configuration', () => {
  let database: GuardedTestDatabase;
  let client: DatabaseClient;
  let access: ArrivalAccessConfigService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    client = createDatabaseClient(database.pool);
    access = new ArrivalAccessConfigService(
      client,
      new PropertyContextService(client),
      new ArrivalAccessCrypto(Buffer.alloc(32, 11)),
    );
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone) VALUES ($1, 'ARRIVAL', 'Arrival property', 'Asia/Ho_Chi_Minh')`,
      [propertyId],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order) VALUES ($1, $2, 'STANDARD', 'Standard', 0)`,
      [tierId, propertyId],
    );
    await database.pool.query(
      `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'DELUXE', 'Deluxe', 2, 0, 2)`,
      [roomTypeId, propertyId, tierId],
    );
    await database.pool.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number, physical_room_code)
       VALUES ($1, $2, $3, '101', 'B101')`,
      [roomId, propertyId, roomTypeId],
    );
  });

  afterAll(async () => database?.dispose());

  it('does not create a customer package from absent configuration', async () => {
    await expect(access.resolveCustomerPackage({ propertyId, roomId })).rejects.toBeInstanceOf(
      ArrivalAccessConfigurationIncompleteError,
    );
  });

  it('returns only configuration state to Admin and decrypts the complete package only for the authorized delivery path', async () => {
    const property = await access.updatePropertyForAdmin(actor, {
      gatePass: { action: 'REPLACE', value: 'GATE-9413' },
      wifiSsid: 'PeaceNest Guest',
      wifiPassword: { action: 'REPLACE', value: 'wifi-9413' },
      supportContact: '0900 000 000',
      defaultArrivalInstruction: 'Đi theo biển chỉ dẫn.',
      preparationNote: 'Chuẩn bị giấy tờ tuỳ thân.',
    });
    const room = await access.updateRoomForAdmin(actor, roomId, {
      roomPass: { action: 'REPLACE', value: 'ROOM-4321' },
      roomLocation: 'Tầng 3',
      arrivalInstruction: 'Dùng thang máy bên phải.',
    });

    expect(property).toMatchObject({ gatePassConfigured: true, wifiPasswordConfigured: true });
    expect(room).toMatchObject({ roomPassConfigured: true, roomLocation: 'Tầng 3' });
    expect(JSON.stringify(property)).not.toContain('GATE-9413');
    expect(JSON.stringify(room)).not.toContain('ROOM-4321');

    const raw = await database.pool.query<{ value: string }>(
      `SELECT gate_pass_encrypted AS value FROM property_arrival_access_configs WHERE property_id = $1`,
      [propertyId],
    );
    expect(raw.rows[0]?.value).not.toContain('GATE-9413');

    await access.updatePropertyForAdmin(actor, { supportContact: '0900 111 222' });
    await expect(access.resolveCustomerPackage({ propertyId, roomId })).resolves.toEqual({
      gatePass: 'GATE-9413',
      roomPass: 'ROOM-4321',
      wifi: { ssid: 'PeaceNest Guest', password: 'wifi-9413' },
      location: 'Tầng 3',
      instructions: 'Dùng thang máy bên phải.',
      preparationNote: 'Chuẩn bị giấy tờ tuỳ thân.',
      supportContact: '0900 111 222',
    });
    const audits = await database.pool.query<{ payload: unknown }>(
      `SELECT payload FROM audit_events WHERE aggregate_type LIKE '%ARRIVAL_ACCESS_CONFIG' ORDER BY occurred_at`,
    );
    expect(JSON.stringify(audits.rows)).not.toMatch(/GATE-9413|ROOM-4321|wifi-9413/);
  });
});
