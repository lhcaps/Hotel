import { describe, expect, it } from 'vitest';

import { availabilitySearchRequestSchema } from '@room/contracts/pricing';

import { readBookingSearchQuery, toBookingSearchQuery } from './booking-search-state';

describe('readBookingSearchQuery', () => {
  it('normalizes a browser-native datetime-local query into the API instant format', () => {
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
      mode: 'overnight',
      checkIn: '2027-01-10T11:00:00+07:00',
      checkOut: '2027-01-10T14:00:00+07:00',
      adults: 2,
      children: 0,
    });
  });

  it('round-trips an hourly state into the exact shared availability request', () => {
    const query = toBookingSearchQuery({
      mode: 'hourly',
      checkIn: '2027-01-10T23:00:00+07:00',
      checkOut: '2027-01-11T02:00:00+07:00',
      adults: 2,
      children: 1,
    });
    const state = readBookingSearchQuery(new URLSearchParams(query));

    expect(state).toEqual({
      mode: 'hourly',
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
