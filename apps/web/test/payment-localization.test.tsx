import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '../src/components/locale-provider';
import { PaymentProviderSelector } from '../src/components/payment-provider-selector';
import { PaymentStatusSummary } from '../src/components/payment-status-summary';

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('public payment localization', () => {
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

  it('renders English provider selection while preserving MoMo and VNPAY names', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        {
          provider: 'MOMO',
          displayName: 'MoMo',
          displayOrder: 1,
          checkoutExpiryMinutes: 15,
          maintenanceMessage: null,
          enabled: true,
          unavailableReason: null,
          environment: 'sandbox',
        },
        {
          provider: 'VNPAY',
          displayName: 'VNPAY',
          displayOrder: 2,
          checkoutExpiryMinutes: 15,
          maintenanceMessage: null,
          enabled: true,
          unavailableReason: null,
          environment: 'sandbox',
        },
      ]),
    );

    render(
      <LocaleProvider locale="en">
        <PaymentProviderSelector bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay with MoMo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay with VNPAY' })).toBeInTheDocument();
  });

  it('maps canonical payment statuses to English presentation labels', async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        bookingCode: 'RM-AB23-CD45-EF67',
        bookingStatus: 'HOLD',
        paymentStatus: 'REVIEW_REQUIRED',
        attemptStatus: 'FAILED',
        provider: 'MOMO',
        customerMessage: null,
      }),
    );

    render(
      <LocaleProvider locale="en">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByText('Review required')).toBeInTheDocument());
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Hold')).toBeInTheDocument();
  });
});
