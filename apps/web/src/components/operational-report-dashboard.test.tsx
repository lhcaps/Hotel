import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from './locale-provider';
import { OperationalReportDashboard } from './operational-report-dashboard';

const { getOperationalReport } = vi.hoisted(() => ({ getOperationalReport: vi.fn() }));

vi.mock('../lib/admin-api', () => ({
  AdminApiError: class AdminApiError extends Error {},
  adminApi: { getOperationalReport },
}));

describe('OperationalReportDashboard', () => {
  beforeEach(() => {
    getOperationalReport.mockReset();
  });

  it('renders server-provided metrics and clearly marks deferred outstanding revenue', async () => {
    getOperationalReport.mockResolvedValue({
      grossRevenueVnd: 900_000,
      settledRevenueVnd: 600_000,
      outstandingRevenueVnd: null,
      bookingCount: 3,
      confirmedCount: 2,
      cancellationCount: 1,
      customerCount: 2,
      returningCustomerCount: 1,
      daily: [{ date: '2026-07-29', revenueVnd: 900_000, bookingCount: 3 }],
      ratePlans: [{ label: 'LUNCH_COMBO', revenueVnd: 600_000, bookingCount: 2 }],
      roomTypes: [{ label: 'Deluxe', revenueVnd: 600_000, bookingCount: 2 }],
      generatedAt: '2026-07-30T00:00:00.000Z',
    });

    render(
      <LocaleProvider locale="en">
        <OperationalReportDashboard />
      </LocaleProvider>,
    );

    expect((await screen.findAllByText('900,000 VND')).length).toBeGreaterThan(0);
    expect(screen.getByText('Outstanding revenue is unavailable until partial payments are modeled.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Daily revenue' })).toBeTruthy();
    expect(getOperationalReport).toHaveBeenCalledOnce();
  });

  it('shows an explicit empty state when the server report has no bookings', async () => {
    getOperationalReport.mockResolvedValue({
      grossRevenueVnd: 0,
      settledRevenueVnd: 0,
      outstandingRevenueVnd: null,
      bookingCount: 0,
      confirmedCount: 0,
      cancellationCount: 0,
      customerCount: 0,
      returningCustomerCount: 0,
      daily: [],
      ratePlans: [],
      roomTypes: [],
      generatedAt: '2026-07-30T00:00:00.000Z',
    });

    render(
      <LocaleProvider locale="en">
        <OperationalReportDashboard />
      </LocaleProvider>,
    );

    await screen.findByText('No bookings match this report range.');
  });
});
