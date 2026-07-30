/**
 * OTP challenge email template
 *
 * Renders a single-use 6-digit OTP to the guest. Contains only:
 * - 6-digit OTP
 * - booking code (so the guest can correlate which booking this is for)
 * - expiration window
 * - "do not share" warning
 *
 * Never contains: raw email, phone, session token, challenge UUID,
 * challenge ref, internal IDs, contact digest, OTP secret.
 */

export interface OtpChallengeContext {
  readonly bookingCode: string;
  readonly otp: string;
  readonly expiresAt: Date;
}

export interface RenderedOtpChallenge {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const OTP_FORMAT_REGEX = /^[0-9]{6}$/;

export function assertValidOtp(otp: string): void {
  if (!OTP_FORMAT_REGEX.test(otp)) {
    throw new Error(`Invalid OTP format: ${otp}`);
  }
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

function formatExpiry(expiresAt: Date): string {
  return expiresAt.toISOString();
}

function formatStayWindow(expiresAt: Date): string {
  return formatExpiry(expiresAt);
}

export function renderOtpChallengeSubject(context: OtpChallengeContext): string {
  return `Your verification code for booking ${context.bookingCode}`;
}

export function renderOtpChallengeText(context: OtpChallengeContext): string {
  const lines = [
    `Your verification code is: ${context.otp}`,
    ``,
    `Booking code: ${context.bookingCode}`,
    `This code expires at ${formatExpiry(context.expiresAt)}.`,
    ``,
    `Enter this code on the booking page to view or manage your reservation.`,
    `Do not share this code with anyone. We will never ask for it by phone or chat.`,
    `If you did not request this code, you can safely ignore this email.`,
  ];
  return lines.join('\n');
}

export function renderOtpChallengeHtml(context: OtpChallengeContext): string {
  const safeBookingCode = escapeHtml(context.bookingCode);
  const safeOtp = escapeHtml(context.otp);
  const safeExpiry = escapeHtml(formatStayWindow(context.expiresAt));
  return [
    `<p>Your verification code is:</p>`,
    `<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${safeOtp}</p>`,
    `<table cellpadding="6" cellspacing="0" border="0">`,
    `<tr><td><strong>Booking code</strong></td><td>${safeBookingCode}</td></tr>`,
    `<tr><td><strong>Expires</strong></td><td>${safeExpiry}</td></tr>`,
    `</table>`,
    `<p>Enter this code on the booking page to view or manage your reservation.</p>`,
    `<p><strong>Do not share this code with anyone.</strong> We will never ask for it by phone or chat.</p>`,
    `<p>If you did not request this code, you can safely ignore this email.</p>`,
  ].join('\n');
}

export function renderOtpChallenge(context: OtpChallengeContext): RenderedOtpChallenge {
  assertValidOtp(context.otp);
  return {
    subject: renderOtpChallengeSubject(context),
    text: renderOtpChallengeText(context),
    html: renderOtpChallengeHtml(context),
  };
}
