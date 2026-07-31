import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentStatusResponse } from '@room/contracts';

import { PaymentStatusSummary } from '../src/components/payment-status-summary';
import { LocaleProvider } from '../src/components/locale-provider';

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

const NOT_STARTED: PaymentStatusResponse = {
  ...PAYMENT,
  paymentStatus: 'NOT_STARTED',
  attemptStatus: 'NOT_STARTED',
  bookingStatus: 'HOLD',
  completedAt: null,
};

const { getPaymentStatus } = vi.hoisted(() => ({
  getPaymentStatus: vi.fn(),
}));

vi.mock('../src/lib/booking-api', () => ({
  bookingApi: {
    getPaymentStatus,
  },
}));

describe('PaymentStatusSummary', () => {
  beforeEach(() => {
    getPaymentStatus.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the visible LOADING placeholder while the initial request is pending', () => {
    getPaymentStatus.mockReturnValue(new Promise(() => {}));
    render(
      <LocaleProvider locale="vi">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('payment-status-loading')).toBeVisible();
    expect(screen.getByTestId('payment-status-loading-text')).toHaveTextContent(
      'Đang kiểm tra thanh toán',
    );
    expect(screen.getByTestId('payment-status-loading-skeleton')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trạng thái thanh toán' })).toBeVisible();
  });

  it('renders the loaded state with the persisted status fields once the request succeeds', async () => {
    getPaymentStatus.mockResolvedValue(PAYMENT);
    render(
      <LocaleProvider locale="en">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('payment-status-summary')).toBeVisible();
    });
    expect(screen.getByTestId('payment-status-summary')).toHaveTextContent('MOMO');
    expect(screen.getByTestId('payment-status-summary')).toHaveTextContent('Payment status');
    expect(screen.queryByTestId('payment-status-loading')).not.toBeInTheDocument();
  });

  it('renders the loaded state when the request resolves with NOT_STARTED so the provider selector stays usable', async () => {
    getPaymentStatus.mockResolvedValue(NOT_STARTED);
    render(
      <LocaleProvider locale="vi">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('payment-status-summary')).toBeVisible();
    });
    // NOT_STARTED is not a known booking status enum, so the component renders
    // the unknown translation rather than vanishing. The important contract is
    // that the summary section stays visible and does not fall back to the
    // LOAD_ERROR placeholder.
    expect(screen.getByTestId('payment-status-summary')).toHaveTextContent('MOMO');
    expect(screen.queryByTestId('payment-status-load-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment-status-loading')).not.toBeInTheDocument();
  });

  it('surfaces a visible LOAD_ERROR block with a retry control when the initial request fails', async () => {
    getPaymentStatus.mockRejectedValue(new Error('boom'));
    render(
      <LocaleProvider locale="vi">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('payment-status-load-error')).toBeVisible();
    });
    expect(screen.getByTestId('payment-status-load-error-text')).toHaveTextContent(
      'Không thể tải trạng thái thanh toán',
    );
    expect(screen.queryByTestId('payment-status-summary')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trạng thái thanh toán' })).toBeVisible();
  });

  it('replaces the LOAD_ERROR with the loaded state when the retry succeeds', async () => {
    getPaymentStatus.mockRejectedValueOnce(new Error('boom'));
    render(
      <LocaleProvider locale="en">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('payment-status-load-error')).toBeVisible();
    });
    getPaymentStatus.mockResolvedValueOnce(PAYMENT);
    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByTestId('payment-status-load-error-retry'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('payment-status-summary')).toBeVisible();
    });
    expect(screen.queryByTestId('payment-status-load-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('payment-status-summary')).toHaveTextContent('MOMO');
  });
});
