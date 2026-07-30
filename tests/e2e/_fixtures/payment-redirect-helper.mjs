// tests/e2e/_fixtures/payment-redirect-helper.mjs
//
// Phase 1 helper assertions for the assertSafePaymentRedirect component.
// Mirrors the rules in apps/web/src/lib/payment-redirect.ts so that the
// Playwright spec file does not need a TypeScript loader. Keep this in sync
// with the TS source if the policy changes.

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isLoopbackHost(hostname) {
  const lower = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(lower)) return true;
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return LOOPBACK_HOSTS.has(lower.slice(1, -1));
  }
  return false;
}

export class UnsafePaymentRedirectError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsafePaymentRedirectError';
  }
}

export function assertSafePaymentRedirect(rawUrl, runtime) {
  let parsed;
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
