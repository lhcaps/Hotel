import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  renderHoldConfirmation,
  renderHoldConfirmationHtml,
  renderHoldConfirmationSubject,
  renderHoldConfirmationText,
} from '../../src/email/templates/hold-confirmation.js';

const referenceContext = {
  bookingCode: 'RM-ABCD-1234-EFGH',
  holdExpiresAt: new Date('2027-01-10T03:45:00.000Z'),
  checkIn: new Date('2027-01-10T04:00:00.000Z'),
  checkOut: new Date('2027-01-10T07:00:00.000Z'),
  adults: 2,
  children: 1,
  propertyName: 'Hanoi Boutique',
  roomTypeName: 'Deluxe Suite',
  finalAmountVnd: 1_000_000,
  currency: 'VND',
} as const;

describe('hold-confirmation template', () => {
  it('exposes the booking code and hold expiry in the subject', () => {
    expect(renderHoldConfirmationSubject(referenceContext)).toBe(
      'Reservation held: RM-ABCD-1234-EFGH',
    );
  });

  it('exposes the booking code and hold expiry in the plain text version', () => {
    const text = renderHoldConfirmationText(referenceContext);
    expect(text).toContain('Booking code: RM-ABCD-1234-EFGH');
    expect(text).toContain('Hold expires: 2027-01-10T03:45:00.000Z');
    expect(text).toContain('Total: 1,000,000 VND');
  });

  it('includes a safe HTML version with escaped values', () => {
    const html = renderHoldConfirmationHtml({
      ...referenceContext,
      bookingCode: '<script>alert(1)</script>',
      propertyName: 'Hanoi "Boutique" & Co.',
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Hanoi &quot;Boutique&quot; &amp; Co.');
    expect(html).not.toContain('<script>');
  });

  it('does not include contact phone, OTP, secret or stack trace', () => {
    const rendered = renderHoldConfirmation(referenceContext);
    const joined = `${rendered.subject}\n${rendered.text}\n${rendered.html}`;
    expect(joined.toLowerCase()).not.toMatch(/otp|token|secret|stack|exception/);
    expect(joined).not.toContain('+84');
    expect(joined).not.toContain('phone');
  });

  it('does not include any internal ID beyond the booking code', () => {
    const rendered = renderHoldConfirmation(referenceContext);
    expect(rendered.text).not.toContain('quoteId');
    expect(rendered.text).not.toContain('correlationId');
    expect(rendered.text).not.toContain('roomId');
  });

  it('escapes character class output correctly', () => {
    expect(escapeHtml('<a href="b">c</a>')).toBe('&lt;a href=&quot;b&quot;&gt;c&lt;/a&gt;');
  });

  it('rejects non-VND currency', () => {
    expect(() => renderHoldConfirmation({ ...referenceContext, currency: 'USD' })).toThrow(/VND/);
  });
});
