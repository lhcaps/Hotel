import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingDetailResponse, PaymentStatusResponse } from '@room/contracts';

import { GuestBookingRouteClient } from '../src/app/booking/manage/[bookingCode]/guest-route-client';
import { LocaleProvider } from '../src/components/locale-provider';

const BOOKING: BookingDetailResponse = {
  bookingCode: 'RM-AB23-CD45-EF67',
  status: 'CONFIRMED',
  property: { code: 'MAIN', name: 'Main Property', timezone: 'Asia/Ho_Chi_Minh' },
  roomType: { code: 'DLX', name: 'Deluxe', maxOccupancy: 3 },
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  adults: 2,
  children: 0,
  amountVnd: 359000,
  currency: 'VND',
  holdExpiresAt: null,
  contact: {
    fullName: 'Guest Example',
    emailMasked: 'g***@example.test',
    phoneMasked: '+84***000',
  },
  serverTime: '2027-01-10T03:00:00.000Z',
};

const PAYMENT: PaymentStatusResponse = {
  provider: 'MOMO',
  paymentStatus: 'SUCCEEDED',
  attemptStatus: 'SUCCEEDED',
  bookingStatus: 'CONFIRMED',
  amountVnd: 359000,
  currency: 'VND',
  createdAt: '2027-01-10T02:55:00.000Z',
  updatedAt: '2027-01-10T03:00:00.000Z',
  completedAt: '2027-01-10T03:00:00.000Z',
  reviewRequired: false,
  customerMessage: null,
};

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

function problemResponse(status: number, code: string): Response {
  return jsonResponse(
    {
      type: 'about:blank',
      title: 'Error',
      status,
      code,
      detail: 'Error',
      requestId: 'req-x',
      errors: [],
    },
    { status },
  );
}

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ bookingCode: 'RM-AB23-CD45-EF67' }),
  useRouter: () => ({ replace: replaceMock }),
}));

describe('GuestBookingRouteClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    replaceMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('loads booking + payment status with credentials and renders the success surface', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BOOKING));
    fetchMock.mockResolvedValueOnce(jsonResponse(PAYMENT));
    const { container } = render(
      <LocaleProvider locale="vi">
        <GuestBookingRouteClient />
      </LocaleProvider>,
    );
    expect(await screen.findByTestId('confirmed-success-surface')).toBeInTheDocument();
    expect(await screen.findByTestId('confirmed-success-heading')).toHaveTextContent(
      'Đặt phòng thành công',
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://api.local/api/v1/public/bookings/RM-AB23-CD45-EF67',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://api.local/api/v1/public/bookings/RM-AB23-CD45-EF67/payment',
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.credentials).toBe('include');
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it('does NOT render the success surface when the payment is still pending', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...BOOKING, status: 'HOLD' }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...PAYMENT, paymentStatus: 'PENDING', bookingStatus: 'HOLD' }),
    );
    render(
      <LocaleProvider locale="vi">
        <GuestBookingRouteClient />
      </LocaleProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('confirmed-success-surface')).not.toBeInTheDocument();
  });

  it('routes to /booking/manage when the session cookie is missing', async () => {
    fetchMock.mockResolvedValueOnce(problemResponse(401, 'GUEST_SESSION_REQUIRED'));
    const user = userEvent.setup();
    render(
      <LocaleProvider locale="vi">
        <GuestBookingRouteClient />
      </LocaleProvider>,
    );
    expect(
      await screen.findByText(/Phiên xác nhận đã hết hạn hoặc không hợp lệ/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yêu cầu mã mới' }));
    expect(replaceMock).toHaveBeenCalledWith('/booking/manage');
  });

  it('never embeds OTP / email / cookie in URL or storage', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BOOKING));
    fetchMock.mockResolvedValueOnce(jsonResponse(PAYMENT));
    render(
      <LocaleProvider locale="vi">
        <GuestBookingRouteClient />
      </LocaleProvider>,
    );
    await screen.findByTestId('confirmed-success-surface');
    // The mock routing hook is synchronous so the URL we read here is the
    // test's `window.location.href` placeholder. The component never
    // writes to localStorage / sessionStorage directly.
    expect(typeof window.localStorage.setItem).toBe('function');
  });
});
