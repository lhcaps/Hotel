import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BookingApiError, bookingApi } from '../src/lib/booking-api';

interface FetchCall {
  readonly input: RequestInfo | URL;
  readonly init?: RequestInit;
}

function jsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: { 'content-type': 'application/json' },
  });
}

describe('bookingApi', () => {
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

  it('targets the Phase 5 routes exactly with credentials and accept JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        bookingId: '11111111-1111-4111-8111-111111111111',
        bookingCode: 'RM-AB23-CD45-EF67',
        status: 'HOLD',
        checkIn: '2027-01-10T03:00:00.000Z',
        checkOut: '2027-01-10T06:00:00.000Z',
        holdExpiresAt: '2027-01-10T03:15:00.000Z',
        amountVnd: 359000,
        currency: 'VND',
        idempotent: false,
      }),
    );
    await bookingApi.createBookingHold('quote-id', {
      contact: { fullName: 'Nguyen Van A', email: 'guest@example.test', phone: '+84909000000' },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 'HOLD',
        holdExpiresAt: '2027-01-10T03:15:00.000Z',
        serverTime: '2027-01-10T03:00:00.000Z',
      }),
    );
    await bookingApi.getBookingHoldStatus({
      bookingCode: 'RM-AB23-CD45-EF67',
      email: 'guest@example.test',
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        challengeRef: 'A'.repeat(32),
        expiresAt: '2027-01-10T03:10:00.000Z',
        cooldownSeconds: 30,
        serverTime: '2027-01-10T03:00:00.000Z',
      }),
    );
    await bookingApi.requestGuestOtp({
      bookingCode: 'RM-AB23-CD45-EF67',
      email: 'guest@example.test',
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        bookingCode: 'RM-AB23-CD45-EF67',
        expiresAt: '2027-01-10T03:30:00.000Z',
        issuedAt: '2027-01-10T03:00:00.000Z',
      }),
    );
    await bookingApi.verifyGuestOtp({ challengeRef: 'A'.repeat(32), otp: '123456' });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        bookingCode: 'RM-AB23-CD45-EF67',
        status: 'HOLD',
        property: { code: 'MAIN', name: 'Main', timezone: 'Asia/Ho_Chi_Minh' },
        roomType: { code: 'DLX', name: 'Deluxe', maxOccupancy: 3 },
        checkIn: '2027-01-10T03:00:00.000Z',
        checkOut: '2027-01-10T06:00:00.000Z',
        adults: 2,
        children: 0,
        amountVnd: 359000,
        currency: 'VND',
        holdExpiresAt: '2027-01-10T03:15:00.000Z',
        contact: { fullName: 'A', emailMasked: 'a***@example.test', phoneMasked: '+84***000' },
        serverTime: '2027-01-10T03:00:00.000Z',
      }),
    );
    await bookingApi.getGuestBooking('RM-AB23-CD45-EF67');

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        bookingCode: 'RM-AB23-CD45-EF67',
        expiresAt: '2027-01-10T07:00:00.000Z',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" />',
      }),
    );
    await bookingApi.getBookingAccessPass('RM-AB23-CD45-EF67');

    fetchMock.mockResolvedValueOnce(jsonResponse({ loggedOutAt: '2027-01-10T03:00:00.000Z' }));
    await bookingApi.logoutGuestAccess();

    expect(fetchMock.mock.calls).toHaveLength(7);

    const calls = fetchMock.mock.calls.map(([input, init]) => ({
      input,
      init,
    })) as readonly FetchCall[];
    expect(calls[0]?.input).toBe('http://api.local/api/v1/public/quotes/quote-id/bookings');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.credentials).toBe('include');
    expect((calls[0]?.init?.headers as Record<string, string>)['accept']).toBe('application/json');

    expect(calls[1]?.input).toBe('http://api.local/api/v1/public/booking-holds/status');
    expect(calls[1]?.init?.credentials).toBe('include');

    expect(calls[2]?.input).toBe('http://api.local/api/v1/public/guest-access/otp/request');
    expect(calls[2]?.init?.credentials).toBe('include');

    expect(calls[3]?.input).toBe('http://api.local/api/v1/public/guest-access/otp/verify');
    expect(calls[3]?.init?.credentials).toBe('include');

    expect(calls[4]?.input).toBe('http://api.local/api/v1/public/bookings/RM-AB23-CD45-EF67');
    expect(calls[4]?.init?.method).toBe('GET');
    expect(calls[4]?.init?.credentials).toBe('include');

    expect(calls[5]?.input).toBe(
      'http://api.local/api/v1/public/bookings/RM-AB23-CD45-EF67/access-pass',
    );
    expect(calls[5]?.init?.method).toBe('GET');
    expect(calls[5]?.init?.credentials).toBe('include');

    expect(calls[6]?.input).toBe('http://api.local/api/v1/public/guest-access/logout');
    expect(calls[6]?.init?.method).toBe('POST');
    expect(calls[6]?.init?.credentials).toBe('include');
  });

  it('omits any client-authoritative fields from the HOLD request body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        bookingId: '11111111-1111-4111-8111-111111111111',
        bookingCode: 'RM-AB23-CD45-EF67',
        status: 'HOLD',
        checkIn: '2027-01-10T03:00:00.000Z',
        checkOut: '2027-01-10T06:00:00.000Z',
        holdExpiresAt: '2027-01-10T03:15:00.000Z',
        amountVnd: 359000,
        currency: 'VND',
        idempotent: false,
      }),
    );
    await bookingApi.createBookingHold('quote-id', {
      contact: { fullName: 'A', email: 'guest@example.test', phone: '+84909000000' },
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body));
    expect(Object.keys(body)).toEqual(['contact']);
    expect(Object.keys(body.contact)).toEqual(['fullName', 'email', 'phone']);
    expect(body).not.toHaveProperty('price');
    expect(body).not.toHaveProperty('currency');
    expect(body).not.toHaveProperty('roomId');
    expect(body).not.toHaveProperty('roomTypeId');
    expect(body).not.toHaveProperty('holdExpiresAt');
    expect(body).not.toHaveProperty('pricingSnapshot');
  });

  it('parses RFC 7807 problem details into BookingApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          type: 'about:blank',
          title: 'OTP rate limited',
          status: 429,
          code: 'OTP_RATE_LIMITED',
          detail: 'Too many requests',
          requestId: 'req-1',
          errors: [],
        },
        { status: 429, statusText: 'Too Many Requests' },
      ),
    );
    await expect(
      bookingApi.requestGuestOtp({ bookingCode: 'RM-AB23-CD45-EF67', email: 'a@b.test' }),
    ).rejects.toMatchObject({
      status: 429,
      code: 'OTP_RATE_LIMITED',
      message: 'Too many requests',
    });
    await expect(
      bookingApi.requestGuestOtp({ bookingCode: 'RM-AB23-CD45-EF67', email: 'a@b.test' }),
    ).rejects.toBeInstanceOf(BookingApiError);
  });

  it('falls back to a generic problem envelope when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 500, statusText: 'Server Error' }));
    await expect(bookingApi.logoutGuestAccess()).rejects.toBeInstanceOf(BookingApiError);
    try {
      await bookingApi.logoutGuestAccess();
    } catch (error) {
      expect((error as BookingApiError).status).toBe(500);
      expect((error as BookingApiError).problem.title).toBe('Server Error');
    }
  });

  it('does not invent success on error responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          code: 'GUEST_SESSION_REQUIRED',
          detail: 'Session required',
          requestId: 'req-2',
          errors: [],
        },
        { status: 401, statusText: 'Unauthorized' },
      ),
    );
    await expect(bookingApi.getGuestBooking('RM-AB23-CD45-EF67')).rejects.toBeInstanceOf(
      BookingApiError,
    );
  });
});
