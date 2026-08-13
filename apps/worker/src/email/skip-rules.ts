export type SkipReason =
  | 'HOLD_EMAIL_DISABLED'
  | 'BOOKING_EXPIRED'
  | 'BOOKING_GONE'
  | 'CONTEXT_MISSING'
  | 'ALREADY_SENT'
  | 'UNSUPPORTED_EVENT_TYPE'
  | 'CONTACT_MISSING'
  | 'ARRIVAL_CONFIG_INCOMPLETE'
  | 'CHALLENGE_GONE'
  | 'CHALLENGE_CONSUMED'
  | 'CHALLENGE_REPLACED'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_ATTEMPTS_EXHAUSTED'
  | 'EMAIL_DIGEST_MISMATCH'
  | 'CONTACT_GONE'
  | 'BOOKING_NOT_ACCESSIBLE'
  | 'OTP_TEMPLATE_RENDER_FAILED';

export interface SkipRule {
  readonly reason: SkipReason;
  readonly description: string;
}

export interface BookingHoldContext {
  readonly bookingStatus: string;
  readonly contactId: string | null;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly holdExpiresAt: Date;
}

export type EventType = 'booking.hold.created' | 'booking.hold.expired';

export interface SkipDecision {
  readonly skip: boolean;
  readonly reason: SkipReason | null;
}

export function decideHoldCreatedSkip(
  context: BookingHoldContext,
  currentTime: Date,
): SkipDecision {
  if (context.bookingStatus === 'EXPIRED') {
    return { skip: true, reason: 'BOOKING_EXPIRED' };
  }
  if (context.contactId === null) {
    return { skip: true, reason: 'CONTACT_MISSING' };
  }
  if (context.holdExpiresAt.getTime() <= currentTime.getTime()) {
    return { skip: true, reason: 'BOOKING_EXPIRED' };
  }
  return { skip: false, reason: null };
}

export function decideHoldExpiredSkip(): SkipDecision {
  return { skip: true, reason: 'UNSUPPORTED_EVENT_TYPE' };
}

export function decideSkipForEvent(
  eventType: string,
  context: BookingHoldContext,
  currentTime: Date,
): SkipDecision {
  if (eventType === 'booking.hold.created') {
    return decideHoldCreatedSkip(context, currentTime);
  }
  if (eventType === 'booking.hold.expired') {
    return decideHoldExpiredSkip();
  }
  return { skip: true, reason: 'UNSUPPORTED_EVENT_TYPE' };
}
