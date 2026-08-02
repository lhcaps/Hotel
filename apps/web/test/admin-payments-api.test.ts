import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiError, adminApi } from '../src/lib/admin-api';

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

function problemResponse(status: number, code: string, detail: string): Response {
  return jsonResponse(
    {
      type: 'about:blank',
      title: 'Error',
      status,
      code,
      detail,
      requestId: 'req-x',
      errors: [],
    },
    { status },
  );
}

describe('adminApi payment routes', () => {
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

  it('lists payments with credentials and serialises filters into the query string', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        page: 2,
        pageSize: 20,
        totalItems: 47,
        totalPages: 3,
        items: [],
      }),
    );

    await adminApi.listPayments({
      page: 2,
      pageSize: 20,
      status: 'REVIEW_REQUIRED',
      provider: 'MOMO',
      bookingCode: 'BK-ABCDEF',
      needsReview: true,
      createdFrom: '2027-01-01',
      createdTo: '2027-01-31',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    const input = firstCall?.[0];
    const init = firstCall?.[1];
    expect(input).toBe(
      'http://api.local/api/v1/admin/payments?page=2&pageSize=20&status=REVIEW_REQUIRED&provider=MOMO&bookingCode=BK-ABCDEF&needsReview=true&createdFrom=2027-01-01&createdTo=2027-01-31',
    );
    expect(init?.credentials).toBe('include');
    expect((init?.headers as Record<string, string>)['accept']).toBe('application/json');
  });

  it('omits empty filters from the payments list query string', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1, items: [] }),
    );

    await adminApi.listPayments({ page: 1, pageSize: 20 });

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe('http://api.local/api/v1/admin/payments?page=1&pageSize=20');
  });

  it('fetches the payment detail with credentials', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        paymentId: '11111111-1111-4111-8111-111111111111',
        bookingCode: 'BK-ABCDEF',
        provider: 'MOMO',
        status: 'REVIEW_REQUIRED',
        amountVnd: 500000,
        currency: 'VND',
        createdAt: '2027-01-10T03:00:00.000Z',
        updatedAt: '2027-01-10T03:05:00.000Z',
        confirmedAt: null,
        cancelledAt: null,
        booking: {
          bookingCode: 'BK-ABCDEF',
          status: 'CONFIRMED',
          checkIn: '2027-01-12T03:00:00.000Z',
          checkOut: '2027-01-13T03:00:00.000Z',
          guestName: 'Nguyen Van A',
          finalAmountVnd: 500000,
          currency: 'VND',
        },
        attempts: [],
        events: [],
        reconciliation: {
          status: 'AWAITING_REVIEW',
          lastCheckedAt: '2027-01-10T03:05:00.000Z',
          lastReconciledAt: null,
          mismatchedFields: ['amount'],
          note: 'Provider reported different amount',
        },
        auditTrail: [],
        operationalReview: null,
        serverTime: '2027-01-10T03:10:00.000Z',
      }),
    );

    const detail = await adminApi.getPayment('11111111-1111-4111-8111-111111111111');

    expect(detail.paymentId).toBe('11111111-1111-4111-8111-111111111111');
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe(
      'http://api.local/api/v1/admin/payments/11111111-1111-4111-8111-111111111111',
    );
    expect(firstCall?.[1]?.credentials).toBe('include');
  });

  it('queues a coupon delivery with a caller-provided idempotency key', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 201 }));

    await adminApi.sendAdminBookingCoupons(
      'BK-ABCDEF',
      ['WELCOME10', 'STAY20'],
      'request-1234567890',
    );

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe('http://api.local/api/v1/admin/bookings/BK-ABCDEF/send-coupons');
    expect(firstCall?.[1]?.method).toBe('POST');
    expect((firstCall?.[1]?.headers as Record<string, string>)['idempotency-key']).toBe(
      'request-1234567890',
    );
    expect(firstCall?.[1]?.body).toBe(JSON.stringify({ couponCodes: ['WELCOME10', 'STAY20'] }));
  });

  it('sends a scanned booking access pass only to the ADMIN scanner endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ bookingCode: 'BK-ABCDEF', status: 'CONFIRMED', action: 'check-in' }),
    );

    await adminApi.scanBookingAccessPass('signed-pass-value');

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe('http://api.local/api/v1/admin/booking-access-passes/scan');
    expect(firstCall?.[1]?.method).toBe('POST');
    expect(firstCall?.[1]?.credentials).toBe('include');
    expect(firstCall?.[1]?.body).toBe(JSON.stringify({ value: 'signed-pass-value' }));
  });

  it('queries the payment status with POST and an empty body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        paymentId: '11111111-1111-4111-8111-111111111111',
        provider: 'MOMO',
        status: 'SUCCEEDED',
        previousStatus: 'PENDING',
        authoritative: true,
        providerReportedAt: '2027-01-10T03:15:00.000Z',
        amountVnd: 500000,
        currency: 'VND',
        message: 'Provider confirms payment succeeded',
      }),
    );

    const result = await adminApi.queryPaymentStatus('11111111-1111-4111-8111-111111111111');

    expect(result.status).toBe('SUCCEEDED');
    expect(result.authoritative).toBe(true);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe(
      'http://api.local/api/v1/admin/payments/11111111-1111-4111-8111-111111111111/status-query',
    );
    expect(firstCall?.[1]?.method).toBe('POST');
    expect(firstCall?.[1]?.credentials).toBe('include');
    expect((firstCall?.[1]?.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    );
    expect(firstCall?.[1]?.body).toBe('{}');
  });

  it('surfaces AdminApiError with problem details for non-2xx responses', async () => {
    fetchMock.mockResolvedValue(
      problemResponse(409, 'PAYMENT_STATUS_CONFLICT', 'Payment đã thay đổi trạng thái.'),
    );

    let caught: unknown;
    try {
      await adminApi.queryPaymentStatus('pay-1');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AdminApiError);
    expect((caught as AdminApiError).problem.code).toBe('PAYMENT_STATUS_CONFLICT');
    expect((caught as AdminApiError).problem.detail).toBe('Payment đã thay đổi trạng thái.');
  });
});
