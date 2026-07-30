export interface BookingConfirmationContext {
  readonly bookingCode: string;
  readonly propertyName: string;
  readonly roomTypeName: string;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly adults: number;
  readonly children: number;
  readonly finalAmountVnd: number;
  readonly currency: string;
  readonly provider: 'MOMO' | 'VNPAY';
  readonly confirmedAt: Date;
}

export interface RenderedBookingConfirmation {
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
    throw new Error('Only VND currency is supported in booking-confirmation template');
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

const PROVIDER_LABEL: Record<'MOMO' | 'VNPAY', string> = {
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
};

export function renderBookingConfirmationSubject(context: BookingConfirmationContext): string {
  return `Booking confirmed: ${context.bookingCode}`;
}

export function renderBookingConfirmationText(context: BookingConfirmationContext): string {
  const lines = [
    `Hello,`,
    ``,
    `Your reservation has been confirmed.`,
    ``,
    `Booking code: ${context.bookingCode}`,
    `Property: ${context.propertyName}`,
    `Room type: ${context.roomTypeName}`,
    `Stay: ${formatStay(context.checkIn, context.checkOut)}`,
    `Guests: ${formatGuests(context.adults, context.children)}`,
    `Total paid: ${formatMoney(context.finalAmountVnd, context.currency)}`,
    `Payment provider: ${PROVIDER_LABEL[context.provider]}`,
    `Confirmed at: ${context.confirmedAt.toISOString()}`,
    ``,
    `Please keep this email for your records. No payment or login links are included.`,
  ];
  return lines.join('\n');
}

export function renderBookingConfirmationHtml(context: BookingConfirmationContext): string {
  const safeBookingCode = escapeHtml(context.bookingCode);
  const safePropertyName = escapeHtml(context.propertyName);
  const safeRoomTypeName = escapeHtml(context.roomTypeName);
  const safeCheckIn = escapeHtml(context.checkIn.toISOString());
  const safeCheckOut = escapeHtml(context.checkOut.toISOString());
  const safeAdults = escapeHtml(String(context.adults));
  const safeChildren = escapeHtml(String(context.children));
  const safeAmount = escapeHtml(formatMoney(context.finalAmountVnd, context.currency));
  const safeProvider = escapeHtml(PROVIDER_LABEL[context.provider]);
  const safeConfirmedAt = escapeHtml(context.confirmedAt.toISOString());
  return [
    `<p>Hello,</p>`,
    `<p>Your reservation has been confirmed.</p>`,
    `<table cellpadding="6" cellspacing="0" border="0">`,
    `<tr><td><strong>Booking code</strong></td><td>${safeBookingCode}</td></tr>`,
    `<tr><td><strong>Property</strong></td><td>${safePropertyName}</td></tr>`,
    `<tr><td><strong>Room type</strong></td><td>${safeRoomTypeName}</td></tr>`,
    `<tr><td><strong>Stay</strong></td><td>${safeCheckIn} &rarr; ${safeCheckOut}</td></tr>`,
    `<tr><td><strong>Guests</strong></td><td>${safeAdults} adults, ${safeChildren} children</td></tr>`,
    `<tr><td><strong>Total paid</strong></td><td>${safeAmount}</td></tr>`,
    `<tr><td><strong>Payment provider</strong></td><td>${safeProvider}</td></tr>`,
    `<tr><td><strong>Confirmed at</strong></td><td>${safeConfirmedAt}</td></tr>`,
    `</table>`,
    `<p>Please keep this email for your records. No payment or login links are included.</p>`,
  ].join('\n');
}

export function renderBookingConfirmation(
  context: BookingConfirmationContext,
): RenderedBookingConfirmation {
  return {
    subject: renderBookingConfirmationSubject(context),
    text: renderBookingConfirmationText(context),
    html: renderBookingConfirmationHtml(context),
  };
}
