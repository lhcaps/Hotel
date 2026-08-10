import {
  CLIENT_ROOM_MANIFEST,
  and,
  amenities,
  asc,
  eq,
  type DatabaseClient,
  maintenanceBlocks,
  priceTiers,
  properties,
  ratePlanPrices,
  ratePlans,
  roomInventoryBlocks,
  roomTypeAmenities,
  roomTypes,
  rooms,
  sql,
} from '@room/database';
import type {
  AmenityCommand,
  AmenityPatch,
  PriceTierCommand,
  PropertyCommand,
  RoomTypeCommand,
  RoomTypePatch,
  RoomCommand,
  RoomPatch,
  RoomHousekeepingCommand,
  HousekeepingTaskAssignmentCommand,
  HousekeepingTaskReopenCommand,
  HousekeepingTaskVersionCommand,
  MaintenanceBlockCommand,
} from '@room/contracts';

import type {
  CatalogPriceTierRecord,
  CatalogPropertyRecord,
  CatalogRepositoryPort,
  CatalogAmenityRecord,
  CancelMaintenanceResult,
  CatalogRoomTypeRecord,
  CatalogRoomRecord,
  CatalogMaintenanceRecord,
  CatalogHousekeepingTaskAssignmentRecord,
  CatalogHousekeepingTaskActionRecord,
  RoomCommitmentSummary,
  RoomTypeDependencySummary,
} from './catalog.service.js';

type CatalogDatabase = DatabaseClient;

const APPROVED_PEACE_HOME_PHYSICAL_ROOM_CODES = CLIENT_ROOM_MANIFEST.rooms.map(
  (room) => room.physicalRoomCode,
);

function asCatalogDatabase(transaction: unknown, fallback: CatalogDatabase): CatalogDatabase {
  return transaction === undefined ? fallback : (transaction as CatalogDatabase);
}

function toHousekeepingTaskAction(row: unknown): CatalogHousekeepingTaskActionRecord | undefined {
  if (
    typeof row !== 'object' ||
    row === null ||
    !('id' in row) ||
    !('room_id' in row) ||
    !('version' in row) ||
    typeof row.id !== 'string' ||
    typeof row.room_id !== 'string' ||
    typeof row.version !== 'number'
  ) {
    return undefined;
  }
  return { id: row.id, roomId: row.room_id, version: row.version };
}

export class CatalogRepository implements CatalogRepositoryPort {
  public constructor(private readonly database: CatalogDatabase) {}

  public async getCurrentProperty(
    transaction?: unknown,
  ): Promise<CatalogPropertyRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    return database.query.properties.findFirst({
      where: (property, operators) => operators.eq(property.status, 'ACTIVE'),
      orderBy: (property, operators) => [
        operators.asc(property.createdAt),
        operators.asc(property.id),
      ],
    });
  }

  public async updateProperty(
    transaction: unknown,
    id: string,
    command: PropertyCommand,
  ): Promise<CatalogPropertyRecord> {
    const database = asCatalogDatabase(transaction, this.database);
    const [updated] = await database
      .update(properties)
      .set({
        code: command.code,
        name: command.name,
        ...(command.minimumStayMinutes === undefined
          ? {}
          : { minimumStayMinutes: command.minimumStayMinutes }),
        ...(command.maximumStayMinutes === undefined
          ? {}
          : { maximumStayMinutes: command.maximumStayMinutes }),
        ...(command.minimumLeadTimeMinutes === undefined
          ? {}
          : { minimumLeadTimeMinutes: command.minimumLeadTimeMinutes }),
        ...(command.maximumAdvanceBookingDays === undefined
          ? {}
          : { maximumAdvanceBookingDays: command.maximumAdvanceBookingDays }),
        ...(command.defaultOvernightDurationMinutes === undefined
          ? {}
          : { defaultOvernightDurationMinutes: command.defaultOvernightDurationMinutes }),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, id))
      .returning();
    if (updated === undefined) throw new Error('Property disappeared during update.');
    return updated;
  }

  public async listPriceTiers(
    propertyId: string,
    page: number,
    pageSize: number,
    transaction?: unknown,
  ): Promise<readonly CatalogPriceTierRecord[]> {
    const database = asCatalogDatabase(transaction, this.database);
    return database.query.priceTiers.findMany({
      where: (tier, operators) => operators.eq(tier.propertyId, propertyId),
      orderBy: [asc(priceTiers.sortOrder), asc(priceTiers.code), asc(priceTiers.id)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }

  public async createPriceTier(
    transaction: unknown,
    propertyId: string,
    command: PriceTierCommand,
  ): Promise<CatalogPriceTierRecord> {
    const database = asCatalogDatabase(transaction, this.database);
    const [created] = await database
      .insert(priceTiers)
      .values({
        propertyId,
        code: command.code,
        name: command.name,
        sortOrder: command.sortOrder,
      })
      .returning();
    if (created === undefined) throw new Error('Price tier creation did not return a row.');
    return created;
  }

  public async updatePriceTier(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: PriceTierCommand,
  ): Promise<CatalogPriceTierRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const [updated] = await database
      .update(priceTiers)
      .set({
        code: command.code,
        name: command.name,
        sortOrder: command.sortOrder,
        updatedAt: new Date(),
      })
      .where(and(eq(priceTiers.id, id), eq(priceTiers.propertyId, propertyId)))
      .returning();
    return updated;
  }

  public async archivePriceTier(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogPriceTierRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const [updated] = await database
      .update(priceTiers)
      .set({ status: 'INACTIVE', updatedAt: new Date() })
      .where(and(eq(priceTiers.id, id), eq(priceTiers.propertyId, propertyId)))
      .returning();
    return updated;
  }
  public async createRoomType(
    transaction: unknown,
    propertyId: string,
    command: RoomTypeCommand,
  ): Promise<CatalogRoomTypeRecord> {
    const database = asCatalogDatabase(transaction, this.database);
    const [created] = await database
      .insert(roomTypes)
      .values({ propertyId, ...command, description: command.description ?? null })
      .returning();
    if (created === undefined) throw new Error('Room type creation did not return a row.');
    return created;
  }
  public async listRoomTypes(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<readonly CatalogRoomTypeRecord[]> {
    return this.database.query.roomTypes.findMany({
      where: (roomType, operators) => operators.eq(roomType.propertyId, propertyId),
      orderBy: [asc(roomTypes.code), asc(roomTypes.id)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }
  public async findRoomType(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogRoomTypeRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    return database.query.roomTypes.findFirst({
      where: (roomType, operators) =>
        operators.and(operators.eq(roomType.id, id), operators.eq(roomType.propertyId, propertyId)),
    });
  }
  public async updateRoomType(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: RoomTypePatch,
  ): Promise<CatalogRoomTypeRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const patch: Partial<typeof roomTypes.$inferInsert> = { updatedAt: new Date() };
    if (command.name !== undefined) patch.name = command.name;
    if (command.description !== undefined) patch.description = command.description;
    if (command.maxAdults !== undefined) patch.maxAdults = command.maxAdults;
    if (command.maxChildren !== undefined) patch.maxChildren = command.maxChildren;
    if (command.maxOccupancy !== undefined) patch.maxOccupancy = command.maxOccupancy;
    if (command.priceTierId !== undefined) patch.priceTierId = command.priceTierId;
    const [updated] = await database
      .update(roomTypes)
      .set(patch)
      .where(and(eq(roomTypes.id, id), eq(roomTypes.propertyId, propertyId)))
      .returning();
    return updated;
  }
  public async findRoomTypeAmenityMembership(
    transaction: unknown,
    propertyId: string,
    roomTypeId: string,
    amenityId: string,
  ): Promise<{ propertyId: string; roomTypeId: string; amenityId: string } | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const row = await database.query.roomTypeAmenities.findFirst({
      where: (join, operators) =>
        operators.and(
          operators.eq(join.propertyId, propertyId),
          operators.eq(join.roomTypeId, roomTypeId),
          operators.eq(join.amenityId, amenityId),
        ),
    });
    return row;
  }
  public async removeRoomTypeAmenity(
    transaction: unknown,
    propertyId: string,
    roomTypeId: string,
    amenityId: string,
  ): Promise<boolean> {
    const database = asCatalogDatabase(transaction, this.database);
    const rows = await database
      .delete(roomTypeAmenities)
      .where(
        and(
          eq(roomTypeAmenities.propertyId, propertyId),
          eq(roomTypeAmenities.roomTypeId, roomTypeId),
          eq(roomTypeAmenities.amenityId, amenityId),
        ),
      )
      .returning();
    return rows.length > 0;
  }
  public async archiveRoomType(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogRoomTypeRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const [updated] = await database
      .update(roomTypes)
      .set({ status: 'INACTIVE', updatedAt: new Date() })
      .where(
        and(
          eq(roomTypes.id, id),
          eq(roomTypes.propertyId, propertyId),
          eq(roomTypes.status, 'ACTIVE'),
        ),
      )
      .returning();
    return updated;
  }
  public async lockRoomType(transaction: unknown, propertyId: string, id: string): Promise<void> {
    const database = asCatalogDatabase(transaction, this.database);
    await database.execute(
      sql`SELECT id FROM room_types WHERE property_id = ${propertyId} AND id = ${id} FOR UPDATE`,
    );
  }
  public async createAmenity(
    transaction: unknown,
    propertyId: string,
    command: AmenityCommand,
  ): Promise<CatalogAmenityRecord> {
    const database = asCatalogDatabase(transaction, this.database);
    const [created] = await database
      .insert(amenities)
      .values({ propertyId, ...command })
      .returning();
    if (created === undefined) throw new Error('Amenity creation did not return a row.');
    return created;
  }
  public async listAmenities(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<readonly CatalogAmenityRecord[]> {
    return this.database.query.amenities.findMany({
      where: (amenity, operators) => operators.eq(amenity.propertyId, propertyId),
      orderBy: [asc(amenities.code), asc(amenities.id)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }
  public async findAmenity(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogAmenityRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    return database.query.amenities.findFirst({
      where: (amenity, operators) =>
        operators.and(operators.eq(amenity.id, id), operators.eq(amenity.propertyId, propertyId)),
    });
  }
  public async updateAmenity(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: AmenityPatch,
  ): Promise<CatalogAmenityRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const [updated] = await database
      .update(amenities)
      .set({ name: command.name, updatedAt: new Date() })
      .where(and(eq(amenities.id, id), eq(amenities.propertyId, propertyId)))
      .returning();
    return updated;
  }
  public async archiveAmenity(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogAmenityRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const [updated] = await database
      .update(amenities)
      .set({ status: 'INACTIVE', updatedAt: new Date() })
      .where(and(eq(amenities.id, id), eq(amenities.propertyId, propertyId)))
      .returning();
    return updated;
  }
  public async assignAmenity(
    transaction: unknown,
    propertyId: string,
    roomTypeId: string,
    amenityId: string,
  ): Promise<void> {
    const database = asCatalogDatabase(transaction, this.database);
    await database
      .insert(roomTypeAmenities)
      .values({ propertyId, roomTypeId, amenityId })
      .onConflictDoNothing();
  }
  public async createRoom(
    transaction: unknown,
    propertyId: string,
    command: RoomCommand,
  ): Promise<CatalogRoomRecord> {
    const database = asCatalogDatabase(transaction, this.database);
    const [created] = await database
      .insert(rooms)
      .values({
        propertyId,
        ...command,
        physicalRoomCode: command.physicalRoomCode ?? command.roomNumber,
        status: command.status ?? 'ACTIVE',
      })
      .returning();
    if (created === undefined) throw new Error('Room creation did not return a row.');
    return created;
  }
  public async archiveRoom(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogRoomRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const [updated] = await database
      .update(rooms)
      .set({ status: 'INACTIVE', updatedAt: new Date() })
      .where(and(eq(rooms.id, id), eq(rooms.propertyId, propertyId), eq(rooms.status, 'ACTIVE')))
      .returning();
    return updated;
  }
  public async lockRoom(transaction: unknown, propertyId: string, id: string): Promise<void> {
    const database = asCatalogDatabase(transaction, this.database);
    await database.execute(
      sql`SELECT id FROM rooms WHERE property_id = ${propertyId} AND id = ${id} FOR UPDATE`,
    );
  }
  public async updateRoomHousekeeping(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: RoomHousekeepingCommand,
    actorId: string,
  ): Promise<CatalogRoomRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const [updated] = await database
      .update(rooms)
      .set({ housekeepingStatus: command.status, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(rooms.id, id), eq(rooms.propertyId, propertyId)))
      .returning();
    if (updated === undefined) return undefined;
    if (command.status === 'CLEANING') {
      await database.execute(sql`
        WITH next_task AS (
          SELECT id
            FROM housekeeping_tasks
           WHERE property_id = ${propertyId}
             AND room_id = ${id}
             AND type = 'TURNOVER'
             AND status IN ('SCHEDULED', 'DUE')
           ORDER BY due_at ASC, id ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        UPDATE housekeeping_tasks
           SET status = 'IN_PROGRESS',
               started_at = CURRENT_TIMESTAMP,
               started_by = ${actorId},
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
         WHERE id IN (SELECT id FROM next_task)
      `);
    }
    if (command.status === 'CLEAN') {
      await database.execute(sql`
        WITH next_task AS (
          SELECT id
            FROM housekeeping_tasks
           WHERE property_id = ${propertyId}
             AND room_id = ${id}
             AND type = 'TURNOVER'
             AND status = 'IN_PROGRESS'
           ORDER BY started_at ASC NULLS LAST, due_at ASC, id ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        UPDATE housekeeping_tasks
           SET status = 'DONE',
               completed_at = CURRENT_TIMESTAMP,
               completed_by = ${actorId},
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
         WHERE id IN (SELECT id FROM next_task)
      `);
    }
    return updated;
  }
  public async assignRoomHousekeeping(
    transaction: unknown,
    propertyId: string,
    roomId: string,
    command: HousekeepingTaskAssignmentCommand,
    actorId: string,
  ): Promise<CatalogHousekeepingTaskAssignmentRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const result = await database.execute(sql`
      WITH next_task AS (
        SELECT id
          FROM housekeeping_tasks
         WHERE property_id = ${propertyId}
           AND room_id = ${roomId}
           AND type = 'TURNOVER'
           AND status IN ('SCHEDULED', 'DUE')
         ORDER BY due_at ASC, id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      UPDATE housekeeping_tasks
         SET assigned_to = ${command.assigneeId},
             assigned_by = ${actorId},
             assigned_at = CURRENT_TIMESTAMP,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
       WHERE id IN (SELECT id FROM next_task)
         AND version = ${command.expectedVersion}
         AND EXISTS (
           SELECT 1
             FROM users
            WHERE id = ${command.assigneeId}
              AND status = 'ACTIVE'
         )
      RETURNING id, room_id, assigned_to, assigned_by, assigned_at, version
    `);
    const row = result.rows[0] as
      | {
          id: string;
          room_id: string;
          assigned_to: string;
          assigned_by: string;
          assigned_at: Date | string;
          version: number;
        }
      | undefined;
    if (row === undefined) return undefined;
    return {
      id: row.id,
      roomId: row.room_id,
      assignedTo: row.assigned_to,
      assignedBy: row.assigned_by,
      assignedAt: new Date(row.assigned_at),
      version: row.version,
    };
  }
  public async verifyRoomHousekeeping(
    transaction: unknown,
    propertyId: string,
    roomId: string,
    command: HousekeepingTaskVersionCommand,
    actorId: string,
  ): Promise<CatalogHousekeepingTaskActionRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const result = await database.execute(sql`
      WITH next_task AS (
        SELECT id
          FROM housekeeping_tasks
         WHERE property_id = ${propertyId}
           AND room_id = ${roomId}
           AND type = 'TURNOVER'
           AND status = 'DONE'
           AND verified_at IS NULL
         ORDER BY completed_at DESC, id DESC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      UPDATE housekeeping_tasks
         SET verified_by = ${actorId},
             verified_at = CURRENT_TIMESTAMP,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
       WHERE id IN (SELECT id FROM next_task)
         AND version = ${command.expectedVersion}
      RETURNING id, room_id, version
    `);
    return toHousekeepingTaskAction(result.rows[0]);
  }
  public async reopenRoomHousekeeping(
    transaction: unknown,
    propertyId: string,
    roomId: string,
    command: HousekeepingTaskReopenCommand,
    actorId: string,
  ): Promise<CatalogHousekeepingTaskActionRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const result = await database.execute(sql`
      WITH next_task AS (
        SELECT id
          FROM housekeeping_tasks
         WHERE property_id = ${propertyId}
           AND room_id = ${roomId}
           AND type = 'TURNOVER'
           AND status = 'DONE'
         ORDER BY completed_at DESC, id DESC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      ), reopened_task AS (
        UPDATE housekeeping_tasks
           SET status = 'DUE',
               completed_at = NULL,
               completed_by = NULL,
               reopened_by = ${actorId},
               reopened_at = CURRENT_TIMESTAMP,
               reopen_reason = ${command.reason},
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
         WHERE id IN (SELECT id FROM next_task)
           AND version = ${command.expectedVersion}
        RETURNING id, room_id, version
      ), dirty_room AS (
        UPDATE rooms
           SET housekeeping_status = 'DIRTY', updated_at = CURRENT_TIMESTAMP
         WHERE id = ${roomId}
           AND property_id = ${propertyId}
           AND EXISTS (SELECT 1 FROM reopened_task)
      )
      SELECT id, room_id, version FROM reopened_task
    `);
    return toHousekeepingTaskAction(result.rows[0]);
  }

  public async listRooms(
    propertyId: string,
    page: number,
    pageSize: number,
    propertyCode?: string,
  ): Promise<readonly CatalogRoomRecord[]> {
    return this.database.query.rooms.findMany({
      where: (room, operators) =>
        propertyCode === 'PEACE_HOME'
          ? operators.and(
              operators.eq(room.propertyId, propertyId),
              operators.inArray(room.physicalRoomCode, APPROVED_PEACE_HOME_PHYSICAL_ROOM_CODES),
            )
          : operators.eq(room.propertyId, propertyId),
      orderBy: [asc(rooms.roomNumber), asc(rooms.id)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }
  public async findRoom(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CatalogRoomRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    return database.query.rooms.findFirst({
      where: (room, operators) =>
        operators.and(operators.eq(room.id, id), operators.eq(room.propertyId, propertyId)),
    });
  }
  public async findRoomByNumber(
    transaction: unknown,
    propertyId: string,
    roomNumber: string,
    excludeId?: string,
  ): Promise<CatalogRoomRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    return database.query.rooms.findFirst({
      where: (room, operators) =>
        operators.and(
          operators.eq(room.propertyId, propertyId),
          operators.eq(room.roomNumber, roomNumber),
          ...(excludeId !== undefined ? [operators.ne(room.id, excludeId)] : []),
        ),
    });
  }
  public async roomHasFutureOrActiveBlocks(
    transaction: unknown,
    propertyId: string,
    roomId: string,
  ): Promise<boolean> {
    const database = asCatalogDatabase(transaction, this.database);
    const now = new Date();
    const row = await database.query.roomInventoryBlocks.findFirst({
      where: (block, operators) =>
        operators.and(
          operators.eq(block.propertyId, propertyId),
          operators.eq(block.roomId, roomId),
          operators.eq(block.status, 'ACTIVE'),
          operators.gt(block.endsAt, now),
        ),
    });
    return row !== undefined;
  }
  public async summarizeRoomCommitments(
    transaction: unknown,
    propertyId: string,
    roomId: string,
  ): Promise<RoomCommitmentSummary> {
    const database = asCatalogDatabase(transaction, this.database);
    const now = new Date();
    const active = await database.query.bookings.findMany({
      columns: { id: true, status: true, checkIn: true, checkOut: true },
      where: (booking, operators) =>
        operators.and(
          operators.eq(booking.propertyId, propertyId),
          operators.eq(booking.roomId, roomId),
          operators.inArray(booking.status, ['HOLD', 'CONFIRMED', 'CHECKED_IN']),
        ),
    });
    let activeBookingCount = 0;
    let futureBookingCount = 0;
    for (const booking of active) {
      if (booking.status === 'CHECKED_IN' || booking.checkIn <= now) {
        activeBookingCount += 1;
      } else if (booking.checkIn > now) {
        futureBookingCount += 1;
      }
    }
    const maintenanceRows = await database.query.maintenanceBlocks.findMany({
      columns: { id: true, status: true, startsAt: true, endsAt: true },
      where: (block, operators) =>
        operators.and(
          operators.eq(block.propertyId, propertyId),
          operators.eq(block.roomId, roomId),
          operators.eq(block.status, 'ACTIVE'),
        ),
    });
    let activeMaintenanceCount = 0;
    let futureMaintenanceCount = 0;
    for (const block of maintenanceRows) {
      if (block.endsAt <= now) continue;
      if (block.startsAt <= now) {
        activeMaintenanceCount += 1;
      } else {
        futureMaintenanceCount += 1;
      }
    }
    const inventoryBlocks = await database.query.roomInventoryBlocks.findMany({
      columns: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        bookingId: true,
        maintenanceBlockId: true,
      },
      where: (block, operators) =>
        operators.and(
          operators.eq(block.propertyId, propertyId),
          operators.eq(block.roomId, roomId),
          operators.eq(block.status, 'ACTIVE'),
        ),
    });
    let activeInventoryBlockCount = 0;
    let futureInventoryBlockCount = 0;
    for (const block of inventoryBlocks) {
      if (block.endsAt <= now) continue;
      if (block.startsAt <= now) {
        activeInventoryBlockCount += 1;
      } else {
        futureInventoryBlockCount += 1;
      }
    }
    return {
      activeBookingCount,
      futureBookingCount,
      activeMaintenanceCount,
      futureMaintenanceCount,
      activeInventoryBlockCount,
      futureInventoryBlockCount,
    };
  }
  public async summarizeRoomTypeDependencies(
    transaction: unknown,
    propertyId: string,
    roomTypeId: string,
  ): Promise<RoomTypeDependencySummary> {
    const database = asCatalogDatabase(transaction, this.database);
    const activeRoomRow = await database
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(rooms)
      .where(
        and(
          eq(rooms.propertyId, propertyId),
          eq(rooms.roomTypeId, roomTypeId),
          eq(rooms.status, 'ACTIVE'),
        ),
      );
    const activeRoomCount = Number(activeRoomRow[0]?.count ?? 0);
    const now = new Date();
    const futureBookingRows = await database.query.bookings.findMany({
      columns: { id: true, checkIn: true },
      where: (booking, operators) =>
        operators.and(
          operators.eq(booking.propertyId, propertyId),
          operators.eq(booking.roomTypeId, roomTypeId),
          operators.inArray(booking.status, ['HOLD', 'CONFIRMED', 'CHECKED_IN']),
          operators.gt(booking.checkIn, now),
        ),
    });
    const futureBookingCount = futureBookingRows.length;
    const activeMaintenanceRows = await database
      .select({
        id: maintenanceBlocks.id,
        startsAt: maintenanceBlocks.startsAt,
        endsAt: maintenanceBlocks.endsAt,
        roomTypeId: rooms.roomTypeId,
      })
      .from(maintenanceBlocks)
      .innerJoin(rooms, eq(rooms.id, maintenanceBlocks.roomId))
      .where(
        and(
          eq(maintenanceBlocks.propertyId, propertyId),
          eq(maintenanceBlocks.status, 'ACTIVE'),
          eq(rooms.roomTypeId, roomTypeId),
        ),
      );
    let activeMaintenanceCount = 0;
    let futureMaintenanceCount = 0;
    for (const block of activeMaintenanceRows) {
      if (block.endsAt <= now) continue;
      if (block.startsAt <= now) {
        activeMaintenanceCount += 1;
      } else {
        futureMaintenanceCount += 1;
      }
    }
    const roomTypeRow = await database.query.roomTypes.findFirst({
      columns: { priceTierId: true },
      where: (roomType, operators) =>
        operators.and(
          operators.eq(roomType.id, roomTypeId),
          operators.eq(roomType.propertyId, propertyId),
        ),
    });
    let activeRatePlanCount = 0;
    if (roomTypeRow !== undefined) {
      const ratePlanPriceRows = await database
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(ratePlanPrices)
        .innerJoin(ratePlans, eq(ratePlanPrices.ratePlanId, ratePlans.id))
        .where(
          and(
            eq(ratePlanPrices.propertyId, propertyId),
            eq(ratePlanPrices.priceTierId, roomTypeRow.priceTierId),
            eq(ratePlans.status, 'ACTIVE'),
          ),
        );
      activeRatePlanCount = Number(ratePlanPriceRows[0]?.count ?? 0);
    }
    return {
      activeRoomCount,
      futureBookingCount,
      activeMaintenanceCount,
      futureMaintenanceCount,
      activeRatePlanCount,
    };
  }
  public async updateRoom(
    transaction: unknown,
    propertyId: string,
    id: string,
    command: RoomPatch,
  ): Promise<CatalogRoomRecord | undefined> {
    const database = asCatalogDatabase(transaction, this.database);
    const patch: Partial<typeof rooms.$inferInsert> = { updatedAt: new Date() };
    if (command.roomNumber !== undefined) patch.roomNumber = command.roomNumber;
    if (command.roomTypeId !== undefined) patch.roomTypeId = command.roomTypeId;
    const [updated] = await database
      .update(rooms)
      .set(patch)
      .where(and(eq(rooms.id, id), eq(rooms.propertyId, propertyId)))
      .returning();
    return updated;
  }
  public async createMaintenance(
    transaction: unknown,
    propertyId: string,
    command: MaintenanceBlockCommand,
  ): Promise<CatalogMaintenanceRecord> {
    const database = asCatalogDatabase(transaction, this.database);
    const [block] = await database
      .insert(maintenanceBlocks)
      .values({
        propertyId,
        roomId: command.roomId,
        startsAt: new Date(command.startsAt),
        endsAt: new Date(command.endsAt),
        reason: command.reason,
      })
      .returning();
    if (block === undefined) throw new Error('Maintenance creation did not return a row.');
    await database.insert(roomInventoryBlocks).values({
      propertyId,
      roomId: command.roomId,
      maintenanceBlockId: block.id,
      blockType: 'MAINTENANCE',
      startsAt: block.startsAt,
      endsAt: block.endsAt,
    });
    return block;
  }
  public async listMaintenanceBlocks(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<readonly CatalogMaintenanceRecord[]> {
    return this.database.query.maintenanceBlocks.findMany({
      where: (block, operators) => operators.eq(block.propertyId, propertyId),
      orderBy: [asc(maintenanceBlocks.startsAt), asc(maintenanceBlocks.id)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }
  public async cancelMaintenance(
    transaction: unknown,
    propertyId: string,
    id: string,
  ): Promise<CancelMaintenanceResult> {
    const database = asCatalogDatabase(transaction, this.database);
    const now = new Date();
    const [block] = await database
      .update(maintenanceBlocks)
      .set({ status: 'CANCELLED', cancelledAt: now, updatedAt: now })
      .where(
        and(
          eq(maintenanceBlocks.id, id),
          eq(maintenanceBlocks.propertyId, propertyId),
          eq(maintenanceBlocks.status, 'ACTIVE'),
        ),
      )
      .returning();
    if (block === undefined) {
      const current = await database.query.maintenanceBlocks.findFirst({
        where: (maintenance, operators) =>
          operators.and(
            operators.eq(maintenance.id, id),
            operators.eq(maintenance.propertyId, propertyId),
          ),
      });
      return { block: current, cancelled: false };
    }
    await database
      .update(roomInventoryBlocks)
      .set({ status: 'RELEASED', releasedAt: now })
      .where(
        and(
          eq(roomInventoryBlocks.maintenanceBlockId, id),
          eq(roomInventoryBlocks.status, 'ACTIVE'),
        ),
      );
    return { block, cancelled: true };
  }
}
