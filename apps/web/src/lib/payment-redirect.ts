/**
 * Phase 1 payment redirect URL validator.
 *
 * Accepts URLs returned by the local payment gateway simulators in
 * development/test, and HTTPS provider URLs in any mode. Rejects every other
 * scheme and any HTTP host that is not a loopback. Production remains
 * HTTPS-only — even localhost URLs are rejected there so a misconfigured
 * staging environment cannot trick the browser into navigating off the
 * public payment page.
 */

export type PaymentRedirectRuntime = 'development' | 'test' | 'production';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export class UnsafePaymentRedirectError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'UnsafePaymentRedirectError';
  }
}

function isLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(lower)) return true;
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return LOOPBACK_HOSTS.has(lower.slice(1, -1));
  }
  return false;
}

export function assertSafePaymentRedirect(rawUrl: string, runtime: PaymentRedirectRuntime): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafePaymentRedirectError('payment.redirect.malformedUrl');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new UnsafePaymentRedirectError('payment.redirect.credentialsNotAllowed');
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol === 'javascript:' || protocol === 'data:' || protocol === 'file:') {
    throw new UnsafePaymentRedirectError('payment.redirect.unsafeScheme');
  }
  if (protocol === 'https:') {
    return parsed;
  }
  if (protocol !== 'http:') {
    throw new UnsafePaymentRedirectError('payment.redirect.unsupportedScheme');
  }
  if (runtime === 'production') {
    throw new UnsafePaymentRedirectError('payment.redirect.httpBlockedInProduction');
  }
  if (!isLoopbackHost(parsed.hostname)) {
    throw new UnsafePaymentRedirectError('payment.redirect.httpHostNotLoopback');
  }
  return parsed;
}
