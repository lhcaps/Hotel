import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AvailabilitySearchResponse, ProblemDetails } from '@room/contracts';

import { AvailabilitySearchResults } from '../src/components/availability-search-results';
import { AdminApiError } from '../src/lib/admin-api';
import { LocaleProvider } from '../src/components/locale-provider';

function problem(overrides: Partial<ProblemDetails>): ProblemDetails {
  return {
    type: 'validation-error',
    title: 'Invalid request',
    status: 400,
    code: 'VALIDATION_ERROR',
    detail: 'One or more request fields are invalid.',
    requestId: 'req-1',
    errors: [],
    ...overrides,
  };
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const response: AvailabilitySearchResponse = {
  items: [
    {
      roomTypeId: '11111111-1111-4111-8111-111111111111',
      roomTypeName: 'Deluxe',
      maxAdults: 2,
      maxChildren: 1,
      maxOccupancy: 3,
      amenities: ['Window'],
      availableRoomCount: 1,
      offer: { planLabel: '3-hour stay', amountVnd: 359000 },
    },
  ],
};

describe('AvailabilitySearchResults', () => {
  it('labels the active plan amount as the exact price for the selected interval', () => {
    render(
      <LocaleProvider locale="en">
        <AvailabilitySearchResults
          exactResponse={response}
          exactStatus="success"
          state={{
            checkIn: '2027-01-10T03:00:00.000Z',
            checkOut: '2027-01-10T06:00:00.000Z',
            adults: 2,
            children: 0,
            mode: 'hourly',
          }}
        />
      </LocaleProvider>,
    );

    const card = screen.getByTestId('availability-room-11111111-1111-4111-8111-111111111111');
    expect(card).toHaveTextContent('3-hour stay');
    expect(card).toHaveTextContent('Exact price for selected time: ₫359,000');
    expect(card).not.toHaveTextContent('From ₫359,000');
  });

  it('shows an invalid-interval specific message for VALIDATION_ERROR / INVALID_PRICING_INTERVAL problems', () => {
    render(
      <LocaleProvider locale="en">
        <AvailabilitySearchResults
          exactError={new AdminApiError(problem({ code: 'INVALID_PRICING_INTERVAL' }))}
          exactStatus="error"
          state={{
            checkIn: '2027-01-10T03:00:00.000Z',
            checkOut: '2027-01-11T09:00:00.000Z',
            adults: 2,
            children: 0,
            mode: 'overnight',
          }}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText('Invalid stay interval')).toBeInTheDocument();
  });

  it('shows a pricing-unavailable specific message for pricing configuration problems', () => {
    render(
      <LocaleProvider locale="en">
        <AvailabilitySearchResults
          exactError={new AdminApiError(problem({ code: 'PRICING_RULE_NOT_FOUND' }))}
          exactStatus="error"
          state={{
            checkIn: '2027-01-10T03:00:00.000Z',
            checkOut: '2027-01-10T06:00:00.000Z',
            adults: 2,
            children: 0,
            mode: 'hourly',
          }}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText('Pricing is not available for this interval')).toBeInTheDocument();
  });

  it('falls back to the generic load-error message for unrecognized errors', () => {
    render(
      <LocaleProvider locale="en">
        <AvailabilitySearchResults
          exactError={new Error('network down')}
          exactStatus="error"
          state={{
            checkIn: '2027-01-10T03:00:00.000Z',
            checkOut: '2027-01-10T06:00:00.000Z',
            adults: 2,
            children: 0,
            mode: 'hourly',
          }}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText('Room availability could not be loaded')).toBeInTheDocument();
  });
});
