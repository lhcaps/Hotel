import { escapeHtml, type RenderedHoldConfirmation } from './hold-confirmation.js';

export interface AccessCredentialDeliveryContext {
  readonly bookingCode: string;
  readonly propertyName: string;
  /** A CID for the short-lived, signed QR PNG attached by the worker. */
  readonly qrCid?: string;
  readonly arrival?: {
    readonly gatePass: string;
    readonly roomPass: string;
    readonly wifiSsid: string;
    readonly wifiPassword: string;
    readonly roomLocation: string;
    readonly instructions: string;
    readonly preparationNote: string;
    readonly supportContact: string;
  };
}

/**
 * The credential reference is intentionally not part of this context. Provider
 * references can be used to retrieve an access credential and must never be
 * rendered into email content.
 */
export function renderAccessCredentialDelivery(
  context: AccessCredentialDeliveryContext,
): RenderedHoldConfirmation {
  if (context.arrival === undefined) {
    return {
      subject: `PeaceNest - check-in information for ${context.bookingCode}`,
      text: [
        'Chào bạn,',
        '',
        `Thông tin nhận phòng tại ${context.propertyName} đã sẵn sàng.`,
        `Mã đặt phòng: ${context.bookingCode}`,
        '',
        'Vui lòng mở chi tiết đặt phòng để xem mã QR nhận phòng hoặc liên hệ nơi lưu trú để được hỗ trợ.',
      ].join('\n'),
      html: [
        '<p>Chào bạn,</p>',
        `<p>Thông tin nhận phòng tại <strong>${escapeHtml(context.propertyName)}</strong> đã sẵn sàng.</p>`,
        `<p><strong>Mã đặt phòng:</strong> ${escapeHtml(context.bookingCode)}</p>`,
        '<p>Vui lòng mở chi tiết đặt phòng để xem mã QR nhận phòng hoặc liên hệ nơi lưu trú để được hỗ trợ.</p>',
      ].join('\n'),
    };
  }
  const { arrival } = context;
  const qrContent =
    context.qrCid === undefined
      ? ''
      : ['', 'Mã QR nhận phòng được đính kèm trong email này.'].join('\n');
  const qrHtml =
    context.qrCid === undefined
      ? ''
      : `<p><img src="cid:${escapeHtml(context.qrCid)}" alt="Mã QR nhận phòng" width="256" height="256" /></p>`;
  return {
    subject: `PeaceNest - thông tin nhận phòng ${context.bookingCode}`,
    text: [
      'Chào bạn,',
      '',
      `Thông tin nhận phòng tại ${context.propertyName} đã sẵn sàng.`,
      `Mã đặt phòng: ${context.bookingCode}`,
      '',
      `Cổng vào: ${arrival.gatePass}`,
      `Phòng: ${arrival.roomPass}`,
      `Vị trí: ${arrival.roomLocation}`,
      `Wi-Fi: ${arrival.wifiSsid}`,
      `Mật khẩu Wi-Fi: ${arrival.wifiPassword}`,
      `Hướng dẫn: ${arrival.instructions}`,
      `Lưu ý: ${arrival.preparationNote}`,
      `Hỗ trợ: ${arrival.supportContact}`,
      qrContent,
    ].join('\n'),
    html: [
      '<p>Chào bạn,</p>',
      `<p>Thông tin nhận phòng tại <strong>${escapeHtml(context.propertyName)}</strong> đã sẵn sàng.</p>`,
      `<p><strong>Mã đặt phòng:</strong> ${escapeHtml(context.bookingCode)}</p>`,
      '<table role="presentation" style="border-collapse:collapse;width:100%;max-width:560px">',
      `<tr><td><strong>Cổng vào</strong></td><td>${escapeHtml(arrival.gatePass)}</td></tr>`,
      `<tr><td><strong>Phòng</strong></td><td>${escapeHtml(arrival.roomPass)}</td></tr>`,
      `<tr><td><strong>Vị trí</strong></td><td>${escapeHtml(arrival.roomLocation)}</td></tr>`,
      `<tr><td><strong>Wi-Fi</strong></td><td>${escapeHtml(arrival.wifiSsid)}</td></tr>`,
      `<tr><td><strong>Mật khẩu Wi-Fi</strong></td><td>${escapeHtml(arrival.wifiPassword)}</td></tr>`,
      '</table>',
      `<p><strong>Hướng dẫn:</strong> ${escapeHtml(arrival.instructions)}</p>`,
      `<p><strong>Lưu ý:</strong> ${escapeHtml(arrival.preparationNote)}</p>`,
      `<p><strong>Hỗ trợ:</strong> ${escapeHtml(arrival.supportContact)}</p>`,
      qrHtml,
    ].join('\n'),
  };
}
