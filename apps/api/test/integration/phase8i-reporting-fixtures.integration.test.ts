import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrateDatabase, seedDevelopmentData } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import { AdminOperationalReportRepository } from '../../src/reporting/admin-operational-report.repository.js';

const DEMO_PROPERTY_ID = '10000000-0000-4000-8000-000000000001';

describe('Phase 8I sanitized UAT reporting fixtures', () => {
  let database: GuardedTestDatabase;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    await seedDevelopmentData(database.databaseUrl, { environment: 'development' });
  });

  afterAll(async () => database?.dispose());

  it('returns the documented non-empty lifecycle metrics in the property timezone', async () => {
    const repository = new AdminOperationalReportRepository(database.pool);

    await expect(
      repository.getReport(DEMO_PROPERTY_ID, {
        from: '2027-07-09T17:00:00.000Z',
        to: '2027-07-14T16:59:59.999Z',
      }),
    ).resolves.toEqual({
      grossRevenueVnd: 1_137_000n,
      settledRevenueVnd: 359_000n,
      bookingCount: 5,
      confirmedCount: 2,
      cancellationCount: 1,
      paymentReviewCount: 1,
      customerCount: 2,
      returningCustomerCount: 1,
      daily: [
        { date: '2027-07-10', revenueVnd: 359_000n, bookingCount: 1 },
        { date: '2027-07-11', revenueVnd: 359_000n, bookingCount: 1 },
        { date: '2027-07-12', revenueVnd: 419_000n, bookingCount: 1 },
        { date: '2027-07-13', revenueVnd: 0n, bookingCount: 1 },
        { date: '2027-07-14', revenueVnd: 0n, bookingCount: 1 },
      ],
      ratePlans: [{ label: 'LUNCH_COMBO', revenueVnd: 1_137_000n, bookingCount: 5 }],
      roomTypes: [
        { label: 'Standard', revenueVnd: 718_000n, bookingCount: 2 },
        { label: 'Deluxe', revenueVnd: 419_000n, bookingCount: 2 },
        { label: 'Signature', revenueVnd: 0n, bookingCount: 1 },
      ],
    });
  });
});
