import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingHoldResponse } from '@room/contracts';

import { HoldSuccessPanel } from '../src/components/hold-success-panel';

const HOLD: BookingHoldResponse = {
  bookingId: '22222222-2222-4222-8222-222222222222',
  bookingCode: 'RM-AB23-CD45-EF67',
  status: 'HOLD',
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  holdExpiresAt: '2027-01-10T03:15:00.000Z',
  amountVnd: 309000,
  currency: 'VND',
  idempotent: false,
};

const HOLD_WITH_COUPON: BookingHoldResponse = {
  ...HOLD,
  amountVnd: 309000,
  coupon: {
    code: 'SUMMER-50K',
    discountType: 'FIXED',
    grossAmountVnd: 359000,
    discountAmountVnd: 50000,
    finalAmountVnd: 309000,
  },
};

describe('HoldSuccessPanel coupon summary', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2027-01-10T03:00:00.000Z'));
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders no coupon summary when hold.coupon is absent', () => {
    render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD}
        onManageBooking={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('hold-coupon-summary')).toBeNull();
  });

  it('renders the safe coupon summary when the hold includes one', () => {
    render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD_WITH_COUPON}
        onManageBooking={vi.fn()}
      />,
    );
    const summary = screen.getByTestId('hold-coupon-summary');
    expect(summary).toHaveTextContent('SUMMER-50K');
    expect(summary).toHaveTextContent('359.000');
    expect(summary).toHaveTextContent('50.000');
    expect(summary).toHaveTextContent('309.000');
    expect(summary.textContent ?? '').not.toMatch(/digest|uuid|quota/i);
    expect(summary.textContent ?? '').not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it('still navigates to the manage page when the action button is pressed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onManageBooking = vi.fn();
    render(
      <HoldSuccessPanel
        bookingCode="RM-AB23-CD45-EF67"
        email="guest@example.test"
        hold={HOLD_WITH_COUPON}
        onManageBooking={onManageBooking}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Quản lý đặt phòng' }));
    expect(onManageBooking).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
