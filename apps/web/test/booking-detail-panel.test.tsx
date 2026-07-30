import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingDetailResponse } from '@room/contracts';

import { BookingDetailPanel } from '../src/components/booking-detail-panel';

const BOOKING: BookingDetailResponse = {
  bookingCode: 'RM-AB23-CD45-EF67',
  status: 'HOLD',
  property: { code: 'MAIN', name: 'Main Property', timezone: 'Asia/Ho_Chi_Minh' },
  roomType: { code: 'DLX', name: 'Deluxe', maxOccupancy: 3 },
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  adults: 2,
  children: 0,
  amountVnd: 359000,
  currency: 'VND',
  holdExpiresAt: '2027-01-10T03:15:00.000Z',
  contact: {
    fullName: 'Guest Example',
    emailMasked: 'g***@example.test',
    phoneMasked: '+84***000',
  },
  serverTime: '2027-01-10T03:00:00.000Z',
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

describe('BookingDetailPanel', () => {
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

  it('calls the booking detail route with credentials', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BOOKING));
    render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={vi.fn()}
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://api.local/api/v1/public/bookings/RM-AB23-CD45-EF67',
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.credentials).toBe('include');
  });

  it('shows only safe fields returned by the API', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BOOKING));
    render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={vi.fn()}
      />,
    );
    expect(await screen.findByText('Main Property')).toBeInTheDocument();
    expect(screen.getByText('Deluxe')).toBeInTheDocument();
    expect(screen.getByText('g***@example.test')).toBeInTheDocument();
    expect(screen.getByText('+84***000')).toBeInTheDocument();
    expect(screen.queryByText(/bookingId/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contactDigest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sessionRow/i)).not.toBeInTheDocument();
  });

  it('offers an authorized printable confirmation without internal fields', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BOOKING));
    render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={vi.fn()}
      />,
    );
    expect(await screen.findByRole('button', { name: 'In mã xác nhận' })).toBeInTheDocument();
  });

  it('handles session errors by surfacing an unauthorized message', async () => {
    fetchMock.mockResolvedValueOnce(problemResponse(401, 'GUEST_SESSION_REQUIRED'));
    render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(/Phiên xác nhận đã hết hạn hoặc không hợp lệ/),
    ).toBeInTheDocument();
  });

  it('handles booking mismatch errors with the safe wording', async () => {
    fetchMock.mockResolvedValueOnce(problemResponse(404, 'BOOKING_NOT_FOUND'));
    render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={vi.fn()}
      />,
    );
    expect(await screen.findByText(/Không tìm thấy đặt phòng/)).toBeInTheDocument();
  });

  it('logs out and resets UI to the request form when requested', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BOOKING));
    fetchMock.mockResolvedValueOnce(jsonResponse({ loggedOutAt: '2027-01-10T03:00:00.000Z' }));
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={onLogout}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === 'http://api.local/api/v1/public/guest-access/logout',
      ),
    ).toBe(true);
  });

  it('renders no accessibility violations', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BOOKING));
    const { container } = render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={vi.fn()}
      />,
    );
    await screen.findByText('Main Property');
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
