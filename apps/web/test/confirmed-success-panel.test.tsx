import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import type { BookingDetailResponse, PaymentStatusResponse } from '@room/contracts';

import { ConfirmedSuccessPanel } from '../src/components/confirmed-success-panel';
import { LocaleProvider } from '../src/components/locale-provider';

const BOOKING: BookingDetailResponse = {
  bookingCode: 'RM-AB23-CD45-EF67',
  status: 'CONFIRMED',
  property: { code: 'MAIN', name: 'Main Property', timezone: 'Asia/Ho_Chi_Minh' },
  roomType: { code: 'DLX', name: 'Deluxe', maxOccupancy: 3 },
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  adults: 2,
  children: 0,
  amountVnd: 359000,
  currency: 'VND',
  holdExpiresAt: null,
  contact: {
    fullName: 'Guest Example',
    emailMasked: 'g***@example.test',
    phoneMasked: '+84***000',
  },
  serverTime: '2027-01-10T03:00:00.000Z',
};

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

describe('ConfirmedSuccessPanel', () => {
  it('renders the Vietnamese Đặt phòng thành công heading', () => {
    render(
      <LocaleProvider locale="vi">
        <ConfirmedSuccessPanel booking={BOOKING} payment={PAYMENT} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('confirmed-success-heading')).toHaveTextContent(
      'Đặt phòng thành công',
    );
  });

  it('renders English booking confirmed heading under the en locale', () => {
    render(
      <LocaleProvider locale="en">
        <ConfirmedSuccessPanel booking={BOOKING} payment={PAYMENT} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('confirmed-success-heading')).toHaveTextContent('Booking confirmed');
  });

  it('never exposes physical room identifiers or internal payment details', () => {
    const { container } = render(
      <LocaleProvider locale="vi">
        <ConfirmedSuccessPanel booking={{ ...BOOKING }} payment={{ ...PAYMENT, amountVnd: 0 }} />
      </LocaleProvider>,
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/roomNumber/i);
    expect(text).not.toMatch(/signature/i);
    expect(text).not.toMatch(/paymentAttemptId/i);
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <LocaleProvider locale="vi">
        <ConfirmedSuccessPanel booking={BOOKING} payment={PAYMENT} />
      </LocaleProvider>,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
