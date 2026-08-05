import { describe, expect, it, vi } from 'vitest';

import { RoomOperationsService } from '../../src/booking/services/room-operations.service.js';
import { computeFreeWindows } from '../../src/booking/services/room-operations.service.js';

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
