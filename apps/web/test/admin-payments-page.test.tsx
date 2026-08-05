import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminPaymentsPage from '../src/app/admin/(protected)/payments/page';
import type { AdminPaymentSummary } from '../src/lib/admin-api';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

const ITEMS: readonly AdminPaymentSummary[] = [
  {
    paymentId: '11111111-1111-4111-8111-111111111111',
    status: 'REVIEW_REQUIRED',
    amountVnd: 500000,
    currency: 'VND',
    confirmationSource: null,
    reviewRequired: true,
    createdAt: '2027-01-10T03:00:00.000Z',
    updatedAt: '2027-01-10T03:05:00.000Z',
    completedAt: null,
    provider: 'MOMO',
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
    latestAttempt: {
      paymentAttemptId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      provider: 'MOMO',
      status: 'REVIEW_REQUIRED',
      initiatedAt: '2027-01-10T03:00:00.000Z',
      completedAt: null,
      amountVnd: 500000,
      currency: 'VND',
      idempotencyKeyMasked: 'payatt_123456',
      providerOrderIdMasked: 'po_123456',
      providerTransactionIdMasked: null,
    },
    providerRef: null,
    operationalReview: null,
  },
  {
    paymentId: '22222222-2222-4222-8222-222222222222',
    status: 'SUCCEEDED',
    amountVnd: 1200000,
    currency: 'VND',
    confirmationSource: 'PROVIDER_EVENT',
    reviewRequired: false,
    createdAt: '2027-01-09T07:55:00.000Z',
    updatedAt: '2027-01-09T08:00:00.000Z',
    completedAt: '2027-01-09T08:00:00.000Z',
    provider: 'VNPAY',
    booking: {
      bookingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      bookingCode: 'BK-GHIJKL',
      bookingStatus: 'CONFIRMED',
      finalAmountVnd: 1200000,
      currency: 'VND',
      contact: {
        fullName: 'Tran Thi B',
        emailMasked: 't*********@example.test',
        phoneMasked: '+84••••01',
      },
    },
    latestAttempt: {
      paymentAttemptId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      provider: 'VNPAY',
      status: 'SUCCEEDED',
      initiatedAt: '2027-01-09T07:55:00.000Z',
      completedAt: '2027-01-09T08:00:00.000Z',
      amountVnd: 1200000,
      currency: 'VND',
      idempotencyKeyMasked: 'payatt_234567',
      providerOrderIdMasked: 'po_234567',
      providerTransactionIdMasked: 'ptxn_234567',
    },
    providerRef: null,
    operationalReview: null,
  },
];

describe('AdminPaymentsPage', () => {
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

  it('renders the payment reconciliation table with safe fields only', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        page: 1,
        pageSize: 20,
        totalItems: 2,
        items: ITEMS,
      }),
    );

    render(<AdminPaymentsPage />);

    expect(await screen.findByText('BK-ABCDEF')).toBeInTheDocument();
    expect(screen.getByText('BK-GHIJKL')).toBeInTheDocument();
    expect(screen.getAllByText('MoMo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VNPay').length).toBeGreaterThan(0);
    expect(screen.getByText(/500\.000\s*₫/)).toBeInTheDocument();
    expect(screen.getAllByText('Cần review').length).toBeGreaterThan(0);
    expect(screen.queryByText('signature')).not.toBeInTheDocument();
    expect(screen.queryByText(/rawPayload/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
  });

  it('paginates forward when clicking "Trang sau" using the latest filters', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          page: 1,
          pageSize: 20,
          totalItems: 25,
          items: ITEMS,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          page: 2,
          pageSize: 20,
          totalItems: 25,
          items: [],
        }),
      );

    const user = userEvent.setup();
    render(<AdminPaymentsPage />);
    await screen.findByText('BK-ABCDEF');
    await user.click(screen.getByRole('button', { name: 'Trang sau' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondCall = fetchMock.mock.calls[1] as [string, RequestInit?];
    expect(secondCall[0]).toBe('http://api.local/api/v1/admin/payments?page=2&pageSize=20');
  });

  it('applies filters via "Áp dụng" and resets via "Đặt lại"', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          page: 1,
          pageSize: 20,
          totalItems: 2,
          items: ITEMS,
        }),
      ),
    );

    const user = userEvent.setup();
    render(<AdminPaymentsPage />);
    await screen.findByText('BK-ABCDEF');

    const choose = async (label: string, option: string) => {
      await user.click(screen.getByRole('combobox', { name: label }));
      await user.click(await screen.findByRole('option', { name: option }));
    };

    await choose('Trạng thái', 'Cần xem xét');
    await choose('Nhà cung cấp', 'MoMo');
    await choose('Review', 'Cần review');
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(
        calls.some(
          (url) =>
            url.includes('status=REVIEW_REQUIRED') &&
            url.includes('provider=MOMO') &&
            url.includes('reviewRequired=true'),
        ),
      ).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: 'Đặt lại' }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(
        calls.some((url) => url === 'http://api.local/api/v1/admin/payments?page=1&pageSize=20'),
      ).toBe(true);
    });
  });

  it('disables pagination buttons at the bounds', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        page: 1,
        pageSize: 20,
        totalItems: 2,
        items: ITEMS,
      }),
    );

    render(<AdminPaymentsPage />);
    await screen.findByText('BK-ABCDEF');
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  });

  it('passes accessibility checks', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        page: 1,
        pageSize: 20,
        totalItems: 2,
        items: ITEMS,
      }),
    );

    const { container } = render(<AdminPaymentsPage />);
    await screen.findByText('BK-ABCDEF');
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
