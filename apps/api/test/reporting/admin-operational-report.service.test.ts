import { describe, expect, it, vi } from 'vitest';

import { AdminOperationalReportService } from '../../src/reporting/admin-operational-report.service.js';

describe('AdminOperationalReportService', () => {
  it('returns server aggregate metrics and never derives outstanding revenue', async () => {
    const repository = {
      getReport: vi.fn().mockResolvedValue({
        grossRevenueVnd: 900_000n,
        settledRevenueVnd: 600_000n,
        bookingCount: 3,
        confirmedCount: 2,
        cancellationCount: 1,
        customerCount: 2,
        returningCustomerCount: 1,
        daily: [{ date: '2026-07-29', revenueVnd: 900_000n, bookingCount: 3 }],
        ratePlans: [{ label: 'Lunch combo', revenueVnd: 600_000n, bookingCount: 2 }],
        roomTypes: [{ label: 'Deluxe', revenueVnd: 600_000n, bookingCount: 2 }],
      }),
    };
    const service = new AdminOperationalReportService(repository);

    await expect(
      service.getReport('property-1', {
        from: '2026-07-29T00:00:00.000Z',
        to: '2026-07-29T23:59:59.999Z',
      }, new Date('2026-07-30T00:00:00.000Z')),
    ).resolves.toMatchObject({
      grossRevenueVnd: 900_000,
      settledRevenueVnd: 600_000,
      outstandingRevenueVnd: null,
      generatedAt: '2026-07-30T00:00:00.000Z',
      daily: [{ date: '2026-07-29', revenueVnd: 900_000, bookingCount: 3 }],
    });
  });
});
