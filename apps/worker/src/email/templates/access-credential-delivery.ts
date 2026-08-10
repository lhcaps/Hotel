import { escapeHtml, type RenderedHoldConfirmation } from './hold-confirmation.js';

export interface AccessCredentialDeliveryContext {
  readonly bookingCode: string;
  readonly propertyName: string;
}

/**
 * The credential reference is intentionally not part of this context. Provider
 * references can be used to retrieve an access credential and must never be
 * rendered into email content.
 */
export function renderAccessCredentialDelivery(
  context: AccessCredentialDeliveryContext,
): RenderedHoldConfirmation {
  return {
    subject: `Access preparation is complete for booking ${context.bookingCode}`,
    text: [
      'Hello,',
      '',
      `Access preparation for your stay at ${context.propertyName} is complete.`,
      `Booking code: ${context.bookingCode}`,
      '',
      'For your security, this email does not contain a door code or provider credential.',
      'Please use the approved arrival channel or contact the property for access assistance.',
    ].join('\n'),
    html: [
      '<p>Hello,</p>',
      `<p>Access preparation for your stay at <strong>${escapeHtml(context.propertyName)}</strong> is complete.</p>`,
      `<p><strong>Booking code:</strong> ${escapeHtml(context.bookingCode)}</p>`,
      '<p>For your security, this email does not contain a door code or provider credential. Please use the approved arrival channel or contact the property for access assistance.</p>',
    ].join('\n'),
  };
}
