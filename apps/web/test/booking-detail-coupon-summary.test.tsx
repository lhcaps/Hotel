import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingDetailResponse } from '@room/contracts';

import { BookingDetailPanel } from '../src/components/booking-detail-panel';

const DETAIL: BookingDetailResponse = {
  bookingCode: 'RM-AB23-CD45-EF67',
  status: 'HOLD',
  property: { code: 'PROP-1', name: 'Aurora Hotel', timezone: 'Asia/Ho_Chi_Minh' },
  roomType: { code: 'RT-DLX', name: 'Deluxe', maxOccupancy: 3 },
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  adults: 2,
  children: 0,
  amountVnd: 359000,
  currency: 'VND',
  holdExpiresAt: '2027-01-10T03:15:00.000Z',
  contact: {
    fullName: 'Nguyen Van A',
    emailMasked: 'n****n@example.test',
    phoneMasked: '+84••••00',
  },
  serverTime: '2027-01-10T03:00:00.000Z',
};

const DETAIL_WITH_COUPON: BookingDetailResponse = {
  ...DETAIL,
  amountVnd: 309000,
  coupon: {
    code: 'SUMMER-50K',
    discountType: 'FIXED',
    grossAmountVnd: 359000,
    discountAmountVnd: 50000,
    finalAmountVnd: 309000,
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('BookingDetailPanel coupon summary', () => {
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

  it('renders no coupon summary when the detail response does not include one', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(DETAIL));
    render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Chi tiết đặt phòng')).toBeInTheDocument());
    expect(screen.queryByTestId('detail-coupon-summary')).toBeNull();
  });

  it('renders the safe coupon summary when the booking has an active application', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(DETAIL_WITH_COUPON));
    render(
      <BookingDetailPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        onLogout={vi.fn()}
      />,
    );
    const summary = await screen.findByTestId('detail-coupon-summary');
    expect(summary).toHaveTextContent('SUMMER-50K');
    expect(summary).toHaveTextContent('359.000');
    expect(summary).toHaveTextContent('50.000');
    expect(summary).toHaveTextContent('309.000');
    expect(summary.textContent ?? '').not.toMatch(/digest|uuid|quota/i);
    expect(summary.textContent ?? '').not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});
