import { describe, expect, it } from 'vitest';

import {
  renderBookingConfirmation,
  renderBookingConfirmationSubject,
} from '../../src/email/templates/booking-confirmation.js';

const referenceContext = {
  bookingCode: 'PN-ABCD-1234',
  propertyName: 'PeaceNest & Co.',
  roomTypeName: 'Rose Studio',
  checkIn: new Date('2027-01-10T04:00:00.000Z'),
  checkOut: new Date('2027-01-12T03:00:00.000Z'),
  adults: 2,
  children: 1,
  finalAmountVnd: 1_250_000,
  currency: 'VND',
  provider: 'MOMO' as const,
  confirmedAt: new Date('2027-01-01T03:30:00.000Z'),
};

describe('booking confirmation template', () => {
  it('uses a Vietnamese-first confirmation subject with the booking code', () => {
    expect(renderBookingConfirmationSubject(referenceContext)).toBe(
      'PeaceNest xác nhận đặt phòng · PN-ABCD-1234',
    );
  });

  it('renders the settled stay summary without payment or login links', () => {
    const rendered = renderBookingConfirmation(referenceContext);
    const joined = `${rendered.subject}\n${rendered.text}\n${rendered.html}`;

    expect(joined).toContain('Đặt phòng của bạn đã được xác nhận');
    expect(joined).toContain('Mã đặt phòng: PN-ABCD-1234');
    expect(joined).toContain('1.250.000');
    expect(joined).toContain('MoMo');
    expect(rendered.html).toContain('max-width:600px');
    expect(joined.toLowerCase()).not.toMatch(/href=|https?:\/\/|login|thanh toán ngay/);
  });

  it('escapes customer-visible values in the responsive HTML', () => {
    const rendered = renderBookingConfirmation({
      ...referenceContext,
      propertyName: 'PeaceNest <script>alert(1)</script>',
    });

    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.html).not.toContain('<script>');
  });

  it('rejects a non-VND confirmation', () => {
    expect(() => renderBookingConfirmation({ ...referenceContext, currency: 'USD' })).toThrow(
      /VND/,
    );
  });
});
