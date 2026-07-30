import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminPaymentDetailPage from '../src/app/admin/payments/[paymentId]/page';
import type { AdminPaymentDetail } from '../src/lib/admin-api';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
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

const DETAIL: AdminPaymentDetail = {
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
  attempts: [
    {
      attemptId: 'attempt-1',
      sequence: 1,
      provider: 'MOMO',
      status: 'REVIEW_REQUIRED',
      amountVnd: 500000,
      createdAt: '2027-01-10T03:00:00.000Z',
      completedAt: null,
      failureReason: 'Provider reported ambiguous status',
    },
  ],
  events: [
    {
      eventId: 'event-1',
      eventType: 'PAYMENT_ATTEMPT_REQUESTED',
      provider: 'MOMO',
      actorType: 'GUEST',
      occurredAt: '2027-01-10T03:00:00.000Z',
      summary: 'Khách yêu cầu attempt thanh toán qua MOMO.',
    },
    {
      eventId: 'event-2',
      eventType: 'PAYMENT_PROVIDER_REVIEW_REQUIRED',
      provider: 'MOMO',
      actorType: 'PROVIDER',
      occurredAt: '2027-01-10T03:05:00.000Z',
      summary: 'Provider báo cần admin review.',
    },
  ],
  reconciliation: {
    status: 'AWAITING_REVIEW',
    lastCheckedAt: '2027-01-10T03:05:00.000Z',
    lastReconciledAt: null,
    mismatchedFields: ['amount'],
    note: 'Provider báo lệch số tiền',
  },
  auditTrail: [
    {
      id: 'audit-1',
      eventType: 'PAYMENT_RECONCILIATION_FLAGGED',
      actorType: 'SYSTEM',
      actorId: null,
      occurredAt: '2027-01-10T03:05:00.000Z',
      summary: 'Hệ thống đánh dấu payment cần review.',
    },
  ],
  operationalReview: {
    reviewId: '99999999-9999-4999-8999-999999999999',
    category: 'PAID_CANCELLATION',
    status: 'OPEN',
    openedAt: '2027-01-10T03:06:00.000Z',
    openedReason: 'Payment lệch giữa hệ thống và provider.',
  },
  serverTime: '2027-01-10T03:10:00.000Z',
};

describe('AdminPaymentDetailPage', () => {
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

  it('renders booking, attempts, events, reconciliation and audit trail without leaking provider secrets', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(DETAIL));

    render(<AdminPaymentDetailPage params={{ paymentId: DETAIL.paymentId }} />);

    expect(await screen.findByText('BK-ABCDEF')).toBeInTheDocument();
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('PAYMENT_ATTEMPT_REQUESTED')).toBeInTheDocument();
    expect(screen.getByText('PAYMENT_RECONCILIATION_FLAGGED')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.tagName === 'DD' ? element.textContent === 'Provider báo lệch số tiền' : false,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mở review/)).toBeInTheDocument();
    expect(screen.queryByText(/signature/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rawPayload/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret|token/i)).not.toBeInTheDocument();
  });

  it('does not offer a Mark-succeeded action', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(DETAIL));

    render(<AdminPaymentDetailPage params={{ paymentId: DETAIL.paymentId }} />);
    await screen.findByText('BK-ABCDEF');
    expect(
      screen.queryByRole('button', { name: /Mark succeeded|Đánh dấu thành công/i }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Truy vấn trạng thái nhà cung cấp' }),
    ).toBeInTheDocument();
  });

  it('queries provider status with confirmation and refreshes the detail on success', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(DETAIL))
      .mockResolvedValueOnce(
        jsonResponse({
          paymentId: DETAIL.paymentId,
          provider: 'MOMO',
          status: 'SUCCEEDED',
          previousStatus: 'REVIEW_REQUIRED',
          authoritative: true,
          providerReportedAt: '2027-01-10T03:15:00.000Z',
          amountVnd: 500000,
          currency: 'VND',
          message: 'Provider confirms payment succeeded.',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ...DETAIL, status: 'SUCCEEDED' }));

    const user = userEvent.setup();
    render(<AdminPaymentDetailPage params={{ paymentId: DETAIL.paymentId }} />);
    await screen.findByText('BK-ABCDEF');
    await user.click(screen.getByRole('button', { name: 'Truy vấn trạng thái nhà cung cấp' }));
    expect(
      await screen.findByText(/Hệ thống sẽ gọi nhà cung cấp để truy vấn trạng thái/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xác nhận truy vấn' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const statusCall = fetchMock.mock.calls[1] as [string, RequestInit?];
    expect(statusCall[0]).toBe(
      `http://api.local/api/v1/admin/payments/${DETAIL.paymentId}/status-query`,
    );
    expect(statusCall[1]?.method).toBe('POST');
    expect(statusCall[1]?.credentials).toBe('include');
    expect(await screen.findByText('Provider confirms payment succeeded.')).toBeInTheDocument();
  });

  it('surfaces conflict errors with the reload wording and refreshes the detail', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(DETAIL))
      .mockResolvedValueOnce(
        problemResponse(409, 'PAYMENT_STATUS_CONFLICT', 'Payment đã thay đổi trạng thái.'),
      )
      .mockResolvedValueOnce(jsonResponse(DETAIL));

    const user = userEvent.setup();
    render(<AdminPaymentDetailPage params={{ paymentId: DETAIL.paymentId }} />);
    await screen.findByText('BK-ABCDEF');
    await user.click(screen.getByRole('button', { name: 'Truy vấn trạng thái nhà cung cấp' }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận truy vấn' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(document.body.textContent?.includes('Trạng thái thanh toán đã thay đổi')).toBe(true),
    );
  });

  it('passes accessibility checks', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(DETAIL));

    const { container } = render(
      <AdminPaymentDetailPage params={{ paymentId: DETAIL.paymentId }} />,
    );
    await screen.findByText('BK-ABCDEF');
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
