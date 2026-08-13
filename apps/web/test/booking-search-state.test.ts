import { describe, expect, it } from 'vitest';

import { readBookingSearchQuery, toBookingSearchQuery } from '../src/lib/booking-search-state';

describe('booking search query state', () => {
  it('serializes one mode-free interval payload', () => {
    const query = toBookingSearchQuery({
      checkIn: '2027-04-10T11:00:00+07:00',
      checkOut: '2027-04-10T14:00:00+07:00',
      adults: 2,
      children: 0,
    });

    expect(readBookingSearchQuery(new URLSearchParams(query))).toEqual({
      checkIn: '2027-04-10T11:00:00+07:00',
      checkOut: '2027-04-10T14:00:00+07:00',
      adults: 2,
      children: 0,
    });
  });

  it('rejects mixed or incomplete route state instead of restoring stale fields', () => {
    expect(readBookingSearchQuery(new URLSearchParams('mode=hourly&adults=2&children=0'))).toBe(
      undefined,
    );
  });

  it('accepts a legacy mode query without returning it to the Customer surface', () => {
    expect(
      readBookingSearchQuery(
        new URLSearchParams(
          'mode=hourly&checkIn=2027-04-10T11%3A00%3A00%2B07%3A00&checkOut=2027-04-10T14%3A00%3A00%2B07%3A00&adults=2&children=0',
        ),
      ),
    ).toEqual({
      checkIn: '2027-04-10T11:00:00+07:00',
      checkOut: '2027-04-10T14:00:00+07:00',
      adults: 2,
      children: 0,
    });
  });
});
