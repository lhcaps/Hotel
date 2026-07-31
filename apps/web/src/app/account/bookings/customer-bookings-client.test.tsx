/**
 * Regression coverage for the customer account bookings surface. The page
 * used to be a Server Component that forwarded `headers().get('cookie')`
 * to the API. Because the Better Auth session cookie lives on the API
 * origin (`localhost:3001`) and the web origin (`localhost:3000`) does
 * not receive it, that approach returned 401 immediately after OAuth.
 *
 * The fix converts the page to a client component that fetches the API
 * directly with `credentials: 'include'` so the browser forwards the
 * session cookie regardless of host scope. These tests pin the contract:
 *
 * - The fetch URL is the canonical `NEXT_PUBLIC_API_BASE_URL` origin.
 * - The fetch is invoked with `credentials: 'include'`.
 * - A 401 response renders the login-required state (not the empty list).
 * - A 200 response with items renders the booking rows.
 * - A 200 response with zero items renders the truthful empty state.
 *
 * The test does not assert on the actual auth state because Better Auth
 * is not part of the unit surface; instead it proves that the component
 * delegates cookie forwarding to the browser rather than relying on the
 * Server Component `Cookie` header.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '../../../components/locale-provider';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.stubGlobal('fetch', fetchMock);

import { CustomerBookingsClient } from './customer-bookings-client';

const ORIGINAL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const CANONICAL_API_BASE = 'http://localhost:3001/api/v1';

function renderWithLocale() {
  return render(
    <LocaleProvider locale="vi">
      <CustomerBookingsClient />
    </LocaleProvider>,
  );
}

describe('CustomerBookingsClient', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = CANONICAL_API_BASE;
    fetchMock.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL_API_BASE;
  });

  it('targets the canonical API origin with credentials: include', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderWithLocale();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${new URL(CANONICAL_API_BASE).origin}/api/v1/customer/bookings?limit=20`);
    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
  });

  it('renders the login-required state when the API returns 401', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'CUSTOMER_SESSION_REQUIRED' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderWithLocale();

    await waitFor(() => {
      expect(screen.getByText(/Bạn cần đăng nhập để xem các đặt phòng/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Bạn chưa có đặt phòng nào/i)).toBeNull();
  });

  it('renders the truthful empty state when the API returns 200 with no items', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderWithLocale();

    await waitFor(() => {
      expect(screen.getByText(/Bạn chưa có đặt phòng nào liên kết với tài khoản/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Bạn cần đăng nhập/i)).toBeNull();
  });

  it('renders booking rows when the API returns 200 with items', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              bookingId: 'a1',
              bookingCode: 'BK-1001',
              status: 'CONFIRMED',
              checkIn: '2026-08-01T11:00:00.000Z',
              checkOut: '2026-08-01T14:00:00.000Z',
              currency: 'VND',
              finalAmountVnd: '500000',
              createdAt: '2026-07-31T00:00:00.000Z',
            },
          ],
          nextCursor: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    renderWithLocale();

    await waitFor(() => {
      expect(screen.getByText('BK-1001')).toBeTruthy();
    });
  });

  it('renders the load-error state when the API returns a non-401 failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'INTERNAL' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderWithLocale();

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải danh sách đặt phòng/i)).toBeTruthy();
    });
  });
});
