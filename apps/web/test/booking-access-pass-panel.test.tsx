import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BookingAccessPassPanel } from '../src/components/booking-access-pass-panel';
import { LocaleProvider } from '../src/components/locale-provider';

function checkInWithinAccessReleaseWindow(): string {
  return new Date(Date.now() + 5 * 60 * 1_000).toISOString();
}

describe('BookingAccessPassPanel', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('renders the guest-authorized access QR as an image without exposing its payload as text', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          bookingCode: 'RM-AB23-CD45-EF67',
          expiresAt: '2027-01-10T07:00:00.000Z',
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1H0z" /></svg>',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { container } = render(
      <LocaleProvider locale="en">
        <BookingAccessPassPanel
          bookingCode="RM-AB23-CD45-EF67"
          checkIn={checkInWithinAccessReleaseWindow()}
        />
      </LocaleProvider>,
    );

    const image = await screen.findByRole('img', { name: 'Booking access QR code' });
    expect(image).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/svg\+xml;charset=utf-8,/),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://api.local/api/v1/public/bookings/RM-AB23-CD45-EF67/access-pass',
    );
    expect(container).not.toHaveTextContent('<svg');
  });

  it('does not expose a pass when the booking is no longer eligible', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'booking-access-pass-invalid',
          title: 'Booking access pass unavailable',
          status: 409,
          code: 'BOOKING_ACCESS_PASS_INVALID',
          detail: 'Not available',
          requestId: 'req-1',
          errors: [],
        }),
        { status: 409, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    render(
      <LocaleProvider locale="en">
        <BookingAccessPassPanel
          bookingCode="RM-AB23-CD45-EF67"
          checkIn={checkInWithinAccessReleaseWindow()}
        />
      </LocaleProvider>,
    );

    expect(
      await screen.findByText(
        'Check-in information becomes available about 30 minutes before arrival.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Booking access QR code' })).not.toBeInTheDocument();
  });

  it('does not request the gated endpoint before the access release window', async () => {
    render(
      <LocaleProvider locale="en">
        <BookingAccessPassPanel
          bookingCode="RM-AB23-CD45-EF67"
          checkIn={new Date(Date.now() + 31 * 60 * 1_000).toISOString()}
        />
      </LocaleProvider>,
    );

    expect(
      await screen.findByText(
        'Check-in information becomes available about 30 minutes before arrival.',
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
