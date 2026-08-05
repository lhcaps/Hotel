import type { DatabasePool } from '@room/database';
import type { AdminRoomOperationsQuery } from '@room/contracts';

import type {
  RoomOperationRow,
  RoomOperationsRepositoryPort,
} from '../services/room-operations.service.js';

interface DbRow {
  room_id: string;
  room_number: string;
  physical_room_code: string;
  room_tier: string;
  floor: string | null;
  room_concept: string;
  room_status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  housekeeping_status: 'CLEAN' | 'DIRTY' | 'CLEANING';
  maintenance_state: 'ACTIVE' | 'NONE';
  bookings: unknown;
  blocked_intervals: unknown;
  active_housekeeping_task: unknown;
}

export class RoomOperationsRepository implements RoomOperationsRepositoryPort {
  public constructor(private readonly pool: Pick<DatabasePool, 'query'>) {}

  public async list(
    propertyId: string,
    query: AdminRoomOperationsQuery,
  ): Promise<readonly RoomOperationRow[]> {
    const result = await this.pool.query<DbRow>(
      `SELECT r.id AS room_id, r.room_number, r.physical_room_code,
              COALESCE(pt.name, pt.code, 'Chưa phân hạng') AS room_tier,
              CASE
                WHEN upper(r.room_number) LIKE 'G%' THEN 'G'
                WHEN r.room_number ~ '^[0-9]{3,}$' THEN left(r.room_number, length(r.room_number) - 2)
                ELSE NULL
              END AS floor,
              COALESCE(rt.name, rt.code, r.room_number) AS room_concept,
              r.status AS room_status,
              r.housekeeping_status,
              CASE WHEN EXISTS (
                SELECT 1 FROM maintenance_blocks mb
                 WHERE mb.room_id = r.id AND mb.status = 'ACTIVE'
                   AND mb.starts_at < $3 AND mb.ends_at > $2
              ) THEN 'ACTIVE' ELSE 'NONE' END AS maintenance_state,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('startsAt', span.starts_at, 'endsAt', span.ends_at))
                  FROM (
                    SELECT ib.starts_at, ib.ends_at
                      FROM room_inventory_blocks ib
                     WHERE ib.property_id = r.property_id AND ib.room_id = r.id
                       AND ib.status = 'ACTIVE' AND ib.starts_at < $3 AND ib.ends_at > $2
                    UNION ALL
                    SELECT b2.check_in, b2.check_out
                      FROM bookings b2
                     WHERE b2.property_id = r.property_id AND b2.room_id = r.id
                       AND b2.status IN ('HOLD', 'CONFIRMED', 'CHECKED_IN')
                       AND b2.check_in < $3 AND b2.check_out > $2
                    UNION ALL
                    SELECT mb2.starts_at, mb2.ends_at
                      FROM maintenance_blocks mb2
                     WHERE mb2.property_id = r.property_id AND mb2.room_id = r.id
                       AND mb2.status = 'ACTIVE' AND mb2.starts_at < $3 AND mb2.ends_at > $2
                  ) span
              ), '[]'::jsonb) AS blocked_intervals,
              (
                SELECT jsonb_build_object('type', ht.type, 'status', ht.status, 'dueAt', ht.due_at)
                  FROM housekeeping_tasks ht
                 WHERE ht.property_id = r.property_id AND ht.room_id = r.id
                   AND ht.status IN ('SCHEDULED', 'DUE', 'IN_PROGRESS')
                 ORDER BY ht.due_at ASC, ht.id ASC
                 LIMIT 1
              ) AS active_housekeeping_task,
              COALESCE(jsonb_agg(jsonb_build_object(
                'bookingCode', b.booking_code, 'status', b.status,
                'checkIn', b.check_in, 'checkOut', b.check_out
              ) ORDER BY b.check_in) FILTER (WHERE b.id IS NOT NULL), '[]'::jsonb) AS bookings
         FROM rooms r
         JOIN room_types rt ON rt.id = r.room_type_id
         JOIN price_tiers pt ON pt.id = rt.price_tier_id
         LEFT JOIN bookings b ON b.room_id = r.id AND b.property_id = r.property_id
          AND b.check_in < $3 AND b.check_out > $2
          AND b.status NOT IN ('CANCELLED', 'EXPIRED')
        WHERE r.property_id = $1
          AND (r.status = 'ACTIVE' OR $4::boolean = TRUE)
        GROUP BY r.id, rt.name, rt.code, pt.name, pt.code
        ORDER BY r.room_number ASC`,
      [propertyId, new Date(query.from), new Date(query.to), query.includeInactive],
    );
    return result.rows.map((row) => ({
      roomId: row.room_id,
      roomNumber: row.room_number,
      physicalRoomCode: row.physical_room_code,
      roomTier: row.room_tier,
      floor: row.floor,
      roomConcept: row.room_concept,
      roomStatus: row.room_status,
      housekeepingStatus: row.housekeeping_status,
      maintenanceState: row.maintenance_state,
      bookings: (
        row.bookings as Array<{
          bookingCode: string;
          status: RoomOperationRow['bookings'][number]['status'];
          checkIn: string;
          checkOut: string;
        }>
      ).map((booking) => ({
        ...booking,
        checkIn: new Date(booking.checkIn),
        checkOut: new Date(booking.checkOut),
      })),
      blockedIntervals: (row.blocked_intervals as Array<{ startsAt: string; endsAt: string }>).map(
        (interval) => ({
          startsAt: new Date(interval.startsAt),
          endsAt: new Date(interval.endsAt),
        }),
      ),
      activeHousekeepingTask:
        row.active_housekeeping_task === null
          ? null
          : (() => {
              const task = row.active_housekeeping_task as {
                type: 'ARRIVAL_PREP' | 'TURNOVER';
                status: 'SCHEDULED' | 'DUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
                dueAt: string;
              };
              return { type: task.type, status: task.status, dueAt: new Date(task.dueAt) };
            })(),
    }));
  }
}
