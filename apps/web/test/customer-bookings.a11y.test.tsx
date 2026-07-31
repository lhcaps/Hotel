import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CustomerBookingsPage from '../src/app/account/bookings/page';
import { LocaleProvider } from '../src/components/locale-provider';

const viewports = [390, 1366] as const;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.example.test';
  globalThis.fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              bookingId: '10000000-0000-4000-8000-000000000001',
              bookingCode: 'UAT-CONFIRMED-20270711',
              status: 'CONFIRMED',
              checkIn: '2027-07-11T02:00:00.000Z',
              checkOut: '2027-07-11T05:00:00.000Z',
              currency: 'VND',
              finalAmountVnd: '359000',
              createdAt: '2027-07-01T00:00:00.000Z',
            },
          ],
          nextCursor: null,
        }),
      ),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  vi.restoreAllMocks();
});

describe('CUSTOMER booking list accessibility', () => {
  it.each(viewports)('measures the authenticated booking list at %ipx', async (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    const { container } = render(
      <LocaleProvider locale="en">
        <CustomerBookingsPage />
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'My bookings' })).toBeVisible());
    expect(screen.getByRole('link', { name: /UAT-CONFIRMED-20270711/i })).toBeVisible();
    const result = await axe(container);
    expect(
      result.violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
  });
});
