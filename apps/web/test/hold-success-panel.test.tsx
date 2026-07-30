import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingHoldResponse, BookingHoldStatusResponse } from '@room/contracts';

import { HoldSuccessPanel } from '../src/components/hold-success-panel';
import { LocaleProvider } from '../src/components/locale-provider';

const HOLD: BookingHoldResponse = {
  bookingId: '22222222-2222-4222-8222-222222222222',
  bookingCode: 'RM-AB23-CD45-EF67',
  status: 'HOLD',
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  holdExpiresAt: '2027-01-10T03:15:00.000Z',
  amountVnd: 359000,
  currency: 'VND',
  idempotent: false,
};

function makeStatusResponse(overrides: Partial<BookingHoldStatusResponse> = {}): BookingHoldStatusResponse {
  return {
    status: 'EXPIRED',
    holdExpiresAt: '2027-01-10T03:15:00.000Z',
    serverTime: '2027-01-10T03:16:00.000Z',
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('HoldSuccessPanel', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2027-01-10T03:00:00.000Z'));
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders English HOLD details while preserving the booking code and status', () => {
    render(
      <LocaleProvider locale="en">
        <HoldSuccessPanel
          bookingCode="RM-AB23-CD45-EF67"
          email="guest@example.test"
          hold={HOLD}
          onManageBooking={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Booking hold created' })).toBeInTheDocument();
    expect(screen.getByText('RM-AB23-CD45-EF67')).toBeInTheDocument();
    expect(screen.getByText('HOLD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage booking' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Giữ chỗ thành công');
  });

  it('renders only the server-returned amount, currency, and booking code', () => {
    render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD}
        onManageBooking={vi.fn()}
      />,
    );
    expect(screen.getByText('RM-AB23-CD45-EF67')).toBeInTheDocument();
    expect(screen.getByText(/359\.000/)).toBeInTheDocument();
    expect(screen.getByText('HOLD')).toBeInTheDocument();
    expect(screen.queryByText(/359000/)).not.toBeInTheDocument();
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD}
        onManageBooking={vi.fn()}
      />,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it('declares a polite live region for the countdown', () => {
    render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD}
        onManageBooking={vi.fn()}
      />,
    );
    const region = screen.getByTestId('hold-countdown');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('rechecks server status when the countdown crosses zero', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeStatusResponse()));
    render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD}
        onManageBooking={vi.fn()}
      />,
    );
    // Advance past hold expiry — shouldAdvanceTime: true fires intervals.
    await vi.advanceTimersByTimeAsync(16 * 60 * 1000);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      bookingCode: 'RM-AB23-CD45-EF67',
      email: 'guest@example.test',
    });
  });

  it('renders EXPIRED state when the server returns EXPIRED', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeStatusResponse({ status: 'EXPIRED' })));
    render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD}
        onManageBooking={vi.fn()}
      />,
    );
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    // The same message is announced in two places (visible label and sr-only).
    expect(await screen.findAllByText('Giữ chỗ đã hết hạn.')).not.toHaveLength(0);
  });

  it('navigates to the manage page when the action button is pressed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onManageBooking = vi.fn();
    render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD}
        onManageBooking={onManageBooking}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Quản lý đặt phòng' }));
    expect(onManageBooking).toHaveBeenCalledTimes(1);
  });
});
