import {
  auditEvents,
  bookings,
  bookingCouponApplications,
  rooms,
  roomInventoryBlocks,
  sql,
  type DatabaseClient,
} from '@room/database';

export interface AvailabilityProbe {
  readonly roomTypeId: string;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly propertyId: string;
}

export interface RoomCandidate {
  readonly id: string;
  readonly roomNumber: string;
}

type DbTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

type QueryPool = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ readonly rows: readonly T[] }>;
};

function uuidList(values: readonly string[]) {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );
}

export async function findStructurallyEligibleRooms(
  db: DatabaseClient,
  probe: AvailabilityProbe,
  tx?: DbTransaction,
): Promise<readonly RoomCandidate[]> {
  const executor = tx ?? db;
  return executor
    .select({ id: rooms.id, roomNumber: rooms.roomNumber })
    .from(rooms)
    .where(
      sql`${rooms.propertyId} = ${probe.propertyId}
        AND ${rooms.roomTypeId} = ${probe.roomTypeId}
        AND ${rooms.status} = 'ACTIVE'`,
    )
    .orderBy(sql`${rooms.roomNumber} ASC`);
}

export async function findAllocatableRooms(
  db: DatabaseClient,
  probe: AvailabilityProbe,
  limit: number,
  tx?: DbTransaction,
): Promise<readonly RoomCandidate[]> {
  const executor = tx ?? db;

  return executor
    .select({ id: rooms.id, roomNumber: rooms.roomNumber })
    .from(rooms)
    .where(
      sql`${rooms.propertyId} = ${probe.propertyId}
        AND ${rooms.roomTypeId} = ${probe.roomTypeId}
        AND ${rooms.status} = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM room_inventory_blocks rib
          WHERE rib.property_id = ${probe.propertyId}
            AND rib.room_id = ${rooms.id}
            AND rib.status = 'ACTIVE'
            AND tstzrange(rib.starts_at, rib.ends_at, '[)') && tstzrange(${probe.checkIn}, ${probe.checkOut}, '[)')
        )
        AND NOT EXISTS (
          SELECT 1 FROM maintenance_blocks mb
          WHERE mb.property_id = ${probe.propertyId}
            AND mb.room_id = ${rooms.id}
            AND mb.status = 'ACTIVE'
            AND tstzrange(mb.starts_at, mb.ends_at, '[)') && tstzrange(${probe.checkIn}, ${probe.checkOut}, '[)')
        )`,
    )
    .orderBy(sql`${rooms.roomNumber} ASC`)
    .limit(limit)
    .for('update', { skipLocked: true });
}

export async function countStructurallyEligibleRooms(
  pool: QueryPool,
  probe: AvailabilityProbe,
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM rooms
      WHERE property_id = $1 AND room_type_id = $2 AND status = 'ACTIVE'`,
    [probe.propertyId, probe.roomTypeId],
  );
  return Number(result.rows[0]?.count ?? '0');
}

export async function countFreeRooms(pool: QueryPool, probe: AvailabilityProbe): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM rooms r
      WHERE r.property_id = $1
        AND r.room_type_id = $2
        AND r.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM room_inventory_blocks rib
           WHERE rib.property_id = r.property_id AND rib.room_id = r.id
             AND rib.status = 'ACTIVE'
             AND tstzrange(rib.starts_at, rib.ends_at, '[)') && tstzrange($3, $4, '[)')
        )
        AND NOT EXISTS (
          SELECT 1 FROM maintenance_blocks mb
           WHERE mb.property_id = r.property_id AND mb.room_id = r.id
             AND mb.status = 'ACTIVE'
             AND tstzrange(mb.starts_at, mb.ends_at, '[)') && tstzrange($3, $4, '[)')
        )`,
    [probe.propertyId, probe.roomTypeId, probe.checkIn, probe.checkOut],
  );
  return Number(result.rows[0]?.count ?? '0');
}

export interface StaleCleanupOptions {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly candidateRoomIds: readonly string[];
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly batchSize: number;
  readonly maxBatches: number;
}

export interface StaleCleanupResult {
  readonly removedBookings: number;
  readonly exhaustedSafetyBound: boolean;
}

async function findRemainingTargetedStaleHold(
  tx: DbTransaction,
  options: StaleCleanupOptions,
): Promise<boolean> {
  const remaining = await tx.execute<{ id: string }>(sql`
    SELECT b.id
      FROM bookings b
      JOIN room_inventory_blocks rib ON rib.booking_id = b.id
     WHERE b.status = 'HOLD'
       AND b.hold_expires_at <= CURRENT_TIMESTAMP
       AND b.property_id = ${options.propertyId}
       AND b.room_type_id = ${options.roomTypeId}
       AND rib.room_id IN (${uuidList(options.candidateRoomIds)})
       AND tstzrange(rib.starts_at, rib.ends_at, '[)') && tstzrange(${options.checkIn}, ${options.checkOut}, '[)')
       AND rib.status = 'ACTIVE'
     LIMIT 1
  `);
  return remaining.rows.length > 0;
}

export async function cleanupStaleHolds(
  _db: DatabaseClient,
  options: StaleCleanupOptions,
  tx: DbTransaction,
): Promise<StaleCleanupResult> {
  if (options.candidateRoomIds.length === 0) {
    return { removedBookings: 0, exhaustedSafetyBound: false };
  }

  let totalRemoved = 0;
  for (let batchIndex = 0; batchIndex < options.maxBatches; batchIndex += 1) {
    const staleRows = await tx.execute<{ id: string }>(sql`
      SELECT b.id
        FROM bookings b
        JOIN room_inventory_blocks rib ON rib.booking_id = b.id
       WHERE b.status = 'HOLD'
         AND b.hold_expires_at <= CURRENT_TIMESTAMP
         AND b.property_id = ${options.propertyId}
         AND b.room_type_id = ${options.roomTypeId}
         AND rib.room_id IN (${uuidList(options.candidateRoomIds)})
         AND tstzrange(rib.starts_at, rib.ends_at, '[)') && tstzrange(${options.checkIn}, ${options.checkOut}, '[)')
         AND rib.status = 'ACTIVE'
       ORDER BY b.hold_expires_at ASC, b.id ASC
       LIMIT ${options.batchSize}
       FOR UPDATE OF b SKIP LOCKED
    `);

    if (staleRows.rows.length === 0) {
      return {
        removedBookings: totalRemoved,
        exhaustedSafetyBound: await findRemainingTargetedStaleHold(tx, options),
      };
    }

    const staleIds = staleRows.rows.map((row) => row.id);
    await tx
      .update(bookings)
      .set({
        status: 'EXPIRED',
        expiredAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(sql`${bookings.id} IN (${uuidList(staleIds)})`);
    await tx
      .update(roomInventoryBlocks)
      .set({ status: 'RELEASED', releasedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        sql`${roomInventoryBlocks.bookingId} IN (${uuidList(staleIds)}) AND ${roomInventoryBlocks.status} = 'ACTIVE'`,
      );

    // Release RESERVED/ASSOCIATED coupon applications belonging to these
    // transitioned stale bookings in the same transaction. This is the
    // critical step that frees quota before the new HOLD counts it.
    const releasedApplications = await tx
      .update(bookingCouponApplications)
      .set({
        applicationStatus: 'RELEASED',
        quotaReserved: false,
        releasedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        sql`${bookingCouponApplications.bookingId} IN (${uuidList(staleIds)}) AND ${bookingCouponApplications.applicationStatus} IN ('RESERVED','ASSOCIATED')`,
      )
      .returning({
        id: bookingCouponApplications.id,
        bookingId: bookingCouponApplications.bookingId,
        propertyId: bookingCouponApplications.propertyId,
        couponId: bookingCouponApplications.couponId,
        discountType: bookingCouponApplications.discountType,
        discountAmountVnd: bookingCouponApplications.discountAmountVnd,
        finalAmountVnd: bookingCouponApplications.finalAmountVnd,
      });

    if (releasedApplications.length > 0) {
      await tx.insert(auditEvents).values(
        releasedApplications.map((row) => ({
          propertyId: row.propertyId,
          aggregateType: 'BOOKING_COUPON_APPLICATION',
          aggregateId: row.bookingId,
          eventType: 'COUPON_RELEASED',
          actorType: 'SYSTEM' as const,
          actorId: null,
          payload: {
            reason: 'STALE_HOLD_CLEANUP',
            couponId: row.couponId,
            discountType: row.discountType,
            discountAmountVnd: row.discountAmountVnd.toString(),
            finalAmountVnd: row.finalAmountVnd.toString(),
          },
          correlationId: null,
        })),
      );
    }

    totalRemoved += staleIds.length;
    if (staleIds.length < options.batchSize) {
      return {
        removedBookings: totalRemoved,
        exhaustedSafetyBound: await findRemainingTargetedStaleHold(tx, options),
      };
    }
  }

  return {
    removedBookings: totalRemoved,
    exhaustedSafetyBound: await findRemainingTargetedStaleHold(tx, options),
  };
}
