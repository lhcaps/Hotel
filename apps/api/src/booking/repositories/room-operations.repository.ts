import type { DatabasePool } from '@room/database';
import type { AdminRoomOperationsQuery } from '@room/contracts';

import type { RoomOperationRow, RoomOperationsRepositoryPort } from '../services/room-operations.service.js';

interface DbRow {
  room_id: string;
  room_number: string;
  room_status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  housekeeping_status: 'CLEAN' | 'DIRTY' | 'CLEANING';
  maintenance_state: 'ACTIVE' | 'NONE';
  bookings: unknown;
}

export class RoomOperationsRepository implements RoomOperationsRepositoryPort {
  public constructor(private readonly pool: Pick<DatabasePool, 'query'>) {}

  public async list(propertyId: string, query: AdminRoomOperationsQuery): Promise<readonly RoomOperationRow[]> {
    const result = await this.pool.query<DbRow>(
      `SELECT r.id AS room_id, r.room_number, r.status AS room_status,
              r.housekeeping_status,
              CASE WHEN EXISTS (
                SELECT 1 FROM maintenance_blocks mb
                 WHERE mb.room_id = r.id AND mb.status = 'ACTIVE'
                   AND mb.starts_at < $3 AND mb.ends_at > $2
              ) THEN 'ACTIVE' ELSE 'NONE' END AS maintenance_state,
              COALESCE(jsonb_agg(jsonb_build_object(
                'bookingCode', b.booking_code, 'status', b.status,
                'checkIn', b.check_in, 'checkOut', b.check_out
              ) ORDER BY b.check_in) FILTER (WHERE b.id IS NOT NULL), '[]'::jsonb) AS bookings
         FROM rooms r
         LEFT JOIN bookings b ON b.room_id = r.id AND b.property_id = r.property_id
          AND b.check_in < $3 AND b.check_out > $2
          AND b.status NOT IN ('CANCELLED', 'EXPIRED')
        WHERE r.property_id = $1
        GROUP BY r.id
        ORDER BY r.room_number ASC`,
      [propertyId, new Date(query.from), new Date(query.to)],
    );
    return result.rows.map((row) => ({
      roomId: row.room_id,
      roomNumber: row.room_number,
      roomStatus: row.room_status,
      housekeepingStatus: row.housekeeping_status,
      maintenanceState: row.maintenance_state,
      bookings: (row.bookings as Array<{ bookingCode: string; status: RoomOperationRow['bookings'][number]['status']; checkIn: string; checkOut: string }>).map((booking) => ({
        ...booking,
        checkIn: new Date(booking.checkIn),
        checkOut: new Date(booking.checkOut),
      })),
    }));
  }
}
