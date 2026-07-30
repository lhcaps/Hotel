import { describe, expect, it, vi } from 'vitest';

import { RoomOperationsService } from '../../src/booking/services/room-operations.service.js';

describe('RoomOperationsService', () => {
  it('returns the property-scoped rows supplied by the authoritative repository', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue([
        {
          roomId: '10000000-0000-4000-8000-000000000101',
          roomNumber: '101',
          roomStatus: 'ACTIVE',
          housekeepingStatus: 'DIRTY',
          maintenanceState: 'NONE',
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
        { roomNumber: '101', housekeepingStatus: 'DIRTY', bookings: [{ bookingCode: 'BK-101' }] },
      ],
    });
  });
});
