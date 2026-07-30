import { describe, expect, it, vi } from 'vitest';

import { AdminOperationalReportRepository } from '../../src/reporting/admin-operational-report.repository.js';

describe('AdminOperationalReportRepository', () => {
  it('scopes all aggregates to one property and represents NONE payment status explicitly', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            gross_revenue_vnd: '900000',
            settled_revenue_vnd: '600000',
            booking_count: '3',
            confirmed_count: '2',
            cancellation_count: '1',
            customer_count: '2',
            returning_customer_count: '1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new AdminOperationalReportRepository({ query });

    await expect(
      repository.getReport('property-1', {
        from: '2026-07-29T00:00:00.000Z',
        to: '2026-07-29T23:59:59.999Z',
        paymentStatuses: ['NONE', 'SUCCEEDED'],
      }),
    ).resolves.toMatchObject({ grossRevenueVnd: 900_000n, settledRevenueVnd: 600_000n });

    const [metricsSql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(metricsSql).toContain('b.property_id = $1');
    expect(metricsSql).toContain("pay.status IS NULL");
    expect(params).toEqual([
      'property-1',
      new Date('2026-07-29T00:00:00.000Z'),
      new Date('2026-07-29T23:59:59.999Z'),
      ['SUCCEEDED'],
    ]);
  });
});
