import { describe, expect, it } from 'vitest';

import { adminBookingListQuerySchema } from '@room/contracts';

import { toAdminBookingRepositoryQuery } from '../../src/booking/admin-booking-date-filter.js';

describe('admin booking date filter contract', () => {
  it('accepts calendar dates and preserves the same-day local interval', () => {
    const query = adminBookingListQuerySchema.parse({
      page: '1',
      pageSize: '20',
      checkInFrom: '2026-08-06',
      checkInTo: '2026-08-06',
    });

    const repositoryQuery = toAdminBookingRepositoryQuery(query, 'Asia/Ho_Chi_Minh');

    expect(repositoryQuery.checkInFrom?.toISOString()).toBe('2026-08-05T17:00:00.000Z');
    expect(repositoryQuery.checkInToExclusive?.toISOString()).toBe('2026-08-06T17:00:00.000Z');
  });

  it('rejects malformed, impossible, and reversed calendar dates', () => {
    expect(() => adminBookingListQuerySchema.parse({ checkInFrom: '08/06/2026' })).toThrow();
    expect(() => adminBookingListQuerySchema.parse({ checkInFrom: '2026-02-29' })).toThrow();
    expect(() =>
      adminBookingListQuerySchema.parse({
        checkInFrom: '2026-08-07',
        checkInTo: '2026-08-06',
      }),
    ).toThrow(/checkInFrom|checkInTo/i);
  });

  it('handles leap-day and month/year boundaries without UTC date shifting', () => {
    const leapDay = toAdminBookingRepositoryQuery(
      adminBookingListQuerySchema.parse({
        checkInFrom: '2028-02-29',
        checkInTo: '2028-02-29',
      }),
      'Asia/Ho_Chi_Minh',
    );
    const yearBoundary = toAdminBookingRepositoryQuery(
      adminBookingListQuerySchema.parse({
        checkInFrom: '2026-12-31',
        checkInTo: '2027-01-01',
      }),
      'Asia/Ho_Chi_Minh',
    );

    expect(leapDay.checkInFrom?.toISOString()).toBe('2028-02-28T17:00:00.000Z');
    expect(leapDay.checkInToExclusive?.toISOString()).toBe('2028-02-29T17:00:00.000Z');
    expect(yearBoundary.checkInFrom?.toISOString()).toBe('2026-12-30T17:00:00.000Z');
    expect(yearBoundary.checkInToExclusive?.toISOString()).toBe('2027-01-01T17:00:00.000Z');
  });
});
