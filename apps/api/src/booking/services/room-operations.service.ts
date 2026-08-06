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

export interface RoomOperationInterval {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export interface RoomOperationHousekeepingTask {
  readonly type: 'ARRIVAL_PREP' | 'TURNOVER';
  readonly status: 'SCHEDULED' | 'DUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  readonly dueAt: Date;
}

export interface RoomOperationRow {
  roomId: string;
  roomNumber: string;
  physicalRoomCode: string;
  roomTier: string;
  floor: string | null;
  roomConcept: string;
  roomStatus: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  housekeepingStatus: 'CLEAN' | 'DIRTY' | 'CLEANING';
  maintenanceState: 'ACTIVE' | 'NONE';
  bookings: readonly RoomOperationBookingRow[];
  blockedIntervals: readonly RoomOperationInterval[];
  activeHousekeepingTask: RoomOperationHousekeepingTask | null;
}

export interface RoomOperationsRepositoryPort {
  list(
    propertyId: string,
    query: AdminRoomOperationsQuery,
    propertyCode?: string,
  ): Promise<readonly RoomOperationRow[]>;
}

export class RoomOperationsService {
  public constructor(private readonly repository: RoomOperationsRepositoryPort) {}

  public async list(
    propertyId: string,
    query: unknown,
    now = new Date(),
    propertyCode?: string,
  ): Promise<AdminRoomOperationsResponse> {
    const parsed = adminRoomOperationsQuerySchema.parse(query);
    const items = await this.repository.list(propertyId, parsed, propertyCode);
    return adminRoomOperationsResponseSchema.parse({
      items: items.map(({ blockedIntervals, activeHousekeepingTask, ...room }) => {
        const bookings = room.bookings.map((booking) => ({
          ...booking,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
        }));
        const currentTime = now.getTime();
        const currentOccupancy = room.bookings.some(
          (booking) =>
            booking.checkIn.getTime() <= currentTime && booking.checkOut.getTime() > currentTime,
        )
          ? 'OCCUPIED'
          : 'VACANT';
        const nextBooking = room.bookings.find(
          (booking) => booking.checkIn.getTime() > currentTime,
        );
        return {
          ...room,
          currentOccupancy,
          nextBookingWindow:
            nextBooking === undefined
              ? null
              : {
                  checkIn: nextBooking.checkIn.toISOString(),
                  checkOut: nextBooking.checkOut.toISOString(),
                },
          bookings,
          freeWindows: computeFreeWindows(
            new Date(parsed.from),
            new Date(parsed.to),
            blockedIntervals,
          ).map((window) => ({
            startsAt: window.startsAt.toISOString(),
            endsAt: window.endsAt.toISOString(),
          })),
          activeHousekeepingTask:
            activeHousekeepingTask === null
              ? null
              : {
                  ...activeHousekeepingTask,
                  dueAt: activeHousekeepingTask.dueAt.toISOString(),
                },
        };
      }),
      generatedAt: now.toISOString(),
    });
  }
}

export function computeFreeWindows(
  rangeStart: Date,
  rangeEnd: Date,
  blockedIntervals: readonly RoomOperationInterval[],
): readonly RoomOperationInterval[] {
  const clamped = blockedIntervals
    .map((interval) => ({
      startsAt: new Date(Math.max(interval.startsAt.getTime(), rangeStart.getTime())),
      endsAt: new Date(Math.min(interval.endsAt.getTime(), rangeEnd.getTime())),
    }))
    .filter((interval) => interval.startsAt.getTime() < interval.endsAt.getTime())
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  const merged: RoomOperationInterval[] = [];
  for (const interval of clamped) {
    const previous = merged.at(-1);
    if (previous === undefined || interval.startsAt.getTime() > previous.endsAt.getTime()) {
      merged.push(interval);
      continue;
    }
    if (interval.endsAt.getTime() > previous.endsAt.getTime()) {
      merged[merged.length - 1] = { startsAt: previous.startsAt, endsAt: interval.endsAt };
    }
  }
  const windows: RoomOperationInterval[] = [];
  let cursor = rangeStart;
  for (const interval of merged) {
    if (cursor.getTime() < interval.startsAt.getTime()) {
      windows.push({ startsAt: cursor, endsAt: interval.startsAt });
    }
    cursor = interval.endsAt;
  }
  if (cursor.getTime() < rangeEnd.getTime()) {
    windows.push({ startsAt: cursor, endsAt: rangeEnd });
  }
  return windows;
}
