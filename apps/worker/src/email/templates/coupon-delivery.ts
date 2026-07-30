import { escapeHtml, type RenderedHoldConfirmation } from './hold-confirmation.js';

export interface CouponDeliveryContext {
  readonly bookingCode: string;
  readonly propertyName: string;
  readonly couponCodes: readonly string[];
}

export function renderCouponDelivery(context: CouponDeliveryContext): RenderedHoldConfirmation {
  const codes = context.couponCodes.map((code) => `- ${code}`).join('\n');
  return {
    subject: `Coupons for booking ${context.bookingCode}`,
    text: `Your coupons for ${context.propertyName} (${context.bookingCode}):\n${codes}`,
    html: `<p>Your coupons for <strong>${escapeHtml(context.propertyName)}</strong> (${escapeHtml(context.bookingCode)}):</p><ul>${context.couponCodes.map((code) => `<li>${escapeHtml(code)}</li>`).join('')}</ul>`,
  };
}
