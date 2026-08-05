import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { vi } from 'vitest';

import { LocaleProvider } from '../src/components/locale-provider';
import { OperationalReportDashboard } from '../src/components/operational-report-dashboard';
import { RoomOperationsBoard } from '../src/components/room-operations-board';

const { getOperationalReport, getRoomOperations } = vi.hoisted(() => ({
  getOperationalReport: vi.fn(),
  getRoomOperations: vi.fn(),
}));

vi.mock('../src/lib/admin-api', () => ({
  AdminApiError: class AdminApiError extends Error {},
  adminApi: { getOperationalReport, getRoomOperations },
}));

describe('Phase 8H operational accessibility', () => {
  it('measures no axe critical or serious violations on the room operations board', async () => {
    getRoomOperations.mockResolvedValue({
      generatedAt: '2026-07-30T00:00:00.000Z',
      items: [
        {
          roomId: '10000000-0000-4000-8000-000000000101',
          roomNumber: '101',
          physicalRoomCode: 'ROOM-101',
          roomTier: 'Standard',
          floor: '1',
          roomConcept: 'Deluxe King',
          roomStatus: 'ACTIVE',
          housekeepingStatus: 'CLEAN',
          maintenanceState: 'NONE',
          currentOccupancy: 'VACANT',
          nextBookingWindow: null,
          bookings: [],
          freeWindows: [],
          activeHousekeepingTask: null,
        },
      ],
    });
    const { container } = render(
      <LocaleProvider locale="en">
        <RoomOperationsBoard />
      </LocaleProvider>,
    );

    await screen.findByText('Room 101');
    const result = await axe(container);
    expect(
      result.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'),
    ).toHaveLength(0);
  });

  it('measures no axe critical or serious violations on the report table fallback', async () => {
    getOperationalReport.mockResolvedValue({
      grossRevenueVnd: 900_000,
      settledRevenueVnd: 600_000,
      outstandingRevenueVnd: null,
      bookingCount: 3,
      confirmedCount: 2,
      cancellationCount: 1,
      paymentReviewCount: 1,
      customerCount: 2,
      returningCustomerCount: 1,
      daily: [{ date: '2026-07-29', revenueVnd: 900_000, bookingCount: 3 }],
      ratePlans: [{ label: 'LUNCH_COMBO', revenueVnd: 900_000, bookingCount: 3 }],
      roomTypes: [{ label: 'Deluxe', revenueVnd: 900_000, bookingCount: 3 }],
      generatedAt: '2026-07-30T00:00:00.000Z',
    });
    const { container } = render(
      <LocaleProvider locale="en">
        <OperationalReportDashboard />
      </LocaleProvider>,
    );

    await screen.findByRole('heading', { name: 'Daily revenue' });
    const result = await axe(container);
    expect(
      result.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'),
    ).toHaveLength(0);
  });
});
