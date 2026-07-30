import { describe, expect, it } from 'vitest';

import {
  decideHoldCreatedSkip,
  decideHoldExpiredSkip,
  decideSkipForEvent,
  type BookingHoldContext,
} from '../../src/email/skip-rules.js';

const referenceContext: BookingHoldContext = {
  bookingStatus: 'HOLD',
  contactId: '00000000-0000-4000-8000-000000000001',
  checkIn: new Date('2027-01-10T04:00:00.000Z'),
  checkOut: new Date('2027-01-10T07:00:00.000Z'),
  holdExpiresAt: new Date('2027-01-10T03:45:00.000Z'),
};

describe('skip rules', () => {
  it('does not skip a healthy hold-created event', () => {
    const decision = decideHoldCreatedSkip(referenceContext, new Date('2027-01-10T03:00:00.000Z'));
    expect(decision).toEqual({ skip: false, reason: null });
  });

  it('skips a hold-created event when the booking is already EXPIRED', () => {
    const decision = decideHoldCreatedSkip(
      { ...referenceContext, bookingStatus: 'EXPIRED' },
      new Date('2027-01-10T03:00:00.000Z'),
    );
    expect(decision).toEqual({ skip: true, reason: 'BOOKING_EXPIRED' });
  });

  it('skips a hold-created event when the contact is missing', () => {
    const decision = decideHoldCreatedSkip(
      { ...referenceContext, contactId: null },
      new Date('2027-01-10T03:00:00.000Z'),
    );
    expect(decision).toEqual({ skip: true, reason: 'CONTACT_MISSING' });
  });

  it('skips a hold-created event when the hold has already expired', () => {
    const decision = decideHoldCreatedSkip(referenceContext, new Date('2027-01-10T03:46:00.000Z'));
    expect(decision).toEqual({ skip: true, reason: 'BOOKING_EXPIRED' });
  });

  it('skips hold-expired events for the deadline vertical slice', () => {
    expect(decideHoldExpiredSkip()).toEqual({
      skip: true,
      reason: 'UNSUPPORTED_EVENT_TYPE',
    });
  });

  it('rejects unknown event types explicitly', () => {
    const decision = decideSkipForEvent(
      'booking.unknown.event',
      referenceContext,
      new Date('2027-01-10T03:00:00.000Z'),
    );
    expect(decision).toEqual({ skip: true, reason: 'UNSUPPORTED_EVENT_TYPE' });
  });
});
