import { describe, expect, it } from 'vitest';

import { availabilitySearchRequestSchema } from '@room/contracts/pricing';

import { readBookingSearchQuery, toBookingSearchQuery } from './booking-search-state';

describe('readBookingSearchQuery', () => {
  it('normalizes a browser-native datetime-local query without exposing a booking mode', () => {
    expect(
      readBookingSearchQuery(
        new URLSearchParams({
          mode: 'overnight',
          checkIn: '2027-01-10T11:00',
          checkOut: '2027-01-10T14:00',
          adults: '2',
          children: '0',
        }),
      ),
    ).toEqual({
      checkIn: '2027-01-10T11:00:00+07:00',
      checkOut: '2027-01-10T14:00:00+07:00',
      adults: 2,
      children: 0,
    });
  });

  it('round-trips a universal interval into the exact shared availability request without mode', () => {
    const query = toBookingSearchQuery({
      checkIn: '2027-01-10T23:00:00+07:00',
      checkOut: '2027-01-11T02:00:00+07:00',
      adults: 2,
      children: 1,
    });
    const state = readBookingSearchQuery(new URLSearchParams(query));

    expect(query).not.toContain('mode=');
    expect(state).toEqual({
      checkIn: '2027-01-10T23:00:00+07:00',
      checkOut: '2027-01-11T02:00:00+07:00',
      adults: 2,
      children: 1,
    });
    expect(
      availabilitySearchRequestSchema.parse({
        checkIn: state?.checkIn,
        checkOut: state?.checkOut,
        adults: state?.adults,
        children: state?.children,
      }),
    ).toEqual({
      checkIn: '2027-01-10T23:00:00+07:00',
      checkOut: '2027-01-11T02:00:00+07:00',
      adults: 2,
      children: 1,
    });
  });
});
