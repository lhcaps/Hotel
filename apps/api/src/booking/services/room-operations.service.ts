import {
  adminRoomOperationsQuerySchema,
  adminRoomOperationsResponseSchema,
  type AdminRoomOperationsQuery,
  type AdminRoomOperationsResponse,
} from '@room/contracts';

export interface RoomOperationBookingRow {
  bookingCode: string;
  status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_IN' | 'CHECKED_OUT';
  checkIn: Date;
  checkOut: Date;
}

export interface RoomOperationRow {
  roomId: string;
  roomNumber: string;
  roomStatus: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  housekeepingStatus: 'CLEAN' | 'DIRTY' | 'CLEANING';
  maintenanceState: 'ACTIVE' | 'NONE';
  bookings: readonly RoomOperationBookingRow[];
}

export interface RoomOperationsRepositoryPort {
  list(propertyId: string, query: AdminRoomOperationsQuery): Promise<readonly RoomOperationRow[]>;
}

export class RoomOperationsService {
  public constructor(private readonly repository: RoomOperationsRepositoryPort) {}

  public async list(
    propertyId: string,
    query: unknown,
    now = new Date(),
  ): Promise<AdminRoomOperationsResponse> {
    const parsed = adminRoomOperationsQuerySchema.parse(query);
    const items = await this.repository.list(propertyId, parsed);
    return adminRoomOperationsResponseSchema.parse({
      items: items.map((room) => ({
        ...room,
        bookings: room.bookings.map((booking) => ({
          ...booking,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
        })),
      })),
      generatedAt: now.toISOString(),
    });
  }
}
