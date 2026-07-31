import { describe, expect, it, vi } from 'vitest';

import type { ActorContext } from '../src/auth/actor-context.js';
import {
  CatalogService,
  type AuditRepositoryPort,
  type CatalogRepositoryPort,
  type TransactionManager,
} from '../src/catalog/catalog.service.js';
import { CatalogSafetyError, type CatalogSafetyCode } from '../src/catalog/catalog.safety.js';

const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['catalog.room.manage', 'catalog.room_type.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'phase-3b1',
};

const property = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  code: 'MAIN',
  name: 'Main property',
  timezone: 'Asia/Ho_Chi_Minh',
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const existingRoom = {
  id: '550e8400-e29b-41d4-a716-446655440030',
  propertyId: property.id,
  roomTypeId: '550e8400-e29b-41d4-a716-446655440031',
  roomNumber: '101',
  status: 'ACTIVE' as const,
  housekeepingStatus: 'CLEAN' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const existingRoomType = {
  id: existingRoom.roomTypeId,
  propertyId: property.id,
  priceTierId: '550e8400-e29b-41d4-a716-446655440020',
  code: 'DLX',
  name: 'Deluxe',
  description: null,
  maxAdults: 2,
  maxChildren: 0,
  maxOccupancy: 2,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeRepository(overrides: Partial<CatalogRepositoryPort> = {}): CatalogRepositoryPort {
  const base: CatalogRepositoryPort = {
    getCurrentProperty: vi.fn().mockResolvedValue(property),
    updateProperty: vi.fn(),
    createPriceTier: vi.fn(),
    listPriceTiers: vi.fn().mockResolvedValue([]),
    updatePriceTier: vi.fn(),
    archivePriceTier: vi.fn(),
    createRoomType: vi.fn(),
    listRoomTypes: vi.fn().mockResolvedValue([]),
    archiveRoomType: vi.fn().mockResolvedValue({ ...existingRoomType, status: 'INACTIVE' }),
    lockRoomType: vi.fn().mockResolvedValue(undefined),
    updateRoomType: vi.fn(),
    findRoomType: vi.fn().mockResolvedValue(existingRoomType),
    findRoomTypeAmenityMembership: vi.fn(),
    removeRoomTypeAmenity: vi.fn(),
    findAmenity: vi.fn(),
    updateAmenity: vi.fn(),
    findRoom: vi.fn().mockResolvedValue(existingRoom),
    findRoomByNumber: vi.fn(),
    roomHasFutureOrActiveBlocks: vi.fn().mockResolvedValue(false),
    updateRoom: vi.fn(),
    createAmenity: vi.fn(),
    listAmenities: vi.fn().mockResolvedValue([]),
    archiveAmenity: vi.fn(),
    assignAmenity: vi.fn(),
    createRoom: vi.fn(),
    archiveRoom: vi.fn().mockResolvedValue({ ...existingRoom, status: 'INACTIVE' }),
    lockRoom: vi.fn().mockResolvedValue(undefined),
    updateRoomHousekeeping: vi.fn(),
    listRooms: vi.fn().mockResolvedValue([]),
    createMaintenance: vi.fn(),
    listMaintenanceBlocks: vi.fn().mockResolvedValue([]),
    cancelMaintenance: vi.fn(),
    summarizeRoomCommitments: vi.fn().mockResolvedValue({
      activeBookingCount: 0,
      futureBookingCount: 0,
      activeMaintenanceCount: 0,
      futureMaintenanceCount: 0,
      activeInventoryBlockCount: 0,
      futureInventoryBlockCount: 0,
    }),
    summarizeRoomTypeDependencies: vi.fn().mockResolvedValue({
      activeRoomCount: 0,
      futureBookingCount: 0,
      activeMaintenanceCount: 0,
      futureMaintenanceCount: 0,
      activeRatePlanCount: 0,
    }),
  };
  return { ...base, ...overrides };
}

function makeAudit(): AuditRepositoryPort {
  return { write: vi.fn().mockResolvedValue(undefined) };
}

function makeDatabase(): TransactionManager {
  return {
    transaction: async <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> =>
      operation({}),
  };
}

describe('CatalogService physical-room archive safety', () => {
  it.each([
    ['ROOM_ARCHIVE_ACTIVE_BOOKING', true, true, false, false, false, false],
    ['ROOM_ARCHIVE_FUTURE_BOOKING', false, true, false, false, false, false],
    ['ROOM_ARCHIVE_ACTIVE_MAINTENANCE', false, false, true, false, false, false],
    ['ROOM_ARCHIVE_FUTURE_MAINTENANCE', false, false, false, true, false, false],
    ['ROOM_ARCHIVE_ACTIVE_INVENTORY_BLOCK', false, false, false, false, true, false],
    ['ROOM_ARCHIVE_FUTURE_INVENTORY_BLOCK', false, false, false, false, false, true],
  ] as const)(
    'rejects archiveRoom with code %s when commitments match the rejection shape',
    async (
      expectedCode,
      hasActiveBooking,
      hasFutureBooking,
      hasActiveMaintenance,
      hasFutureMaintenance,
      hasActiveInventoryBlock,
      hasFutureInventoryBlock,
    ) => {
      const safety = {
        activeBookingCount: hasActiveBooking ? 1 : 0,
        futureBookingCount: hasFutureBooking ? 1 : 0,
        activeMaintenanceCount: hasActiveMaintenance ? 1 : 0,
        futureMaintenanceCount: hasFutureMaintenance ? 1 : 0,
        activeInventoryBlockCount: hasActiveInventoryBlock ? 1 : 0,
        futureInventoryBlockCount: hasFutureInventoryBlock ? 1 : 0,
      };
      const repository = makeRepository({
        summarizeRoomCommitments: vi.fn().mockResolvedValue(safety),
      });
      const audit = makeAudit();
      const service = new CatalogService(makeDatabase(), repository, audit);

      await expect(
        service.archiveRoom(actor, existingRoom.id, { archive: true }),
      ).rejects.toBeInstanceOf(CatalogSafetyError);
      await expect(
        service.archiveRoom(actor, existingRoom.id, { archive: true }),
      ).rejects.toMatchObject({ code: expectedCode satisfies CatalogSafetyCode });

      // Failed archive MUST NOT mutate target row and MUST NOT write audit.
      expect(repository.archiveRoom).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
    },
  );

  it('archives an unused room, mutates the row exactly once, and writes one audit event', async () => {
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const repository = makeRepository({
      summarizeRoomCommitments: vi.fn().mockResolvedValue({
        activeBookingCount: 0,
        futureBookingCount: 0,
        activeMaintenanceCount: 0,
        futureMaintenanceCount: 0,
        activeInventoryBlockCount: 0,
        futureInventoryBlockCount: 0,
      }),
    });
    const audit: AuditRepositoryPort = { write: writeAudit };
    const service = new CatalogService(makeDatabase(), repository, audit);

    const result = await service.archiveRoom(actor, existingRoom.id, { archive: true });
    expect(result.status).toBe('INACTIVE');
    expect(repository.archiveRoom).toHaveBeenCalledTimes(1);
    expect(writeAudit).toHaveBeenCalledTimes(1);
    expect(writeAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        aggregateType: 'ROOM',
        aggregateId: existingRoom.id,
        eventType: 'ROOM_ARCHIVED',
        actorId: actor.userId,
      }),
    );
  });

  it('archives a room whose only commitments are in the past and counts them as zero', async () => {
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const repository = makeRepository({
      summarizeRoomCommitments: vi.fn().mockResolvedValue({
        activeBookingCount: 0,
        futureBookingCount: 0,
        activeMaintenanceCount: 0,
        futureMaintenanceCount: 0,
        activeInventoryBlockCount: 0,
        futureInventoryBlockCount: 0,
      }),
    });
    const service = new CatalogService(makeDatabase(), repository, {
      write: writeAudit,
    });

    await service.archiveRoom(actor, existingRoom.id, { archive: true });
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });
});

describe('CatalogService physical-room retype safety', () => {
  const targetRoomTypeId = '550e8400-e29b-41d4-a716-446655440099';

  it.each([
    ['ROOM_RETYPE_ACTIVE_BOOKING', true, true, false, false],
    ['ROOM_RETYPE_FUTURE_BOOKING', false, true, false, false],
    ['ROOM_RETYPE_ACTIVE_MAINTENANCE', false, false, true, false],
    ['ROOM_RETYPE_FUTURE_MAINTENANCE', false, false, false, true],
  ] as const)(
    'rejects room retype with code %s when commitments exist',
    async (
      expectedCode,
      hasActiveBooking,
      hasFutureBooking,
      hasActiveMaintenance,
      hasFutureMaintenance,
    ) => {
      const repository = makeRepository({
        summarizeRoomCommitments: vi.fn().mockResolvedValue({
          activeBookingCount: hasActiveBooking ? 1 : 0,
          futureBookingCount: hasFutureBooking ? 1 : 0,
          activeMaintenanceCount: hasActiveMaintenance ? 1 : 0,
          futureMaintenanceCount: hasFutureMaintenance ? 1 : 0,
          activeInventoryBlockCount: 0,
          futureInventoryBlockCount: 0,
        }),
        findRoomType: vi
          .fn()
          .mockResolvedValue({ ...existingRoomType, id: targetRoomTypeId, code: 'STD' }),
      });
      const audit = makeAudit();
      const service = new CatalogService(makeDatabase(), repository, audit);

      await expect(
        service.updateRoom(actor, existingRoom.id, { roomTypeId: targetRoomTypeId }),
      ).rejects.toBeInstanceOf(CatalogSafetyError);
      await expect(
        service.updateRoom(actor, existingRoom.id, { roomTypeId: targetRoomTypeId }),
      ).rejects.toMatchObject({ code: expectedCode satisfies CatalogSafetyCode });
      expect(repository.updateRoom).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
    },
  );

  it('retype succeeds when the room has no blocking commitments and writes one audit', async () => {
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const repository = makeRepository({
      summarizeRoomCommitments: vi.fn().mockResolvedValue({
        activeBookingCount: 0,
        futureBookingCount: 0,
        activeMaintenanceCount: 0,
        futureMaintenanceCount: 0,
        activeInventoryBlockCount: 0,
        futureInventoryBlockCount: 0,
      }),
      findRoomType: vi
        .fn()
        .mockResolvedValue({ ...existingRoomType, id: targetRoomTypeId, code: 'STD' }),
      updateRoom: vi.fn().mockResolvedValue({ ...existingRoom, roomTypeId: targetRoomTypeId }),
    });
    const service = new CatalogService(makeDatabase(), repository, { write: writeAudit });

    const result = await service.updateRoom(actor, existingRoom.id, {
      roomTypeId: targetRoomTypeId,
    });
    expect(result.roomTypeId).toBe(targetRoomTypeId);
    expect(repository.updateRoom).toHaveBeenCalledTimes(1);
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });

  it('rejects retype when target room type belongs to a different property', async () => {
    const repository = makeRepository({
      summarizeRoomCommitments: vi.fn().mockResolvedValue({
        activeBookingCount: 0,
        futureBookingCount: 0,
        activeMaintenanceCount: 0,
        futureMaintenanceCount: 0,
        activeInventoryBlockCount: 0,
        futureInventoryBlockCount: 0,
      }),
      findRoomType: vi.fn().mockResolvedValue(undefined),
    });
    const service = new CatalogService(makeDatabase(), repository, makeAudit());

    await expect(
      service.updateRoom(actor, existingRoom.id, {
        roomTypeId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(/does not belong/i);
    expect(repository.updateRoom).not.toHaveBeenCalled();
  });
});

describe('CatalogService room-type archive safety', () => {
  it.each([
    ['ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS', true, false, false, false, false, false],
    ['ROOM_TYPE_ARCHIVE_FUTURE_BOOKING', false, true, false, false, false, false],
    ['ROOM_TYPE_ARCHIVE_ACTIVE_MAINTENANCE', false, false, true, false, false, false],
    ['ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE', false, false, false, true, false, false],
    ['ROOM_TYPE_ARCHIVE_ACTIVE_RATE_PLAN', false, false, false, false, true, false],
  ] as const)(
    'rejects archiveRoomType with code %s when the dependency shape matches',
    async (
      expectedCode,
      hasActiveRooms,
      hasFutureBooking,
      hasActiveMaintenance,
      hasFutureMaintenance,
      hasActiveRatePlan,
      _hasUnusedAlias,
    ) => {
      const repository = makeRepository({
        summarizeRoomTypeDependencies: vi.fn().mockResolvedValue({
          activeRoomCount: hasActiveRooms ? 1 : 0,
          futureBookingCount: hasFutureBooking ? 1 : 0,
          activeMaintenanceCount: hasActiveMaintenance ? 1 : 0,
          futureMaintenanceCount: hasFutureMaintenance ? 1 : 0,
          activeRatePlanCount: hasActiveRatePlan ? 1 : 0,
        }),
      });
      const audit = makeAudit();
      const service = new CatalogService(makeDatabase(), repository, audit);

      await expect(
        service.archiveRoomType(actor, existingRoomType.id, { archive: true }),
      ).rejects.toBeInstanceOf(CatalogSafetyError);
      await expect(
        service.archiveRoomType(actor, existingRoomType.id, { archive: true }),
      ).rejects.toMatchObject({ code: expectedCode satisfies CatalogSafetyCode });
      expect(repository.archiveRoomType).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
    },
  );

  it('archives a room type with no dependencies and writes exactly one audit event', async () => {
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const repository = makeRepository({
      summarizeRoomTypeDependencies: vi.fn().mockResolvedValue({
        activeRoomCount: 0,
        futureBookingCount: 0,
        activeMaintenanceCount: 0,
        futureMaintenanceCount: 0,
        activeRatePlanCount: 0,
      }),
    });
    const service = new CatalogService(makeDatabase(), repository, { write: writeAudit });

    const result = await service.archiveRoomType(actor, existingRoomType.id, { archive: true });
    expect(result.status).toBe('INACTIVE');
    expect(repository.archiveRoomType).toHaveBeenCalledTimes(1);
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });
});

describe('CatalogService transactional safety guarantees', () => {
  it('does not mutate when the safety check throws (archiveRoom rollback)', async () => {
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const repository = makeRepository({
      summarizeRoomCommitments: vi.fn().mockResolvedValue({
        activeBookingCount: 1,
        futureBookingCount: 0,
        activeMaintenanceCount: 0,
        futureMaintenanceCount: 0,
        activeInventoryBlockCount: 0,
        futureInventoryBlockCount: 0,
      }),
    });
    const service = new CatalogService(makeDatabase(), repository, { write: writeAudit });

    await expect(
      service.archiveRoom(actor, existingRoom.id, { archive: true }),
    ).rejects.toBeInstanceOf(CatalogSafetyError);
    expect(repository.archiveRoom).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it('does not mutate when the safety check throws (archiveRoomType rollback)', async () => {
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const repository = makeRepository({
      summarizeRoomTypeDependencies: vi.fn().mockResolvedValue({
        activeRoomCount: 1,
        futureBookingCount: 0,
        activeMaintenanceCount: 0,
        futureMaintenanceCount: 0,
        activeRatePlanCount: 0,
      }),
    });
    const service = new CatalogService(makeDatabase(), repository, { write: writeAudit });

    await expect(
      service.archiveRoomType(actor, existingRoomType.id, { archive: true }),
    ).rejects.toBeInstanceOf(CatalogSafetyError);
    expect(repository.archiveRoomType).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it('passes the same transaction handle to the safety query and the archive mutation', async () => {
    const transactionTokens: unknown[] = [];
    let safetyToken: unknown;
    const repository = makeRepository({
      summarizeRoomCommitments: vi.fn((transaction) => {
        safetyToken = transaction;
        return Promise.resolve({
          activeBookingCount: 0,
          futureBookingCount: 0,
          activeMaintenanceCount: 0,
          futureMaintenanceCount: 0,
          activeInventoryBlockCount: 0,
          futureInventoryBlockCount: 0,
        });
      }),
      archiveRoom: vi.fn((transaction) => {
        transactionTokens.push(transaction);
        return Promise.resolve({ ...existingRoom, status: 'INACTIVE' as const });
      }),
    });
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const database: TransactionManager = {
      transaction: async <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> =>
        operation('shared-tx-token'),
    };
    const service = new CatalogService(database, repository, { write: writeAudit });

    await service.archiveRoom(actor, existingRoom.id, { archive: true });
    expect(safetyToken).toBe('shared-tx-token');
    expect(transactionTokens[0]).toBe('shared-tx-token');
  });
});
