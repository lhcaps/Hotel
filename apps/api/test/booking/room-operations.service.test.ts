import { describe, expect, it, vi } from 'vitest';

import {
  RoomOperationsService,
  computeFreeWindows,
  deriveRoomDisplayGroup,
} from '../../src/booking/services/room-operations.service.js';

const NOW = new Date('2026-08-01T10:00:00.000Z');
const nowMs = NOW.getTime();

function booking(checkIn: string, checkOut: string) {
  return {
    bookingCode: 'BK',
    status: 'CONFIRMED' as const,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
  };
}

function baseRoom() {
  return {
    roomStatus: 'ACTIVE' as const,
    maintenanceState: 'NONE' as const,
    housekeepingStatus: 'CLEAN' as const,
    currentOccupancy: 'VACANT' as const,
    nextBookingCheckIn: null as Date | null,
    activeHousekeepingTask: null,
    bookings: [] as ReturnType<typeof booking>[],
  };
}

describe('deriveRoomDisplayGroup (ORIG-C-005)', () => {
  it('returns inactive when roomStatus is INACTIVE regardless of other axes', () => {
    expect(deriveRoomDisplayGroup({ ...baseRoom(), roomStatus: 'INACTIVE' }, NOW)).toBe('inactive');
  });

  it('returns maintenance when roomStatus is MAINTENANCE', () => {
    expect(deriveRoomDisplayGroup({ ...baseRoom(), roomStatus: 'MAINTENANCE' }, NOW)).toBe(
      'maintenance',
    );
  });

  it('returns maintenance when maintenanceState is ACTIVE even if roomStatus is ACTIVE', () => {
    expect(deriveRoomDisplayGroup({ ...baseRoom(), maintenanceState: 'ACTIVE' }, NOW)).toBe(
      'maintenance',
    );
  });

  it('returns checkout when occupied and checkout is within next 24h', () => {
    const checkOut = new Date(nowMs + 2 * 60 * 60 * 1000); // +2h
    const room = {
      ...baseRoom(),
      currentOccupancy: 'OCCUPIED' as const,
      bookings: [
        booking(new Date(nowMs - 3 * 60 * 60 * 1000).toISOString(), checkOut.toISOString()),
      ],
    };
    expect(deriveRoomDisplayGroup(room, NOW)).toBe('checkout');
  });

  it('returns occupied when occupied and checkout is beyond next 24h', () => {
    const room = {
      ...baseRoom(),
      currentOccupancy: 'OCCUPIED' as const,
      bookings: [
        booking(
          new Date(nowMs - 1 * 60 * 60 * 1000).toISOString(),
          new Date(nowMs + 25 * 60 * 60 * 1000).toISOString(),
        ),
      ],
    };
    expect(deriveRoomDisplayGroup(room, NOW)).toBe('occupied');
  });

  it('returns arrival when vacant and next booking check-in is within next 24h', () => {
    const room = {
      ...baseRoom(),
      nextBookingCheckIn: new Date(nowMs + 4 * 60 * 60 * 1000),
    };
    expect(deriveRoomDisplayGroup(room, NOW)).toBe('arrival');
  });

  it('returns needs_cleaning when housekeepingStatus is DIRTY', () => {
    expect(deriveRoomDisplayGroup({ ...baseRoom(), housekeepingStatus: 'DIRTY' }, NOW)).toBe(
      'needs_cleaning',
    );
  });

  it('keeps a clean room ready when an ARRIVAL_PREP task is active', () => {
    const room = {
      ...baseRoom(),
      activeHousekeepingTask: {
        taskId: '10000000-0000-4000-8000-000000000201',
        type: 'ARRIVAL_PREP' as const,
        status: 'IN_PROGRESS' as const,
        dueAt: NOW,
        assigneeId: '10000000-0000-4000-8000-000000000202',
        version: 2,
        verifiedAt: null,
      },
    };
    expect(deriveRoomDisplayGroup(room, NOW)).toBe('ready');
  });

  it('returns cleaning only for CLEANING housekeeping state', () => {
    expect(deriveRoomDisplayGroup({ ...baseRoom(), housekeepingStatus: 'CLEANING' }, NOW)).toBe(
      'cleaning',
    );
  });

  it('returns ready when clean, vacant, no upcoming booking, no active task', () => {
    expect(deriveRoomDisplayGroup(baseRoom(), NOW)).toBe('ready');
  });
});

describe('RoomOperationsService currentOccupancy derivation', () => {
  it('treats an early-checked-out booking as vacant even while its scheduled window has not elapsed', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue([
        {
          roomId: '10000000-0000-4000-8000-000000000101',
          roomNumber: '101',
          roomConcept: 'Deluxe King',
          physicalRoomCode: 'ROOM-101',
          roomTier: 'Standard',
          floor: '1',
          roomStatus: 'ACTIVE',
          housekeepingStatus: 'CLEAN',
          maintenanceState: 'NONE',
          blockedIntervals: [],
          activeHousekeepingTask: null,
          bookings: [
            {
              bookingCode: 'BK-101',
              status: 'CHECKED_OUT',
              checkIn: new Date(nowMs - 60 * 60 * 1000),
              checkOut: new Date(nowMs + 5 * 60 * 60 * 1000),
            },
          ],
        },
      ]),
    };
    const service = new RoomOperationsService(repository);

    await expect(
      service.list(
        'property-1',
        { from: '2026-08-01T00:00:00.000Z', to: '2026-08-01T23:59:59.999Z' },
        NOW,
      ),
    ).resolves.toMatchObject({
      items: [
        {
          currentOccupancy: 'VACANT',
          displayGroup: 'ready',
        },
      ],
    });
  });
});

describe('computeFreeWindows', () => {
  it('clamps, merges adjacent occupied intervals, and returns the exact free complement', () => {
    expect(
      computeFreeWindows(
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-01T12:00:00.000Z'),
        [
          {
            startsAt: new Date('2026-07-31T23:00:00.000Z'),
            endsAt: new Date('2026-08-01T02:00:00.000Z'),
          },
          {
            startsAt: new Date('2026-08-01T03:00:00.000Z'),
            endsAt: new Date('2026-08-01T05:00:00.000Z'),
          },
          {
            startsAt: new Date('2026-08-01T05:00:00.000Z'),
            endsAt: new Date('2026-08-01T06:00:00.000Z'),
          },
          {
            startsAt: new Date('2026-08-01T10:00:00.000Z'),
            endsAt: new Date('2026-08-01T13:00:00.000Z'),
          },
        ],
      ).map((window) => [window.startsAt.toISOString(), window.endsAt.toISOString()]),
    ).toEqual([
      ['2026-08-01T02:00:00.000Z', '2026-08-01T03:00:00.000Z'],
      ['2026-08-01T06:00:00.000Z', '2026-08-01T10:00:00.000Z'],
    ]);
  });
});

describe('RoomOperationsService', () => {
  it('returns the property-scoped rows supplied by the authoritative repository', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue([
        {
          roomId: '10000000-0000-4000-8000-000000000101',
          roomNumber: '101',
          roomConcept: 'Deluxe King',
          physicalRoomCode: 'ROOM-101',
          roomTier: 'Standard',
          floor: '1',
          roomStatus: 'ACTIVE',
          housekeepingStatus: 'DIRTY',
          maintenanceState: 'NONE',
          blockedIntervals: [],
          activeHousekeepingTask: null,
          bookings: [
            {
              bookingCode: 'BK-101',
              status: 'CONFIRMED',
              checkIn: new Date('2026-07-29T11:00:00.000Z'),
              checkOut: new Date('2026-07-29T14:00:00.000Z'),
            },
          ],
        },
      ]),
    };
    const service = new RoomOperationsService(repository);

    await expect(
      service.list('property-1', {
        from: '2026-07-29T00:00:00.000Z',
        to: '2026-07-29T23:59:59.999Z',
      }),
    ).resolves.toMatchObject({
      items: [
        {
          roomNumber: '101',
          roomConcept: 'Deluxe King',
          housekeepingStatus: 'DIRTY',
          currentOccupancy: 'VACANT',
          nextBookingWindow: null,
          bookings: [{ bookingCode: 'BK-101' }],
        },
      ],
    });
  });
});
