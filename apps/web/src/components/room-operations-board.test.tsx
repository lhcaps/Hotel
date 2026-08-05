import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomOperationsBoard } from './room-operations-board';
import { LocaleProvider } from './locale-provider';

const { getRoomOperations } = vi.hoisted(() => ({ getRoomOperations: vi.fn() }));

vi.mock('../lib/admin-api', () => ({ adminApi: { getRoomOperations } }));

describe('RoomOperationsBoard', () => {
  beforeEach(() => getRoomOperations.mockReset());

  it('renders server-provided housekeeping, maintenance and occupancy rows', async () => {
    getRoomOperations.mockResolvedValue({
      generatedAt: '2026-07-30T00:00:00.000Z',
      items: [
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
          currentOccupancy: 'VACANT',
          nextBookingWindow: null,
          freeWindows: [],
          activeHousekeepingTask: null,
          bookings: [
            {
              bookingCode: 'BK-101',
              status: 'CONFIRMED',
              checkIn: '2026-07-29T11:00:00.000Z',
              checkOut: '2026-07-29T14:00:00.000Z',
            },
          ],
        },
      ],
    });

    render(
      <LocaleProvider locale="en">
        <RoomOperationsBoard />
      </LocaleProvider>,
    );

    await screen.findByText('Room 101');
    expect(screen.getAllByText('Needs cleaning').length).toBeGreaterThan(0);
    expect(screen.getByText('Vacant')).toBeTruthy();
    expect(getRoomOperations).toHaveBeenCalledWith(
      expect.objectContaining({ includeInactive: false }),
    );
    expect(getRoomOperations).toHaveBeenCalledOnce();
  });
});
