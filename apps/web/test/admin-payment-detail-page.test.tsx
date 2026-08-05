import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminPaymentDetailPage from '../src/app/admin/(protected)/payments/[paymentId]/page';
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
  status: 'REVIEW_REQUIRED',
  amountVnd: 500000,
  currency: 'VND',
  confirmationSource: null,
  succeededAt: null,
  reviewRequiredAt: '2027-01-10T03:05:00.000Z',
  expiredAt: null,
  createdAt: '2027-01-10T03:00:00.000Z',
  updatedAt: '2027-01-10T03:05:00.000Z',
  cancelledAt: null,
  booking: {
    bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    bookingCode: 'BK-ABCDEF',
    bookingStatus: 'CONFIRMED',
    finalAmountVnd: 500000,
    currency: 'VND',
    contact: {
      fullName: 'Nguyen Van A',
      emailMasked: 'n*********@example.test',
      phoneMasked: '+84••••00',
    },
  },
  providerRef: {
    provider: 'MOMO',
    displayName: 'MoMo',
    configured: true,
    enabled: true,
    environment: 'sandbox',
    checkoutExpiryMinutes: 15,
  },
  attempts: [
    {
      paymentAttemptId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      provider: 'MOMO',
      status: 'REVIEW_REQUIRED',
      initiatedAt: '2027-01-10T03:00:00.000Z',
      currency: 'VND',
      amountVnd: 500000,
      completedAt: null,
      idempotencyKeyMasked: 'payatt_123456',
      providerOrderIdMasked: 'po_123456',
      providerTransactionIdMasked: null,
    },
  ],
  timeline: [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      eventType: 'PAYMENT_ATTEMPT_REQUESTED',
      actorType: 'GUEST',
      actorId: null,
      occurredAt: '2027-01-10T03:00:00.000Z',
      summary: 'Khách yêu cầu attempt thanh toán qua MOMO.',
    },
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      eventType: 'PAYMENT_PROVIDER_REVIEW_REQUIRED',
      actorType: 'PROVIDER',
      actorId: null,
      occurredAt: '2027-01-10T03:05:00.000Z',
      summary: 'Provider báo cần admin review.',
    },
  ],
  reconciliation: {
    status: 'IN_PROGRESS',
    requestedAt: '2027-01-10T03:05:00.000Z',
    requestedBy: null,
    lastAttemptCount: 1,
    lastErrorCode: null,
    lastReconciledAt: null,
    nextEligibleAt: null,
    providerResponse: 'REVIEW_REQUIRED',
  },
  audit: [
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
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
    resolvedAt: null,
    resolvedNote: null,
  },
  serverTime: '2027-01-10T03:10:00.000Z',
};

const RECONCILE_RESPONSE = {
  paymentId: DETAIL.paymentId,
  reconciliation: {
    ...DETAIL.reconciliation,
    status: 'COMPLETED',
    lastAttemptCount: 2,
    providerResponse: 'SUCCESS',
  },
  payment: {
    paymentId: DETAIL.paymentId,
    status: 'SUCCEEDED',
    amountVnd: DETAIL.amountVnd,
    currency: DETAIL.currency,
    confirmationSource: 'PROVIDER_EVENT',
    reviewRequired: false,
    createdAt: DETAIL.createdAt,
    updatedAt: DETAIL.updatedAt,
    completedAt: '2027-01-10T03:15:00.000Z',
    provider: 'MOMO',
    booking: DETAIL.booking,
    latestAttempt: DETAIL.attempts[0],
    providerRef: DETAIL.providerRef,
    operationalReview: DETAIL.operationalReview,
  },
  serverTime: '2027-01-10T03:15:00.000Z',
} as const;

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
    expect(screen.getByText('Yêu cầu lần thử thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Đánh dấu cần đối soát')).toBeInTheDocument();
    expect(screen.getByText('Đang xử lý')).toBeInTheDocument();
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
      .mockResolvedValueOnce(jsonResponse(RECONCILE_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ ...DETAIL, status: 'SUCCEEDED' }));

    const user = userEvent.setup();
    render(<AdminPaymentDetailPage params={{ paymentId: DETAIL.paymentId }} />);
    await screen.findByText('BK-ABCDEF');
    await user.click(screen.getByRole('button', { name: 'Truy vấn trạng thái nhà cung cấp' }));
    expect(
      await screen.findByText(/Hệ thống sẽ gọi nhà cung cấp để đối soát trạng thái/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xác nhận truy vấn' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const statusCall = fetchMock.mock.calls[1] as [string, RequestInit?];
    expect(statusCall[0]).toBe(
      `http://api.local/api/v1/admin/payments/${DETAIL.paymentId}/reconcile`,
    );
    expect(statusCall[1]?.method).toBe('POST');
    expect(statusCall[1]?.credentials).toBe('include');
    expect(await screen.findByText(/Đã gửi yêu cầu đối soát/)).toBeInTheDocument();
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
