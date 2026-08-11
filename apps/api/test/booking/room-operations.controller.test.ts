import { describe, expect, it, vi } from 'vitest';

import { RoomOperationsController } from '../../src/booking/room-operations.controller.js';

const propertyId = '10000000-0000-4000-8000-000000000001';
const roomId = '10000000-0000-4000-8000-000000000101';

const response = {
  generatedAt: '2026-08-04T00:00:00.000Z',
  items: [
    {
      roomId,
      roomNumber: '101',
      roomConcept: 'Deluxe King',
      physicalRoomCode: 'ROOM-101',
      roomTier: 'Standard',
      floor: '1',
      roomStatus: 'ACTIVE' as const,
      housekeepingStatus: 'CLEAN' as const,
      maintenanceState: 'ACTIVE' as const,
      currentOccupancy: 'OCCUPIED' as const,
      displayGroup: 'maintenance' as const,
      nextBookingWindow: {
        checkIn: '2026-08-04T10:00:00.000Z',
        checkOut: '2026-08-04T12:00:00.000Z',
      },
      bookings: [
        {
          bookingCode: 'PN-SECRET',
          status: 'CONFIRMED' as const,
          checkIn: '2026-08-04T08:00:00.000Z',
          checkOut: '2026-08-04T10:00:00.000Z',
        },
      ],
      freeWindows: [
        {
          startsAt: '2026-08-04T12:00:00.000Z',
          endsAt: '2026-08-04T13:00:00.000Z',
        },
      ],
      activeHousekeepingTask: {
        type: 'TURNOVER' as const,
        status: 'DUE' as const,
        dueAt: '2026-08-04T10:00:00.000Z',
      },
    },
  ],
};

function actor(role: 'ADMIN' | 'ROOM_STATUS_VIEWER') {
  return { role, profileCode: role === 'ROOM_STATUS_VIEWER' ? role : 'SUPER_ADMIN' } as never;
}

describe('RoomOperationsController', () => {
  it('minimizes room-viewer data while preserving the next booking window', async () => {
    const service = { list: vi.fn().mockResolvedValue(response) };
    const propertyContext = { getCurrent: vi.fn().mockResolvedValue({ id: propertyId }) };
    const controller = new RoomOperationsController(service as never, propertyContext as never);

    const result = await controller.list(
      { actor: actor('ROOM_STATUS_VIEWER') },
      { from: '2026-08-04T00:00:00.000Z', to: '2026-08-04T23:59:59.999Z' },
    );

    expect(result.items[0]).toMatchObject({
      roomNumber: '101',
      roomConcept: 'Deluxe King',
      physicalRoomCode: 'ROOM-101',
      roomTier: 'Standard',
      floor: '1',
      currentOccupancy: 'OCCUPIED',
      nextBookingWindow: response.items[0]?.nextBookingWindow,
      bookings: [],
      freeWindows: [],
      activeHousekeepingTask: null,
    });
    expect(JSON.stringify(result)).not.toContain('PN-SECRET');
  });

  it('keeps operational booking detail for an admin actor', async () => {
    const service = { list: vi.fn().mockResolvedValue(response) };
    const propertyContext = { getCurrent: vi.fn().mockResolvedValue({ id: propertyId }) };
    const controller = new RoomOperationsController(service as never, propertyContext as never);

    const result = await controller.list(
      { actor: actor('ADMIN') },
      { from: '2026-08-04T00:00:00.000Z', to: '2026-08-04T23:59:59.999Z' },
    );

    expect(result.items[0]?.bookings[0]?.bookingCode).toBe('PN-SECRET');
    expect(result.items[0]?.activeHousekeepingTask?.type).toBe('TURNOVER');
  });
});
