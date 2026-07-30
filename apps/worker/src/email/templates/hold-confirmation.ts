export interface HoldConfirmationContext {
  readonly bookingCode: string;
  readonly holdExpiresAt: Date;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly adults: number;
  readonly children: number;
  readonly propertyName: string;
  readonly roomTypeName: string;
  readonly finalAmountVnd: number;
  readonly currency: string;
}

export interface RenderedHoldConfirmation {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPE_MAP[character] ?? character);
}

function formatMoney(amountVnd: number, currency: string): string {
  if (currency !== 'VND') {
    throw new Error('Only VND currency is supported in hold-confirmation template');
  }
  return `${amountVnd.toLocaleString('en-US')} VND`;
}

function formatStay(checkIn: Date, checkOut: Date): string {
  return `${checkIn.toISOString()} → ${checkOut.toISOString()}`;
}

function formatGuests(adults: number, children: number): string {
  const adultPart = `${adults} adult${adults === 1 ? '' : 's'}`;
  if (children === 0) {
    return adultPart;
  }
  return `${adultPart}, ${children} child${children === 1 ? '' : 'ren'}`;
}

export function renderHoldConfirmationSubject(context: HoldConfirmationContext): string {
  return `Reservation held: ${context.bookingCode}`;
}

export function renderHoldConfirmationText(context: HoldConfirmationContext): string {
  const lines = [
    `Hello,`,
    ``,
    `Your reservation has been placed on hold.`,
    ``,
    `Booking code: ${context.bookingCode}`,
    `Property: ${context.propertyName}`,
    `Room type: ${context.roomTypeName}`,
    `Stay: ${formatStay(context.checkIn, context.checkOut)}`,
    `Guests: ${formatGuests(context.adults, context.children)}`,
    `Total: ${formatMoney(context.finalAmountVnd, context.currency)}`,
    `Hold expires: ${context.holdExpiresAt.toISOString()}`,
    ``,
    `Please complete confirmation before the hold expires.`,
    `This message contains no payment or login links.`,
  ];
  return lines.join('\n');
}

export function renderHoldConfirmationHtml(context: HoldConfirmationContext): string {
  const safeBookingCode = escapeHtml(context.bookingCode);
  const safePropertyName = escapeHtml(context.propertyName);
  const safeRoomTypeName = escapeHtml(context.roomTypeName);
  const safeHoldExpiresAt = escapeHtml(context.holdExpiresAt.toISOString());
  const safeCheckIn = escapeHtml(context.checkIn.toISOString());
  const safeCheckOut = escapeHtml(context.checkOut.toISOString());
  const safeAdults = escapeHtml(String(context.adults));
  const safeChildren = escapeHtml(String(context.children));
  const safeAmount = escapeHtml(formatMoney(context.finalAmountVnd, context.currency));
  return [
    `<p>Hello,</p>`,
    `<p>Your reservation has been placed on hold.</p>`,
    `<table cellpadding="6" cellspacing="0" border="0">`,
    `<tr><td><strong>Booking code</strong></td><td>${safeBookingCode}</td></tr>`,
    `<tr><td><strong>Property</strong></td><td>${safePropertyName}</td></tr>`,
    `<tr><td><strong>Room type</strong></td><td>${safeRoomTypeName}</td></tr>`,
    `<tr><td><strong>Stay</strong></td><td>${safeCheckIn} &rarr; ${safeCheckOut}</td></tr>`,
    `<tr><td><strong>Guests</strong></td><td>${safeAdults} adults, ${safeChildren} children</td></tr>`,
    `<tr><td><strong>Total</strong></td><td>${safeAmount}</td></tr>`,
    `<tr><td><strong>Hold expires</strong></td><td>${safeHoldExpiresAt}</td></tr>`,
    `</table>`,
    `<p>Please complete confirmation before the hold expires.</p>`,
    `<p>This message contains no payment or login links.</p>`,
  ].join('\n');
}

export function renderHoldConfirmation(context: HoldConfirmationContext): RenderedHoldConfirmation {
  return {
    subject: renderHoldConfirmationSubject(context),
    text: renderHoldConfirmationText(context),
    html: renderHoldConfirmationHtml(context),
  };
}
