import {
  type AmenityCommand,
  type AmenityPatch,
  type PriceTierCommand,
  type PropertyCommand,
  type RoomTypeCommand,
  type RoomTypePatch,
  type RoomCommand,
  type RoomPatch,
  type RoomHousekeepingCommand,
  type HousekeepingTaskAssignment,
  type HousekeepingTaskAssignmentCommand,
  type HousekeepingTaskAction,
  type HousekeepingAssignee,
  type HousekeepingTaskReopenCommand,
  type HousekeepingTaskVersionCommand,
  type MaintenanceBlockCommand,
  amenityCommandSchema,
  amenitySchema,
  amenityPatchSchema,
  assignAmenityCommandSchema,
  archiveCommandSchema,
  paginationQuerySchema,
  priceTierCommandSchema,
  priceTierSchema,
  propertyCommandSchema,
  propertySchema,
  roomTypeCommandSchema,
  roomTypeSchema,
  roomTypePatchSchema,
  roomCommandSchema,
  roomPatchSchema,
  roomHousekeepingCommandSchema,
  housekeepingTaskAssignmentCommandSchema,
  housekeepingTaskAssignmentSchema,
  housekeepingTaskActionSchema,
  housekeepingAssigneeListSchema,
  housekeepingTaskReopenCommandSchema,
  housekeepingTaskVersionCommandSchema,
  roomSchema,
  maintenanceBlockCommandSchema,
  maintenanceBlockSchema,
} from '@room/contracts';

import type { ActorContext } from '../auth/actor-context.js';

import { CatalogConflictError, CatalogNotFoundError } from './catalog.errors.js';
import { CatalogSafetyError, type CatalogSafetyCode } from './catalog.safety.js';

export interface CatalogPropertyRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly minimumStayMinutes?: number;
  readonly maximumStayMinutes?: number;
  readonly minimumLeadTimeMinutes?: number;
  readonly maximumAdvanceBookingDays?: number;
  readonly defaultOvernightDurationMinutes?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CatalogPriceTierRecord {
  readonly id: string;
  readonly propertyId: string;
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CatalogRoomTypeRecord {
  readonly id: string;
  readonly propertyId: string;
  readonly priceTierId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly maxAdults: number;
  readonly maxChildren: number;
  readonly maxOccupancy: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface CatalogAmenityRecord {
  readonly id: string;
  readonly propertyId: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface CatalogRoomRecord {
  readonly id: string;
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly roomNumber: string;
  readonly physicalRoomCode: string;
  readonly notes: string | null;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  readonly housekeepingStatus: 'CLEAN' | 'DIRTY' | 'CLEANING';
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface CatalogMaintenanceRecord {
  readonly id: string;
  readonly propertyId: string;
  readonly roomId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly reason: string;
  readonly status: 'ACTIVE' | 'CANCELLED';
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CatalogHousekeepingTaskAssignmentRecord {
  readonly id: string;
  readonly roomId: string;
  readonly assignedTo: string;
  readonly assignedBy: string;
  readonly assignedAt: Date;
  readonly version: number;
}

export interface CatalogHousekeepingTaskActionRecord {
  readonly id: string;
  readonly roomId: string;
  readonly version: number;
}

export interface CatalogHousekeepingAssigneeRecord {
  readonly id: string;
  readonly displayName: string;
}

export interface CancelMaintenanceResult {
  readonly block: CatalogMaintenanceRecord | undefined;
  readonly cancelled: boolean;
}

export interface CatalogRepositoryPort {
  getCurrentProperty(
    actor: ActorContext,
    transaction?: unknown,
    requestedPropertyId?: string,
  ): Promise<CatalogPropertyRecord | undefined>;
  updateProperty(
    transaction: unknown,
    id: string,
    command: PropertyCommand,
  ): Promise<CatalogPropertyRecord>;
  createPriceTier(
    transaction: unknown,
    propertyId: string,
    command: PriceTierCommand,
  ): Promise<CatalogPriceTierRecord>;
  listPriceTiers(
    propertyId: string,
    page: number,
    pageSize: number,
    transaction?: unknown,
  ): Promise<readonly CatalogPriceTierRecord[]>;
  updatePriceTier(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: PriceTierCommand,
  ): Promise<CatalogPriceTierRecord | undefined>;
  archivePriceTier(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogPriceTierRecord | undefined>;
  createRoomType(
    transaction: unknown,
    propertyId: string,
    command: RoomTypeCommand,
  ): Promise<CatalogRoomTypeRecord>;
  listRoomTypes(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<readonly CatalogRoomTypeRecord[]>;
  findRoomType(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogRoomTypeRecord | undefined>;
  updateRoomType(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: RoomTypePatch,
  ): Promise<CatalogRoomTypeRecord | undefined>;
  findRoomTypeAmenityMembership(
    transaction: unknown,
    propertyId: string,
    roomTypeId: string,
    amenityId: string,
  ): Promise<{ propertyId: string; roomTypeId: string; amenityId: string } | undefined>;
  removeRoomTypeAmenity(
    transaction: unknown,
    propertyId: string,
    roomTypeId: string,
    amenityId: string,
  ): Promise<boolean>;
  archiveRoomType(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogRoomTypeRecord | undefined>;
  lockRoomType(transaction: unknown, propertyId: string, id: string): Promise<void>;
  summarizeRoomTypeDependencies(
    transaction: unknown,
    propertyId: string,
    roomTypeId: string,
  ): Promise<RoomTypeDependencySummary>;
  createAmenity(
    transaction: unknown,
    propertyId: string,
    command: AmenityCommand,
  ): Promise<CatalogAmenityRecord>;
  listAmenities(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<readonly CatalogAmenityRecord[]>;
  findAmenity(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogAmenityRecord | undefined>;
  updateAmenity(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: AmenityPatch,
  ): Promise<CatalogAmenityRecord | undefined>;
  archiveAmenity(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogAmenityRecord | undefined>;
  assignAmenity(
    transaction: unknown,
    propertyId: string,
    roomTypeId: string,
    amenityId: string,
  ): Promise<void>;
  createRoom(
    transaction: unknown,
    propertyId: string,
    command: RoomCommand,
  ): Promise<CatalogRoomRecord>;
  archiveRoom(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogRoomRecord | undefined>;
  lockRoom(transaction: unknown, propertyId: string, id: string): Promise<void>;
  summarizeRoomCommitments(
    transaction: unknown,
    propertyId: string,
    roomId: string,
  ): Promise<RoomCommitmentSummary>;
  findRoom(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogRoomRecord | undefined>;
  findRoomByNumber(
    transaction: unknown,
    propertyId: string,
    roomNumber: string,
    excludeId?: string,
  ): Promise<CatalogRoomRecord | undefined>;
  roomHasFutureOrActiveBlocks(
    transaction: unknown,
    propertyId: string,
    roomId: string,
  ): Promise<boolean>;
  updateRoom(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: RoomPatch,
  ): Promise<CatalogRoomRecord | undefined>;
  updateRoomHousekeeping(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: RoomHousekeepingCommand,
    actorId: string,
  ): Promise<CatalogRoomRecord | undefined>;
  assignRoomHousekeeping?(
    transaction: unknown,
    propertyId: string,
    roomId: string,
    command: HousekeepingTaskAssignmentCommand,
    actorId: string,
  ): Promise<CatalogHousekeepingTaskAssignmentRecord | undefined>;
  verifyRoomHousekeeping?(
    transaction: unknown,
    propertyId: string,
    roomId: string,
    command: HousekeepingTaskVersionCommand,
    actorId: string,
  ): Promise<CatalogHousekeepingTaskActionRecord | undefined>;
  reopenRoomHousekeeping?(
    transaction: unknown,
    propertyId: string,
    roomId: string,
    command: HousekeepingTaskReopenCommand,
    actorId: string,
  ): Promise<CatalogHousekeepingTaskActionRecord | undefined>;
  listHousekeepingAssignees?(
    propertyId: string,
  ): Promise<readonly CatalogHousekeepingAssigneeRecord[]>;
  listRooms(
    propertyId: string,
    page: number,
    pageSize: number,
    propertyCode?: string,
  ): Promise<readonly CatalogRoomRecord[]>;
  createMaintenance(
    transaction: unknown,
    propertyId: string,
    command: MaintenanceBlockCommand,
  ): Promise<CatalogMaintenanceRecord>;
  listMaintenanceBlocks(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<readonly CatalogMaintenanceRecord[]>;
  cancelMaintenance(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CancelMaintenanceResult>;
}

/**
 * Aggregate counts of every blocking commitment or dependency the catalog
 * service must evaluate before mutating a physical room. Counts are
 * computed inside the same transaction that performs the archive or
 * retype so that a concurrent CREATE HOLD cannot bypass the check.
 */
export interface RoomCommitmentSummary {
  readonly activeBookingCount: number;
  readonly futureBookingCount: number;
  readonly activeMaintenanceCount: number;
  readonly futureMaintenanceCount: number;
  readonly activeInventoryBlockCount: number;
  readonly futureInventoryBlockCount: number;
}

/**
 * Aggregate counts of the catalog dependencies the service must evaluate
 * before archiving a room type. The `activeRatePlanCount` includes any
 * rate plan that still references the room type and is not
 * `INACTIVE`/`ARCHIVED`.
 */
export interface RoomTypeDependencySummary {
  readonly activeRoomCount: number;
  readonly futureBookingCount: number;
  readonly activeMaintenanceCount: number;
  readonly futureMaintenanceCount: number;
  readonly activeRatePlanCount: number;
}

function roomSafetyCode(
  summary: RoomCommitmentSummary,
  mode: 'archive' | 'retype',
): CatalogSafetyCode | undefined {
  if (summary.activeBookingCount > 0) {
    return mode === 'archive' ? 'ROOM_ARCHIVE_ACTIVE_BOOKING' : 'ROOM_RETYPE_ACTIVE_BOOKING';
  }
  if (summary.futureBookingCount > 0) {
    return mode === 'archive' ? 'ROOM_ARCHIVE_FUTURE_BOOKING' : 'ROOM_RETYPE_FUTURE_BOOKING';
  }
  if (summary.activeMaintenanceCount > 0) {
    return mode === 'archive'
      ? 'ROOM_ARCHIVE_ACTIVE_MAINTENANCE'
      : 'ROOM_RETYPE_ACTIVE_MAINTENANCE';
  }
  if (summary.futureMaintenanceCount > 0) {
    return mode === 'archive'
      ? 'ROOM_ARCHIVE_FUTURE_MAINTENANCE'
      : 'ROOM_RETYPE_FUTURE_MAINTENANCE';
  }
  if (summary.activeInventoryBlockCount > 0 && mode === 'archive') {
    return 'ROOM_ARCHIVE_ACTIVE_INVENTORY_BLOCK';
  }
  if (summary.futureInventoryBlockCount > 0 && mode === 'archive') {
    return 'ROOM_ARCHIVE_FUTURE_INVENTORY_BLOCK';
  }
  return undefined;
}

function roomTypeSafetyCode(summary: RoomTypeDependencySummary): CatalogSafetyCode | undefined {
  if (summary.activeRoomCount > 0) return 'ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS';
  if (summary.futureBookingCount > 0) return 'ROOM_TYPE_ARCHIVE_FUTURE_BOOKING';
  if (summary.activeMaintenanceCount > 0) return 'ROOM_TYPE_ARCHIVE_ACTIVE_MAINTENANCE';
  if (summary.futureMaintenanceCount > 0) return 'ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE';
  if (summary.activeRatePlanCount > 0) return 'ROOM_TYPE_ARCHIVE_ACTIVE_RATE_PLAN';
  return undefined;
}

export interface AuditRepositoryPort {
  write(
    transaction: unknown,
    event: {
      readonly propertyId: string;
      readonly aggregateType: string;
      readonly aggregateId: string;
      readonly eventType: string;
      readonly actorId: string;
      readonly payload: Record<string, string | number>;
    },
  ): Promise<void>;
}

export interface TransactionManager {
  transaction<T>(operation: (transaction: unknown) => Promise<T>): Promise<T>;
}

function hasPostgresCode(error: unknown, code: string, depth = 0): boolean {
  if (depth > 3 || typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === code) return true;
  return 'cause' in error && hasPostgresCode(error.cause, code, depth + 1);
}

function toProperty(record: CatalogPropertyRecord) {
  return propertySchema.parse({
    ...record,
    currency: 'VND',
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toPriceTier(record: CatalogPriceTierRecord) {
  return priceTierSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
function toRoomType(record: CatalogRoomTypeRecord) {
  return roomTypeSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
function toAmenity(record: CatalogAmenityRecord) {
  return amenitySchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
function toRoom(record: CatalogRoomRecord) {
  return roomSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
function toMaintenance(record: CatalogMaintenanceRecord) {
  return maintenanceBlockSchema.parse({
    ...record,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export class CatalogService {
  public constructor(
    private readonly database: TransactionManager,
    private readonly repository: CatalogRepositoryPort,
    private readonly audit: AuditRepositoryPort,
  ) {}

  public async getProperty(actor: ActorContext) {
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CatalogNotFoundError();
    return toProperty(property);
  }

  public async updateProperty(actor: ActorContext, input: unknown) {
    const command = propertyCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const current = await this.repository.getCurrentProperty(actor, transaction);
      if (current === undefined) throw new CatalogNotFoundError();
      const normalizedCommand = propertyCommandSchema.parse({
        ...command,
        minimumStayMinutes: command.minimumStayMinutes ?? current.minimumStayMinutes ?? 60,
        maximumStayMinutes: command.maximumStayMinutes ?? current.maximumStayMinutes ?? 10_080,
        minimumLeadTimeMinutes:
          command.minimumLeadTimeMinutes ?? current.minimumLeadTimeMinutes ?? 0,
        maximumAdvanceBookingDays:
          command.maximumAdvanceBookingDays ?? current.maximumAdvanceBookingDays ?? 365,
        defaultOvernightDurationMinutes:
          command.defaultOvernightDurationMinutes ?? current.defaultOvernightDurationMinutes ?? 720,
      });
      const property = await this.repository.updateProperty(
        transaction,
        current.id,
        normalizedCommand,
      );
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'PROPERTY',
        aggregateId: property.id,
        eventType: 'PROPERTY_UPDATED',
        actorId: actor.userId,
        payload: {
          code: property.code,
          name: property.name,
          minimumStayMinutes: normalizedCommand.minimumStayMinutes ?? 60,
          maximumStayMinutes: normalizedCommand.maximumStayMinutes ?? 10_080,
          minimumLeadTimeMinutes: normalizedCommand.minimumLeadTimeMinutes ?? 0,
          maximumAdvanceBookingDays: normalizedCommand.maximumAdvanceBookingDays ?? 365,
          defaultOvernightDurationMinutes: normalizedCommand.defaultOvernightDurationMinutes ?? 720,
        },
      });
      return toProperty(property);
    });
  }

  public async listPriceTiers(actor: ActorContext, input: unknown) {
    const page = paginationQuerySchema.parse(input);
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CatalogNotFoundError();
    const items = await this.repository.listPriceTiers(property.id, page.page, page.pageSize);
    return { ...page, items: items.map(toPriceTier) };
  }

  public async createPriceTier(actor: ActorContext, input: unknown) {
    const command = priceTierCommandSchema.parse(input);
    try {
      return await this.database.transaction(async (transaction) => {
        const property = await this.repository.getCurrentProperty(actor, transaction);
        if (property === undefined) throw new CatalogNotFoundError();
        const tier = await this.repository.createPriceTier(transaction, property.id, command);
        await this.audit.write(transaction, {
          propertyId: property.id,
          aggregateType: 'PRICE_TIER',
          aggregateId: tier.id,
          eventType: 'PRICE_TIER_CREATED',
          actorId: actor.userId,
          payload: { code: tier.code, name: tier.name, sortOrder: tier.sortOrder },
        });
        return toPriceTier(tier);
      });
    } catch (error) {
      if (hasPostgresCode(error, '23505')) throw new CatalogConflictError();
      throw error;
    }
  }

  public async updatePriceTier(actor: ActorContext, id: string, input: unknown) {
    const command = priceTierCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const tier = await this.repository.updatePriceTier(transaction, property.id, id, command);
      if (tier === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'PRICE_TIER',
        aggregateId: tier.id,
        eventType: 'PRICE_TIER_UPDATED',
        actorId: actor.userId,
        payload: { code: tier.code, name: tier.name, sortOrder: tier.sortOrder },
      });
      return toPriceTier(tier);
    });
  }

  public async archivePriceTier(actor: ActorContext, id: string, input: unknown) {
    archiveCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const tier = await this.repository.archivePriceTier(transaction, property.id, id);
      if (tier === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'PRICE_TIER',
        aggregateId: tier.id,
        eventType: 'PRICE_TIER_ARCHIVED',
        actorId: actor.userId,
        payload: { code: tier.code, name: tier.name, sortOrder: tier.sortOrder },
      });
      return toPriceTier(tier);
    });
  }

  public async createRoomType(actor: ActorContext, input: unknown) {
    const command = roomTypeCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const roomType = await this.repository.createRoomType(transaction, property.id, command);
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'ROOM_TYPE',
        aggregateId: roomType.id,
        eventType: 'ROOM_TYPE_CREATED',
        actorId: actor.userId,
        payload: { code: roomType.code, name: roomType.name },
      });
      return toRoomType(roomType);
    });
  }
  public async listRoomTypes(actor: ActorContext, input: unknown) {
    const page = paginationQuerySchema.parse(input);
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CatalogNotFoundError();
    const items = await this.repository.listRoomTypes(property.id, page.page, page.pageSize);
    return { ...page, items: items.map(toRoomType) };
  }
  public async updateRoomType(actor: ActorContext, id: string, input: unknown) {
    const command = roomTypePatchSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const existing = await this.repository.findRoomType(transaction, property.id, id);
      if (existing === undefined) throw new CatalogNotFoundError();
      if (command.priceTierId !== undefined) {
        const tier = await this.repository.listPriceTiers(property.id, 1, 100, transaction);
        const samePropertyTier = tier.find((t) => t.id === command.priceTierId);
        if (samePropertyTier === undefined) {
          throw new CatalogNotFoundError(
            'price-tier-not-in-property',
            'Price tier does not belong to the current property.',
          );
        }
      }
      const nextMaxAdults = command.maxAdults ?? existing.maxAdults;
      const nextMaxChildren = command.maxChildren ?? existing.maxChildren;
      const nextMaxOccupancy = command.maxOccupancy ?? existing.maxOccupancy;
      if (
        nextMaxOccupancy < nextMaxAdults ||
        nextMaxOccupancy < nextMaxChildren ||
        nextMaxOccupancy > nextMaxAdults + nextMaxChildren
      ) {
        throw new CatalogConflictError(
          'invalid-capacity',
          'Capacity relationship is invalid for the updated room type.',
        );
      }
      const updated = await this.repository.updateRoomType(transaction, property.id, id, command);
      if (updated === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'ROOM_TYPE',
        aggregateId: updated.id,
        eventType: 'ROOM_TYPE_UPDATED',
        actorId: actor.userId,
        payload: {
          name: updated.name,
          maxOccupancy: updated.maxOccupancy,
          priceTierId: updated.priceTierId,
        },
      });
      return toRoomType(updated);
    });
  }
  public async removeRoomTypeAmenity(actor: ActorContext, roomTypeId: string, amenityId: string) {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const roomType = await this.repository.findRoomType(transaction, property.id, roomTypeId);
      if (roomType === undefined) throw new CatalogNotFoundError();
      const amenity = await this.repository.findAmenity(transaction, property.id, amenityId);
      if (amenity === undefined) throw new CatalogNotFoundError();
      const membership = await this.repository.findRoomTypeAmenityMembership(
        transaction,
        property.id,
        roomTypeId,
        amenityId,
      );
      const removed = await this.repository.removeRoomTypeAmenity(
        transaction,
        property.id,
        roomTypeId,
        amenityId,
      );
      if (removed) {
        await this.audit.write(transaction, {
          propertyId: property.id,
          aggregateType: 'ROOM_TYPE',
          aggregateId: roomTypeId,
          eventType: 'ROOM_TYPE_AMENITY_REMOVED',
          actorId: actor.userId,
          payload: { amenityId },
        });
      }
      return { roomTypeId, amenityId, existed: membership !== undefined };
    });
  }
  public async archiveRoomType(actor: ActorContext, id: string, input: unknown) {
    archiveCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      await this.repository.lockRoomType(transaction, property.id, id);
      const summary = await this.repository.summarizeRoomTypeDependencies(
        transaction,
        property.id,
        id,
      );
      const code = roomTypeSafetyCode(summary);
      if (code !== undefined) {
        throw new CatalogSafetyError(
          code,
          'Room type cannot be archived while active rooms, bookings, maintenance, or rate plans depend on it.',
        );
      }
      const roomType = await this.repository.archiveRoomType(transaction, property.id, id);
      if (roomType === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'ROOM_TYPE',
        aggregateId: roomType.id,
        eventType: 'ROOM_TYPE_ARCHIVED',
        actorId: actor.userId,
        payload: { code: roomType.code, name: roomType.name },
      });
      return toRoomType(roomType);
    });
  }
  public async createAmenity(actor: ActorContext, input: unknown) {
    const command = amenityCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const amenity = await this.repository.createAmenity(transaction, property.id, command);
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'AMENITY',
        aggregateId: amenity.id,
        eventType: 'AMENITY_CREATED',
        actorId: actor.userId,
        payload: { code: amenity.code, name: amenity.name },
      });
      return toAmenity(amenity);
    });
  }
  public async listAmenities(actor: ActorContext, input: unknown) {
    const page = paginationQuerySchema.parse(input);
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CatalogNotFoundError();
    const items = await this.repository.listAmenities(property.id, page.page, page.pageSize);
    return { ...page, items: items.map(toAmenity) };
  }
  public async archiveAmenity(actor: ActorContext, id: string, input: unknown) {
    archiveCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const amenity = await this.repository.archiveAmenity(transaction, property.id, id);
      if (amenity === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'AMENITY',
        aggregateId: amenity.id,
        eventType: 'AMENITY_ARCHIVED',
        actorId: actor.userId,
        payload: { code: amenity.code, name: amenity.name },
      });
      return toAmenity(amenity);
    });
  }
  public async assignAmenity(actor: ActorContext, roomTypeId: string, input: unknown) {
    const command = assignAmenityCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      await this.repository.assignAmenity(transaction, property.id, roomTypeId, command.amenityId);
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'ROOM_TYPE',
        aggregateId: roomTypeId,
        eventType: 'ROOM_TYPE_AMENITY_ASSIGNED',
        actorId: actor.userId,
        payload: { amenityId: command.amenityId },
      });
    });
  }
  public async updateAmenity(actor: ActorContext, id: string, input: unknown) {
    const command = amenityPatchSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const updated = await this.repository.updateAmenity(transaction, property.id, id, command);
      if (updated === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'AMENITY',
        aggregateId: updated.id,
        eventType: 'AMENITY_UPDATED',
        actorId: actor.userId,
        payload: { name: updated.name },
      });
      return toAmenity(updated);
    });
  }
  public async createRoom(actor: ActorContext, input: unknown) {
    const command = roomCommandSchema.parse(input);
    try {
      return await this.database.transaction(async (transaction) => {
        const property = await this.repository.getCurrentProperty(actor, transaction);
        if (property === undefined) throw new CatalogNotFoundError();
        const room = await this.repository.createRoom(transaction, property.id, command);
        await this.audit.write(transaction, {
          propertyId: property.id,
          aggregateType: 'ROOM',
          aggregateId: room.id,
          eventType: 'ROOM_CREATED',
          actorId: actor.userId,
          payload: { roomNumber: room.roomNumber },
        });
        return toRoom(room);
      });
    } catch (error) {
      if (hasPostgresCode(error, '23505')) throw new CatalogConflictError();
      throw error;
    }
  }
  public async archiveRoom(actor: ActorContext, id: string, input: unknown) {
    archiveCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      await this.repository.lockRoom(transaction, property.id, id);
      const summary = await this.repository.summarizeRoomCommitments(transaction, property.id, id);
      const code = roomSafetyCode(summary, 'archive');
      if (code !== undefined) {
        throw new CatalogSafetyError(
          code,
          'Room cannot be archived while bookings, maintenance, or inventory blocks are active or future.',
        );
      }
      const room = await this.repository.archiveRoom(transaction, property.id, id);
      if (room === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'ROOM',
        aggregateId: room.id,
        eventType: 'ROOM_ARCHIVED',
        actorId: actor.userId,
        payload: { roomNumber: room.roomNumber },
      });
      return toRoom(room);
    });
  }
  public async updateRoomHousekeeping(actor: ActorContext, id: string, input: unknown) {
    const command = roomHousekeepingCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      await this.repository.lockRoom(transaction, property.id, id);
      const existing = await this.repository.findRoom(transaction, property.id, id);
      if (existing === undefined) throw new CatalogNotFoundError();
      if (!isAllowedHousekeepingTransition(existing.housekeepingStatus, command.status)) {
        throw new CatalogSafetyError(
          'ROOM_HOUSEKEEPING_INVALID_TRANSITION',
          'Housekeeping must progress from DIRTY to CLEANING before CLEAN.',
        );
      }
      const room = await this.repository.updateRoomHousekeeping(
        transaction,
        property.id,
        id,
        command,
        actor.userId,
      );
      if (room === undefined) {
        throw new CatalogConflictError(
          'ROOM_HOUSEKEEPING_VERSION_CONFLICT',
          'The assigned turnover task changed before this update could be applied.',
        );
      }
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'ROOM',
        aggregateId: room.id,
        eventType: 'ROOM_HOUSEKEEPING_UPDATED',
        actorId: actor.userId,
        payload: { housekeepingStatus: room.housekeepingStatus },
      });
      return toRoom(room);
    });
  }
  public async assignRoomHousekeeping(
    actor: ActorContext,
    roomId: string,
    input: unknown,
  ): Promise<HousekeepingTaskAssignment> {
    const command = housekeepingTaskAssignmentCommandSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      await this.repository.lockRoom(transaction, property.id, roomId);
      const assignRoomHousekeeping = this.repository.assignRoomHousekeeping;
      if (assignRoomHousekeeping === undefined) {
        throw new CatalogConflictError(
          'ROOM_HOUSEKEEPING_ASSIGNMENT_UNAVAILABLE',
          'Housekeeping assignment is unavailable.',
        );
      }
      const assignment = await assignRoomHousekeeping.call(
        this.repository,
        transaction,
        property.id,
        roomId,
        command,
        actor.userId,
      );
      if (assignment === undefined) {
        throw new CatalogConflictError(
          'ROOM_HOUSEKEEPING_ASSIGNMENT_CONFLICT',
          'The turnover task is no longer available for this assignment.',
        );
      }
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'HOUSEKEEPING_TASK',
        aggregateId: assignment.id,
        eventType: 'ROOM_HOUSEKEEPING_ASSIGNED',
        actorId: actor.userId,
        payload: { roomId, version: assignment.version },
      });
      return housekeepingTaskAssignmentSchema.parse({
        taskId: assignment.id,
        roomId: assignment.roomId,
        assigneeId: assignment.assignedTo,
        assignedBy: assignment.assignedBy,
        assignedAt: assignment.assignedAt.toISOString(),
        version: assignment.version,
      });
    });
  }
  public async verifyRoomHousekeeping(
    actor: ActorContext,
    roomId: string,
    input: unknown,
  ): Promise<HousekeepingTaskAction> {
    const command = housekeepingTaskVersionCommandSchema.parse(input);
    return this.applyHousekeepingTaskAction(
      actor,
      roomId,
      command,
      'verifyRoomHousekeeping',
      'ROOM_HOUSEKEEPING_VERIFIED',
    );
  }
  public async listHousekeepingAssignees(
    actor: ActorContext,
  ): Promise<readonly HousekeepingAssignee[]> {
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CatalogNotFoundError();
    const list = this.repository.listHousekeepingAssignees;
    if (list === undefined) {
      throw new CatalogConflictError(
        'ROOM_HOUSEKEEPING_ASSIGNMENT_UNAVAILABLE',
        'Housekeeping assignment is unavailable.',
      );
    }
    return housekeepingAssigneeListSchema.parse({
      items: await list.call(this.repository, property.id),
    }).items;
  }
  public async reopenRoomHousekeeping(
    actor: ActorContext,
    roomId: string,
    input: unknown,
  ): Promise<HousekeepingTaskAction> {
    const command = housekeepingTaskReopenCommandSchema.parse(input);
    return this.applyHousekeepingTaskAction(
      actor,
      roomId,
      command,
      'reopenRoomHousekeeping',
      'ROOM_HOUSEKEEPING_REOPENED',
    );
  }
  private async applyHousekeepingTaskAction(
    actor: ActorContext,
    roomId: string,
    command: HousekeepingTaskVersionCommand | HousekeepingTaskReopenCommand,
    operation: 'verifyRoomHousekeeping' | 'reopenRoomHousekeeping',
    eventType: 'ROOM_HOUSEKEEPING_VERIFIED' | 'ROOM_HOUSEKEEPING_REOPENED',
  ): Promise<HousekeepingTaskAction> {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      await this.repository.lockRoom(transaction, property.id, roomId);
      const action = this.repository[operation];
      if (action === undefined) {
        throw new CatalogConflictError(
          'ROOM_HOUSEKEEPING_ACTION_UNAVAILABLE',
          'Housekeeping action is unavailable.',
        );
      }
      const result = await action.call(
        this.repository,
        transaction,
        property.id,
        roomId,
        command as never,
        actor.userId,
      );
      if (result === undefined) {
        throw new CatalogConflictError(
          'ROOM_HOUSEKEEPING_ACTION_CONFLICT',
          'The turnover task is no longer available for this action.',
        );
      }
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'HOUSEKEEPING_TASK',
        aggregateId: result.id,
        eventType,
        actorId: actor.userId,
        payload: { roomId, version: result.version },
      });
      return housekeepingTaskActionSchema.parse({
        taskId: result.id,
        roomId: result.roomId,
        version: result.version,
      });
    });
  }
  public async updateRoom(actor: ActorContext, id: string, input: unknown) {
    const command = roomPatchSchema.parse(input);
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const existing = await this.repository.findRoom(transaction, property.id, id);
      if (existing === undefined) throw new CatalogNotFoundError();
      if (command.roomNumber !== undefined && command.roomNumber !== existing.roomNumber) {
        const duplicate = await this.repository.findRoomByNumber(
          transaction,
          property.id,
          command.roomNumber,
          existing.id,
        );
        if (duplicate !== undefined) {
          throw new CatalogConflictError(
            'duplicate-room-number',
            'Another room in this property already uses the same room number.',
          );
        }
      }
      if (command.roomTypeId !== undefined && command.roomTypeId !== existing.roomTypeId) {
        const targetType = await this.repository.findRoomType(
          transaction,
          property.id,
          command.roomTypeId,
        );
        if (targetType === undefined) {
          throw new CatalogNotFoundError(
            'room-type-not-in-property',
            'Target room type does not belong to the current property.',
          );
        }
        await this.repository.lockRoom(transaction, property.id, existing.id);
        const summary = await this.repository.summarizeRoomCommitments(
          transaction,
          property.id,
          existing.id,
        );
        const code = roomSafetyCode(summary, 'retype');
        if (code !== undefined) {
          throw new CatalogSafetyError(
            code,
            'Room cannot be retyped while bookings, maintenance, or inventory blocks are active or future.',
          );
        }
      }
      const updated = await this.repository.updateRoom(transaction, property.id, id, command);
      if (updated === undefined) throw new CatalogNotFoundError();
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'ROOM',
        aggregateId: updated.id,
        eventType: 'ROOM_UPDATED',
        actorId: actor.userId,
        payload: {
          roomNumber: updated.roomNumber,
          roomTypeId: updated.roomTypeId,
        },
      });
      return toRoom(updated);
    });
  }
  public async listRooms(actor: ActorContext, input: unknown) {
    const page = paginationQuerySchema.parse(input);
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CatalogNotFoundError();
    const items = await this.repository.listRooms(
      property.id,
      page.page,
      page.pageSize,
      property.code,
    );
    return { ...page, items: items.map(toRoom) };
  }
  public async createMaintenanceBlock(actor: ActorContext, input: unknown) {
    const command = maintenanceBlockCommandSchema.parse(input);
    try {
      return await this.database.transaction(async (transaction) => {
        const property = await this.repository.getCurrentProperty(actor, transaction);
        if (property === undefined) throw new CatalogNotFoundError();
        const block = await this.repository.createMaintenance(transaction, property.id, command);
        await this.audit.write(transaction, {
          propertyId: property.id,
          aggregateType: 'MAINTENANCE_BLOCK',
          aggregateId: block.id,
          eventType: 'MAINTENANCE_CREATED',
          actorId: actor.userId,
          payload: { roomId: block.roomId, reason: block.reason },
        });
        return toMaintenance(block);
      });
    } catch (error) {
      if (hasPostgresCode(error, '23P01')) throw new CatalogConflictError();
      throw error;
    }
  }
  public async listMaintenanceBlocks(actor: ActorContext, input: unknown) {
    const page = paginationQuerySchema.parse(input);
    const property = await this.repository.getCurrentProperty(actor);
    if (property === undefined) throw new CatalogNotFoundError();
    const items = await this.repository.listMaintenanceBlocks(
      property.id,
      page.page,
      page.pageSize,
    );
    return { ...page, items: items.map(toMaintenance) };
  }
  public async cancelMaintenanceBlock(actor: ActorContext, id: string) {
    return this.database.transaction(async (transaction) => {
      const property = await this.repository.getCurrentProperty(actor, transaction);
      if (property === undefined) throw new CatalogNotFoundError();
      const result = await this.repository.cancelMaintenance(transaction, property.id, id);
      const { block } = result;
      if (block === undefined) throw new CatalogNotFoundError();
      if (!result.cancelled) return toMaintenance(block);
      await this.audit.write(transaction, {
        propertyId: property.id,
        aggregateType: 'MAINTENANCE_BLOCK',
        aggregateId: block.id,
        eventType: 'MAINTENANCE_CANCELLED',
        actorId: actor.userId,
        payload: { roomId: block.roomId },
      });
      return toMaintenance(block);
    });
  }
}

function isAllowedHousekeepingTransition(
  current: CatalogRoomRecord['housekeepingStatus'],
  next: CatalogRoomRecord['housekeepingStatus'],
): boolean {
  return (
    (current === 'CLEAN' && next === 'DIRTY') ||
    (current === 'DIRTY' && next === 'CLEANING') ||
    (current === 'CLEANING' && next === 'CLEAN')
  );
}
