import { describe, expect, it } from 'vitest';

import {
  emptyAdminBookingFilters,
  readAdminBookingFilterState,
  toAdminBookingFilterQuery,
} from './admin-booking-filter-state';

describe('admin booking filter state', () => {
  it('serializes date inputs as YYYY-MM-DD and preserves every applied filter', () => {
    const query = toAdminBookingFilterQuery(2, {
      ...emptyAdminBookingFilters,
      bookingCode: 'RM-TEST',
      status: 'CONFIRMED',
      paymentStatus: 'SUCCEEDED',
      reviewPresence: 'OPEN',
      checkInFrom: '2026-08-06',
      checkInTo: '2026-08-06',
    });

    expect(query).toBe(
      'page=2&q=RM-TEST&status=CONFIRMED&paymentStatus=SUCCEEDED&reviewPresence=OPEN&checkInFrom=2026-08-06&checkInTo=2026-08-06',
    );
  });

  it('restores filters and page from URL state after hard refresh or Back/Forward', () => {
    const restored = readAdminBookingFilterState(
      new URLSearchParams(
        'page=3&q=RM-TEST&customerUserId=customer-1&checkInFrom=2026-08-05&checkInTo=2026-08-06',
      ),
    );

    expect(restored.page).toBe(3);
    expect(restored.filters).toEqual({
      ...emptyAdminBookingFilters,
      bookingCode: 'RM-TEST',
      customerUserId: 'customer-1',
      checkInFrom: '2026-08-05',
      checkInTo: '2026-08-06',
    });
  });

  it('clamps invalid pages to one and identifies reversed date ranges', () => {
    expect(readAdminBookingFilterState(new URLSearchParams('page=0')).page).toBe(1);
    expect(readAdminBookingFilterState(new URLSearchParams('page=not-a-number')).page).toBe(1);
  });
});
