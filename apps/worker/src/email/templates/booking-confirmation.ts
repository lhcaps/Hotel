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
  return `${amountVnd.toLocaleString('vi-VN')} VND`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(value);
}

function formatStay(checkIn: Date, checkOut: Date): string {
  return `${formatDateTime(checkIn)} → ${formatDateTime(checkOut)}`;
}

function formatGuests(adults: number, children: number): string {
  const adultPart = `${adults} người lớn`;
  return children === 0 ? adultPart : `${adultPart}, ${children} trẻ em`;
}

const PROVIDER_LABEL: Record<'MOMO' | 'VNPAY', string> = {
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
};

export function renderBookingConfirmationSubject(context: BookingConfirmationContext): string {
  return `PeaceNest xác nhận đặt phòng · ${context.bookingCode}`;
}

export function renderBookingConfirmationText(context: BookingConfirmationContext): string {
  return [
    'Xin chào,',
    '',
    'Đặt phòng của bạn đã được xác nhận sau khi thanh toán thành công.',
    '',
    `Mã đặt phòng: ${context.bookingCode}`,
    `Nơi lưu trú: ${context.propertyName}`,
    `Hạng phòng: ${context.roomTypeName}`,
    `Thời gian lưu trú: ${formatStay(context.checkIn, context.checkOut)}`,
    `Số khách: ${formatGuests(context.adults, context.children)}`,
    `Tổng thanh toán: ${formatMoney(context.finalAmountVnd, context.currency)}`,
    `Thanh toán qua: ${PROVIDER_LABEL[context.provider]}`,
    `Xác nhận lúc: ${formatDateTime(context.confirmedAt)}`,
    '',
    'Vui lòng lưu lại email này. Thông tin nhận phòng sẽ được gửi khi đến thời điểm phù hợp.',
    '',
    'Your booking is confirmed. Please keep this email for your records.',
  ].join('\n');
}

export function renderBookingConfirmationHtml(context: BookingConfirmationContext): string {
  const safeBookingCode = escapeHtml(context.bookingCode);
  const safePropertyName = escapeHtml(context.propertyName);
  const safeRoomTypeName = escapeHtml(context.roomTypeName);
  const safeStay = escapeHtml(formatStay(context.checkIn, context.checkOut));
  const safeGuests = escapeHtml(formatGuests(context.adults, context.children));
  const safeAmount = escapeHtml(formatMoney(context.finalAmountVnd, context.currency));
  const safeProvider = escapeHtml(PROVIDER_LABEL[context.provider]);
  const safeConfirmedAt = escapeHtml(formatDateTime(context.confirmedAt));
  return [
    '<div style="margin:0;padding:24px;background:#f4f1ea;font-family:Arial,sans-serif;color:#1f2b23">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">',
    '<tr><td style="padding:28px 32px;background:#173d2d;color:#ffffff"><strong style="font-size:22px">PeaceNest</strong><br><span style="font-size:14px">Xác nhận đặt phòng</span></td></tr>',
    '<tr><td style="padding:28px 32px"><p style="margin:0 0 12px">Xin chào,</p><p style="margin:0 0 24px">Đặt phòng của bạn đã được xác nhận sau khi thanh toán thành công.</p>',
    `<p style="margin:0 0 20px;padding:14px 16px;background:#edf5ef;border-radius:10px"><strong>Mã đặt phòng</strong><br>${safeBookingCode}</p>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">',
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e7e2d8"><strong>Nơi lưu trú</strong></td><td style="padding:10px 0;border-bottom:1px solid #e7e2d8;text-align:right">${safePropertyName}</td></tr>`,
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e7e2d8"><strong>Hạng phòng</strong></td><td style="padding:10px 0;border-bottom:1px solid #e7e2d8;text-align:right">${safeRoomTypeName}</td></tr>`,
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e7e2d8"><strong>Thời gian lưu trú</strong></td><td style="padding:10px 0;border-bottom:1px solid #e7e2d8;text-align:right">${safeStay}</td></tr>`,
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e7e2d8"><strong>Số khách</strong></td><td style="padding:10px 0;border-bottom:1px solid #e7e2d8;text-align:right">${safeGuests}</td></tr>`,
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e7e2d8"><strong>Tổng thanh toán</strong></td><td style="padding:10px 0;border-bottom:1px solid #e7e2d8;text-align:right">${safeAmount}</td></tr>`,
    `<tr><td style="padding:10px 0"><strong>Thanh toán qua</strong></td><td style="padding:10px 0;text-align:right">${safeProvider}</td></tr>`,
    '</table>',
    `<p style="margin:24px 0 0;color:#5f675f;font-size:13px">Xác nhận lúc ${safeConfirmedAt}. Vui lòng lưu lại email này; thông tin nhận phòng sẽ được gửi khi đến thời điểm phù hợp.</p></td></tr>`,
    '</table></td></tr></table></div>',
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
