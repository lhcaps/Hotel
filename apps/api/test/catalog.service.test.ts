import { describe, expect, it, vi } from 'vitest';

import type { ActorContext } from '../src/auth/actor-context.js';
import { CatalogConflictError, CatalogNotFoundError } from '../src/catalog/catalog.errors.js';
import { CatalogSafetyError } from '../src/catalog/catalog.safety.js';
import {
  type AuditRepositoryPort,
  type CatalogRepositoryPort,
  CatalogService,
  type TransactionManager,
} from '../src/catalog/catalog.service.js';

const actor: ActorContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['catalog.property.manage'],
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'request-1',
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

describe('CatalogService', () => {
  it('rejects a direct DIRTY to CLEAN housekeeping transition', async () => {
    const room = {
      id: '550e8400-e29b-41d4-a716-446655440111',
      propertyId: property.id,
      roomTypeId: '550e8400-e29b-41d4-a716-446655440112',
      roomNumber: '111',
      physicalRoomCode: '111',
      notes: null,
      status: 'ACTIVE' as const,
      housekeepingStatus: 'DIRTY' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repository = {
      getCurrentProperty: vi.fn().mockResolvedValue(property),
      lockRoom: vi.fn().mockResolvedValue(undefined),
      findRoom: vi.fn().mockResolvedValue(room),
      updateRoomHousekeeping: vi.fn(),
    } as unknown as CatalogRepositoryPort;
    const service = new CatalogService(
      {
        transaction: async <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> =>
          operation({}),
      },
      repository,
      { write: vi.fn() },
    );

    await expect(
      service.updateRoomHousekeeping(actor, room.id, { status: 'CLEAN' }),
    ).rejects.toMatchObject({
      code: 'ROOM_HOUSEKEEPING_INVALID_TRANSITION',
    });
    expect(repository.updateRoomHousekeeping).not.toHaveBeenCalled();
  });

  it('updates the single property and records one scrubbed audit event in its transaction', async () => {
    const repository: CatalogRepositoryPort = {
      getCurrentProperty: vi.fn().mockResolvedValue(property),
      updateProperty: vi
        .fn()
        .mockResolvedValue({ ...property, code: 'RENAMED', name: 'Renamed property' }),
      createPriceTier: vi.fn(),
      listPriceTiers: vi.fn(),
      updatePriceTier: vi.fn(),
      archivePriceTier: vi.fn(),
      createRoomType: vi.fn(),
      listRoomTypes: vi.fn(),
      archiveRoomType: vi.fn(),
      lockRoomType: vi.fn().mockResolvedValue(undefined),
      updateRoomType: vi.fn(),
      findRoomType: vi.fn(),
      findRoomTypeAmenityMembership: vi.fn(),
      removeRoomTypeAmenity: vi.fn(),
      findAmenity: vi.fn(),
      updateAmenity: vi.fn(),
      findRoom: vi.fn(),
      findRoomByNumber: vi.fn(),
      roomHasFutureOrActiveBlocks: vi.fn(),
      updateRoom: vi.fn(),
      createAmenity: vi.fn(),
      listAmenities: vi.fn(),
      archiveAmenity: vi.fn(),
      assignAmenity: vi.fn(),
      createRoom: vi.fn(),
      archiveRoom: vi.fn(),
      lockRoom: vi.fn().mockResolvedValue(undefined),
      updateRoomHousekeeping: vi.fn(),
      listRooms: vi.fn(),
      createMaintenance: vi.fn(),
      listMaintenanceBlocks: vi.fn(),
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
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const audit: AuditRepositoryPort = { write: writeAudit };
    const database: TransactionManager = {
      transaction: async <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> =>
        operation({}),
    };
    const service = new CatalogService(database, repository, audit);

    await expect(
      service.updateProperty(actor, { code: ' renamed ', name: 'Renamed property' }),
    ).resolves.toMatchObject({ code: 'RENAMED', currency: 'VND', name: 'Renamed property' });
    expect(repository.updateProperty).toHaveBeenCalledWith(
      expect.anything(),
      property.id,
      expect.objectContaining({ code: 'RENAMED', name: 'Renamed property' }),
    );
    expect(writeAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        aggregateType: 'PROPERTY',
        aggregateId: property.id,
        eventType: 'PROPERTY_UPDATED',
        actorId: actor.userId,
      }),
    );
    expect(JSON.stringify(writeAudit.mock.calls)).not.toMatch(/session-id|password|token/i);
  });

  it('fails safely when there is no configured property', async () => {
    const repository: CatalogRepositoryPort = {
      getCurrentProperty: vi.fn().mockResolvedValue(undefined),
      updateProperty: vi.fn(),
      createPriceTier: vi.fn(),
      listPriceTiers: vi.fn(),
      updatePriceTier: vi.fn(),
      archivePriceTier: vi.fn(),
      createRoomType: vi.fn(),
      listRoomTypes: vi.fn(),
      archiveRoomType: vi.fn(),
      lockRoomType: vi.fn().mockResolvedValue(undefined),
      updateRoomType: vi.fn(),
      findRoomType: vi.fn(),
      findRoomTypeAmenityMembership: vi.fn(),
      removeRoomTypeAmenity: vi.fn(),
      findAmenity: vi.fn(),
      updateAmenity: vi.fn(),
      findRoom: vi.fn(),
      findRoomByNumber: vi.fn(),
      roomHasFutureOrActiveBlocks: vi.fn(),
      updateRoom: vi.fn(),
      createAmenity: vi.fn(),
      listAmenities: vi.fn(),
      archiveAmenity: vi.fn(),
      assignAmenity: vi.fn(),
      createRoom: vi.fn(),
      archiveRoom: vi.fn(),
      lockRoom: vi.fn().mockResolvedValue(undefined),
      updateRoomHousekeeping: vi.fn(),
      listRooms: vi.fn(),
      createMaintenance: vi.fn(),
      listMaintenanceBlocks: vi.fn(),
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
    const service = new CatalogService(
      { transaction: vi.fn() } as unknown as TransactionManager,
      repository,
      {
        write: vi.fn(),
      },
    );

    await expect(service.getProperty(actor)).rejects.toBeInstanceOf(CatalogNotFoundError);
  });

  it('maps only duplicate price-tier conflicts to a safe domain error', async () => {
    const repository: CatalogRepositoryPort = {
      getCurrentProperty: vi.fn().mockResolvedValue(property),
      updateProperty: vi.fn(),
      createPriceTier: vi.fn().mockRejectedValue({ code: '23505' }),
      listPriceTiers: vi.fn(),
      updatePriceTier: vi.fn(),
      archivePriceTier: vi.fn(),
      createRoomType: vi.fn(),
      listRoomTypes: vi.fn(),
      archiveRoomType: vi.fn(),
      lockRoomType: vi.fn().mockResolvedValue(undefined),
      updateRoomType: vi.fn(),
      findRoomType: vi.fn(),
      findRoomTypeAmenityMembership: vi.fn(),
      removeRoomTypeAmenity: vi.fn(),
      findAmenity: vi.fn(),
      updateAmenity: vi.fn(),
      findRoom: vi.fn(),
      findRoomByNumber: vi.fn(),
      roomHasFutureOrActiveBlocks: vi.fn(),
      updateRoom: vi.fn(),
      createAmenity: vi.fn(),
      listAmenities: vi.fn(),
      archiveAmenity: vi.fn(),
      assignAmenity: vi.fn(),
      createRoom: vi.fn(),
      archiveRoom: vi.fn(),
      lockRoom: vi.fn().mockResolvedValue(undefined),
      updateRoomHousekeeping: vi.fn(),
      listRooms: vi.fn(),
      createMaintenance: vi.fn(),
      listMaintenanceBlocks: vi.fn(),
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
    const service = new CatalogService(
      {
        transaction: async <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> =>
          operation({}),
      },
      repository,
      { write: vi.fn() },
    );

    await expect(
      service.createPriceTier(actor, { code: 'standard', name: 'Standard', sortOrder: 0 }),
    ).rejects.toBeInstanceOf(CatalogConflictError);
  });

  it('updates the room type and writes one audit event in the same transaction', async () => {
    const existingRoomType = {
      id: '550e8400-e29b-41d4-a716-446655440011',
      propertyId: property.id,
      code: 'DLX',
      name: 'Deluxe',
      description: 'Old description',
      maxAdults: 2,
      maxChildren: 0,
      maxOccupancy: 2,
      priceTierId: '550e8400-e29b-41d4-a716-446655440020',
      status: 'ACTIVE' as const,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const repository: CatalogRepositoryPort = {
      getCurrentProperty: vi.fn().mockResolvedValue(property),
      updateProperty: vi.fn(),
      createPriceTier: vi.fn(),
      listPriceTiers: vi.fn(),
      updatePriceTier: vi.fn(),
      archivePriceTier: vi.fn(),
      createRoomType: vi.fn(),
      listRoomTypes: vi.fn(),
      archiveRoomType: vi.fn(),
      lockRoomType: vi.fn().mockResolvedValue(undefined),
      updateRoomType: vi.fn().mockResolvedValue({
        ...existingRoomType,
        name: 'Deluxe Sea View',
        description: 'Fresh morning sun',
        maxAdults: 3,
        maxChildren: 1,
        maxOccupancy: 4,
      }),
      findRoomType: vi.fn().mockResolvedValue(existingRoomType),
      findRoomTypeAmenityMembership: vi.fn(),
      removeRoomTypeAmenity: vi.fn(),
      findAmenity: vi.fn(),
      updateAmenity: vi.fn(),
      findRoom: vi.fn(),
      findRoomByNumber: vi.fn(),
      roomHasFutureOrActiveBlocks: vi.fn(),
      updateRoom: vi.fn(),
      createAmenity: vi.fn(),
      listAmenities: vi.fn(),
      archiveAmenity: vi.fn(),
      assignAmenity: vi.fn(),
      createRoom: vi.fn(),
      archiveRoom: vi.fn(),
      lockRoom: vi.fn().mockResolvedValue(undefined),
      updateRoomHousekeeping: vi.fn(),
      listRooms: vi.fn(),
      createMaintenance: vi.fn(),
      listMaintenanceBlocks: vi.fn(),
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
    const writeAudit = vi.fn().mockResolvedValue(undefined);
    const audit: AuditRepositoryPort = { write: writeAudit };
    const database: TransactionManager = {
      transaction: async <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> =>
        operation({}),
    };
    const service = new CatalogService(database, repository, audit);

    const updated = await service.updateRoomType(actor, existingRoomType.id, {
      name: 'Deluxe Sea View',
      description: 'Fresh morning sun',
      maxAdults: 3,
      maxChildren: 1,
      maxOccupancy: 4,
    });
    expect(updated.name).toBe('Deluxe Sea View');
    expect(repository.updateRoomType).toHaveBeenCalledWith(
      expect.anything(),
      property.id,
      existingRoomType.id,
      expect.objectContaining({ name: 'Deluxe Sea View', maxOccupancy: 4 }),
    );
    expect(writeAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        aggregateType: 'ROOM_TYPE',
        aggregateId: existingRoomType.id,
        eventType: 'ROOM_TYPE_UPDATED',
        actorId: actor.userId,
      }),
    );
  });

  it('rejects unsafe room-type capacity relationships', async () => {
    const repository: CatalogRepositoryPort = {
      getCurrentProperty: vi.fn().mockResolvedValue(property),
      updateProperty: vi.fn(),
      createPriceTier: vi.fn(),
      listPriceTiers: vi.fn(),
      updatePriceTier: vi.fn(),
      archivePriceTier: vi.fn(),
      createRoomType: vi.fn(),
      listRoomTypes: vi.fn(),
      archiveRoomType: vi.fn(),
      lockRoomType: vi.fn().mockResolvedValue(undefined),
      updateRoomType: vi.fn(),
      findRoomType: vi.fn().mockResolvedValue({ id: 'r1', propertyId: property.id } as never),
      findRoomTypeAmenityMembership: vi.fn(),
      removeRoomTypeAmenity: vi.fn(),
      findAmenity: vi.fn(),
      updateAmenity: vi.fn(),
      findRoom: vi.fn(),
      findRoomByNumber: vi.fn(),
      roomHasFutureOrActiveBlocks: vi.fn(),
      updateRoom: vi.fn(),
      createAmenity: vi.fn(),
      listAmenities: vi.fn(),
      archiveAmenity: vi.fn(),
      assignAmenity: vi.fn(),
      createRoom: vi.fn(),
      archiveRoom: vi.fn(),
      lockRoom: vi.fn().mockResolvedValue(undefined),
      updateRoomHousekeeping: vi.fn(),
      listRooms: vi.fn(),
      createMaintenance: vi.fn(),
      listMaintenanceBlocks: vi.fn(),
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
    const service = new CatalogService(
      { transaction: vi.fn() } as unknown as TransactionManager,
      repository,
      { write: vi.fn() },
    );
    await expect(
      service.updateRoomType(actor, 'r1', {
        maxAdults: 2,
        maxChildren: 4,
        maxOccupancy: 1,
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('removes a room-type amenity and reports the previous existence', async () => {
    const repository: CatalogRepositoryPort = {
      getCurrentProperty: vi.fn().mockResolvedValue(property),
      updateProperty: vi.fn(),
      createPriceTier: vi.fn(),
      listPriceTiers: vi.fn(),
      updatePriceTier: vi.fn(),
      archivePriceTier: vi.fn(),
      createRoomType: vi.fn(),
      listRoomTypes: vi.fn(),
      archiveRoomType: vi.fn(),
      lockRoomType: vi.fn().mockResolvedValue(undefined),
      updateRoomType: vi.fn(),
      findRoomType: vi.fn().mockResolvedValue({ id: 'r1', propertyId: property.id } as never),
      findRoomTypeAmenityMembership: vi.fn().mockResolvedValue({ id: 'a1' }),
      removeRoomTypeAmenity: vi.fn().mockResolvedValue(true),
      findAmenity: vi.fn().mockResolvedValue({ id: 'a1', propertyId: property.id }),
      updateAmenity: vi.fn(),
      findRoom: vi.fn(),
      findRoomByNumber: vi.fn(),
      roomHasFutureOrActiveBlocks: vi.fn(),
      updateRoom: vi.fn(),
      createAmenity: vi.fn(),
      listAmenities: vi.fn(),
      archiveAmenity: vi.fn(),
      assignAmenity: vi.fn(),
      createRoom: vi.fn(),
      archiveRoom: vi.fn(),
      lockRoom: vi.fn().mockResolvedValue(undefined),
      updateRoomHousekeeping: vi.fn(),
      listRooms: vi.fn(),
      createMaintenance: vi.fn(),
      listMaintenanceBlocks: vi.fn(),
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
    const removeRoomTypeAmenityService = new CatalogService(
      {
        transaction: async <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> =>
          operation({}),
      },
      repository,
      { write: vi.fn() },
    );
    const result = await removeRoomTypeAmenityService.removeRoomTypeAmenity(actor, 'r1', 'a1');
    expect(result).toEqual({ roomTypeId: 'r1', amenityId: 'a1', existed: true });
    expect(repository.removeRoomTypeAmenity).toHaveBeenCalledWith(
      expect.anything(),
      property.id,
      'r1',
      'a1',
    );
  });

  it('rejects room retyping when the target room has active or future booked blocks', async () => {
    const repository: CatalogRepositoryPort = {
      getCurrentProperty: vi.fn().mockResolvedValue(property),
      updateProperty: vi.fn(),
      createPriceTier: vi.fn(),
      listPriceTiers: vi.fn(),
      updatePriceTier: vi.fn(),
      archivePriceTier: vi.fn(),
      createRoomType: vi.fn(),
      listRoomTypes: vi.fn(),
      archiveRoomType: vi.fn(),
      lockRoomType: vi.fn().mockResolvedValue(undefined),
      updateRoomType: vi.fn(),
      findRoomType: vi.fn().mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440099',
        propertyId: property.id,
      } as never),
      findRoomTypeAmenityMembership: vi.fn(),
      removeRoomTypeAmenity: vi.fn(),
      findAmenity: vi.fn(),
      updateAmenity: vi.fn(),
      findRoom: vi.fn().mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        propertyId: property.id,
        roomTypeId: '550e8400-e29b-41d4-a716-446655440050',
        roomNumber: '101',
      } as never),
      findRoomByNumber: vi.fn(),
      roomHasFutureOrActiveBlocks: vi.fn().mockResolvedValue(true),
      updateRoom: vi.fn(),
      createAmenity: vi.fn(),
      listAmenities: vi.fn(),
      archiveAmenity: vi.fn(),
      assignAmenity: vi.fn(),
      createRoom: vi.fn(),
      archiveRoom: vi.fn(),
      lockRoom: vi.fn().mockResolvedValue(undefined),
      updateRoomHousekeeping: vi.fn(),
      listRooms: vi.fn(),
      createMaintenance: vi.fn(),
      listMaintenanceBlocks: vi.fn(),
      cancelMaintenance: vi.fn(),
      summarizeRoomCommitments: vi.fn().mockResolvedValue({
        activeBookingCount: 1,
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
    const updateRoomService = new CatalogService(
      {
        transaction: async <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> =>
          operation({}),
      },
      repository,
      { write: vi.fn() },
    );
    await expect(
      updateRoomService.updateRoom(actor, '550e8400-e29b-41d4-a716-446655440001', {
        roomTypeId: '550e8400-e29b-41d4-a716-446655440099',
      }),
    ).rejects.toBeInstanceOf(CatalogSafetyError);
  });
});
