import { describe, expect, it, vi } from 'vitest';

import { AdminOperationalReportController } from '../../src/reporting/admin-operational-report.controller.js';
import { AdminOperationalReportService } from '../../src/reporting/admin-operational-report.service.js';
import { PropertyContextService } from '../../src/catalog/property-context.service.js';

describe('AdminOperationalReportController', () => {
  it('uses the active property context and delegates the untrusted query to the service', async () => {
    const report = { generatedAt: '2026-07-30T00:00:00.000Z' };
    const service = { getReport: vi.fn().mockResolvedValue(report) };
    const propertyContext = { getCurrent: vi.fn().mockResolvedValue({ id: 'property-1' }) };
    const controller = new AdminOperationalReportController(
      service as unknown as AdminOperationalReportService,
      propertyContext as unknown as PropertyContextService,
    );
    const query = { from: '2026-07-29T00:00:00.000Z', to: '2026-07-29T23:59:59.999Z' };

    await expect(controller.getReport(query)).resolves.toBe(report);
    expect(service.getReport).toHaveBeenCalledWith('property-1', query, expect.any(Date));
  });
});
