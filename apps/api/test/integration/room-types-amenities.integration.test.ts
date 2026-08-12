import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, migrateDatabase, type DatabaseClient } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { AuditRepository } from '../../src/catalog/audit.repository.js';
import { CatalogRepository } from '../../src/catalog/catalog.repository.js';
import { CatalogService } from '../../src/catalog/catalog.service.js';

const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['catalog.room_type.manage', 'catalog.amenity.manage'],
  propertyIds: ['550e8400-e29b-41d4-a716-446655440010'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'integration-request',
};

describe('room type and amenity catalog transactions', () => {
  let database: GuardedTestDatabase;
  let catalog: CatalogService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required for integration tests');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    const client: DatabaseClient = createDatabaseClient(database.pool);
    catalog = new CatalogService(client, new CatalogRepository(client), new AuditRepository());
    await database.pool.query(
      `INSERT INTO properties (id, code, name, timezone)
       VALUES ('550e8400-e29b-41d4-a716-446655440010', 'MAIN', 'Main property', 'Asia/Ho_Chi_Minh');
       INSERT INTO price_tiers (id, property_id, code, name, sort_order)
       VALUES ('550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440010', 'STANDARD', 'Standard', 0);`,
    );
  });

  afterAll(async () => database?.dispose());

  it('persists room type, amenity assignment, and archive as audited state changes', async () => {
    const roomType = await catalog.createRoomType(actor, {
      priceTierId: '550e8400-e29b-41d4-a716-446655440020',
      code: 'dlx',
      name: 'Deluxe',
      maxAdults: 2,
      maxChildren: 2,
      maxOccupancy: 4,
    });
    const amenity = await catalog.createAmenity(actor, { code: 'wifi', name: 'Wi-Fi' });
    await catalog.assignAmenity(actor, roomType.id, { amenityId: amenity.id });
    await expect(catalog.listRoomTypes(actor, { page: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: roomType.id, code: 'DLX' })],
    });
    await expect(catalog.listAmenities(actor, { page: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: amenity.id, code: 'WIFI' })],
    });
    await catalog.archiveAmenity(actor, amenity.id, { archive: true });
    await catalog.archiveRoomType(actor, roomType.id, { archive: true });

    await expect(
      database.pool.query(`SELECT status FROM room_types WHERE id = $1`, [roomType.id]),
    ).resolves.toMatchObject({ rows: [{ status: 'INACTIVE' }] });
    await expect(
      database.pool.query(`SELECT status FROM amenities WHERE id = $1`, [amenity.id]),
    ).resolves.toMatchObject({ rows: [{ status: 'INACTIVE' }] });
    await expect(
      database.pool.query(`SELECT count(*)::int AS count FROM room_type_amenities`),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(
      database.pool.query(`SELECT count(*)::int AS count FROM audit_events`),
    ).resolves.toMatchObject({ rows: [{ count: 5 }] });
  });
});
