// tests/e2e/_fixtures/payment-test-helpers.mjs
//
// Reusable helpers for Gate B11/B12 deterministic payment E2E tests.
// Builds bookings via the public API, captures the guest session cookie
// from the Set-Cookie header, and exposes idempotent payment initiation
// helpers. The companion simulator (payment-provider-simulator.mjs)
// handles the MoMo + VNPAY provider side.

import { randomUUID } from 'node:crypto';

const DEFAULT_API_BASE = 'http://127.0.0.1:3101/api/v1';
const DEFAULT_WEB_BASE = 'http://127.0.0.1:3100';
const DEFAULT_SIMULATOR_BASE = 'http://127.0.0.1:3090';
const MAILPIT_API = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025';

export const DELUXE_ROOM_TYPE = '10000000-0000-4000-8000-000000000201';
let bookingIntervalCounter = 0;

export async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body;
  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers, text };
}

export function getApiBaseUrl() {
  return process.env.PAYMENT_TEST_API_BASE ?? DEFAULT_API_BASE;
}

export function getSimulatorBaseUrl() {
  // Global setup runs in a separate process from Playwright workers. The
  // simulator deliberately uses its deterministic loopback port so workers
  // can connect without relying on a non-propagating environment mutation.
  return process.env.PAYMENT_SIMULATOR_BASE_URL ?? DEFAULT_SIMULATOR_BASE;
}

export function getWebBaseUrl() {
  return process.env.PAYMENT_TEST_WEB_BASE ?? DEFAULT_WEB_BASE;
}

function captureCookieFromResponse(response, name) {
  const setCookie = response.headers.get('set-cookie');
  if (setCookie === null) return undefined;
  for (const part of setCookie.split(/,(?=[^;]+=)/)) {
    const trimmed = part.split(';')[0].trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return undefined;
}

async function waitForVerificationEmail(recipientEmail) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const messagesResponse = await fetch(`${MAILPIT_API}/api/v1/messages`);
    if (messagesResponse.ok) {
      const messages = (await messagesResponse.json()).messages ?? [];
      const message = messages.find(
        (candidate) =>
          candidate.To?.some((recipient) => recipient.Address === recipientEmail) &&
          /verification/i.test(candidate.Subject ?? ''),
      );
      if (message !== undefined) {
        const messageResponse = await fetch(`${MAILPIT_API}/api/v1/message/${message.ID}`);
        if (!messageResponse.ok) {
          throw new Error(`Mailpit message read failed: ${messageResponse.status}`);
        }
        const body = await messageResponse.json();
        const content = body.Text ?? body.HTML ?? '';
        const otp = /(?:^|\s|\D)(\d{6})(?:\s|$|\D)/.exec(content)?.[1];
        if (otp !== undefined) return otp;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Mailpit did not deliver a verification OTP to ${recipientEmail}`);
}

async function createGuestSession(bookingCode, email, apiBase) {
  const request = await fetchJson(`${apiBase}/public/guest-access/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bookingCode, email }),
  });
  if (request.status !== 201) {
    throw new Error(
      `OTP request failed: status=${request.status} body=${JSON.stringify(request.body)}`,
    );
  }
  const otp = await waitForVerificationEmail(email);
  const response = await fetch(`${apiBase}/public/guest-access/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeRef: request.body.challengeRef, otp }),
  });
  const cookie = captureCookieFromResponse(response, 'rm_guest_session_v1');
  const text = await response.text();
  if (response.status !== 201 || cookie === undefined) {
    throw new Error(`OTP verify failed: status=${response.status} body=${text}`);
  }
  return cookie;
}

/**
 * Compute a 15-minute aligned check-in time inside the LUNCH pricing
 * window (11:00–15:00 local). Mirrors scripts/demo/smoke.mjs so the
 * deterministic DELUXE seed and fixed lunch price produce a known
 * payment amount.
 */
export function futureLunchIso() {
  // Every payment test receives a distinct interval. A HOLD reserves one
  // physical room, so sharing an interval would turn sequential tests into
  // accidental availability conflicts before their short test hold expires.
  const dayOffset = 2 + (bookingIntervalCounter++ % 40);
  const target = new Date(Date.now() + dayOffset * 24 * 60 * 60_000);
  const lunch = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate() + 1, 11, 0, 0, 0),
  );
  const minute = lunch.getUTCMinutes();
  const remainder = minute % 15;
  if (remainder !== 0) lunch.setUTCMinutes(minute + (15 - remainder));
  const checkIn = lunch;
  const checkOut = new Date(checkIn.getTime() + 60 * 60_000);
  return {
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    adults: 2,
    children: 0,
  };
}

export async function createQuote(apiBase = getApiBaseUrl()) {
  // A Playwright worker can load this module once per spec file, so a local
  // counter alone cannot guarantee that another payment vertical has not
  // already placed a HOLD on the same seeded room. Walk forward through the
  // deterministic test window when the real availability authority rejects
  // a candidate; the fixture never bypasses or fabricates availability.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const interval = futureLunchIso();
    const response = await fetchJson(`${apiBase}/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...interval, roomTypeId: DELUXE_ROOM_TYPE }),
    });
    if (response.status === 409 && response.body?.code === 'AVAILABILITY_UNAVAILABLE') {
      continue;
    }
    if (response.status !== 201 && response.status !== 200) {
      throw new Error(
        `quote failed: status=${response.status} body=${JSON.stringify(response.body)}`,
      );
    }
    return response.body;
  }
  throw new Error('quote failed: no available deterministic interval remained');
}

export async function createBookingHold(apiBase = getApiBaseUrl()) {
  const quote = await createQuote(apiBase);
  const contactEmail = `pay-${Date.now().toString(36)}-${randomUUID()}@example.test`.toLowerCase();
  const response = await fetch(`${apiBase}/public/quotes/${quote.id}/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contact: {
        fullName: 'Pay Demo',
        email: contactEmail,
        phone: '+84901234567',
      },
    }),
  });
  const text = await response.text();
  if (response.status !== 201) {
    throw new Error(`hold failed: status=${response.status} body=${text}`);
  }
  const body = text.length > 0 ? JSON.parse(text) : {};
  const guestSessionCookie = await createGuestSession(body.bookingCode, contactEmail, apiBase);
  return {
    bookingCode: body.bookingCode,
    quoteId: quote.id,
    guestSessionCookie,
    finalAmountVnd: quote.pricing?.totalAmountVnd,
    contactEmail,
  };
}

export async function readPaymentStatus(
  bookingCode,
  guestSessionCookie,
  apiBase = getApiBaseUrl(),
) {
  const response = await fetch(`${apiBase}/public/bookings/${bookingCode}/payment`, {
    headers: {
      cookie: `rm_guest_session_v1=${guestSessionCookie}`,
      accept: 'application/json',
    },
  });
  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : {};
  if (response.status !== 200) {
    throw new Error(`payment status failed: status=${response.status} body=${text}`);
  }
  return { status: response.status, body };
}

export async function initiateMomoPayment(
  bookingCode,
  guestSessionCookie,
  apiBase = getApiBaseUrl(),
) {
  return initiatePaymentAttempt('momo', bookingCode, guestSessionCookie, apiBase);
}

export async function initiateVnpayPayment(
  bookingCode,
  guestSessionCookie,
  apiBase = getApiBaseUrl(),
) {
  return initiatePaymentAttempt('vnpay', bookingCode, guestSessionCookie, apiBase);
}

async function initiatePaymentAttempt(provider, bookingCode, guestSessionCookie, apiBase) {
  const idempotencyKey = `e2e-${provider}-${Date.now()}-${randomUUID()}`;
  const response = await fetch(
    `${apiBase}/public/bookings/${bookingCode}/payments/${provider}/attempts`,
    {
      method: 'POST',
      headers: {
        cookie: `rm_guest_session_v1=${guestSessionCookie}`,
        'idempotency-key': idempotencyKey,
        accept: 'application/json',
      },
    },
  );
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`${provider} initiation failed: status=${response.status} body=${text}`);
  }
  const body = text.length > 0 ? JSON.parse(text) : {};
  return { ...body, idempotencyKey };
}

export async function setSimulatorMode(provider, mode, extras = {}) {
  const url = `${getSimulatorBaseUrl()}/__control/${provider}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode, ...extras }),
  });
  if (!response.ok) {
    throw new Error(`simulator control failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export async function readSimulatorCounts() {
  const url = `${getSimulatorBaseUrl()}/__health`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`simulator health failed: ${response.status}`);
  }
  return response.json();
}

export async function adminLogin(apiBase = getApiBaseUrl()) {
  const email = process.env.PAYMENT_TEST_ADMIN_EMAIL ?? 'admin.playwright@example.test';
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  if (password === undefined || password.length === 0) {
    throw new Error('PLAYWRIGHT_ADMIN_PASSWORD is not set');
  }
  const response = await fetch(`${apiBase.replace('/api/v1', '')}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: getWebBaseUrl() },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = response.headers.get('set-cookie') ?? '';
  if (response.status !== 200 || setCookie.length === 0) {
    throw new Error(
      `admin sign-in failed: status=${response.status} body=${await response.text()}`,
    );
  }
  return setCookie
    .split(/,(?=[^;]+=)/)
    .map((part) => part.split(';')[0].trim())
    .filter((part) => part.length > 0)
    .join('; ');
}

export async function adminListPayments(query = {}, apiBase = getApiBaseUrl()) {
  const params = new URLSearchParams({ page: '1', pageSize: '20', ...query });
  const response = await fetch(`${apiBase}/admin/payments?${params.toString()}`, {
    headers: {
      cookie: await adminLogin(apiBase),
      accept: 'application/json',
    },
  });
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`admin list payments failed: ${response.status} ${text}`);
  }
  return text.length > 0 ? JSON.parse(text) : { items: [] };
}

export async function adminGetPayment(paymentId, apiBase = getApiBaseUrl()) {
  const response = await fetch(`${apiBase}/admin/payments/${paymentId}`, {
    headers: {
      cookie: await adminLogin(apiBase),
      accept: 'application/json',
    },
  });
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`admin get payment failed: ${response.status} ${text}`);
  }
  return text.length > 0 ? JSON.parse(text) : null;
}

export function waitFor(condition, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 200;
  const start = Date.now();
  let lastError;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const result = await condition();
        // Conditions normally return false while waiting, true for a simple
        // readiness probe, or a useful truthy value (for example the settled
        // payment-status response) that the caller wants to assert on.
        if (result) {
          resolve(result);
          return;
        }
      } catch (error) {
        // Retry transient API/readiness failures, but retain the final cause
        // so an E2E timeout remains diagnosable instead of masking it.
        lastError = error;
      }
      if (Date.now() - start > timeoutMs) {
        const detail = lastError instanceof Error ? `; last error: ${lastError.message}` : '';
        reject(new Error(`waitFor timed out after ${timeoutMs}ms${detail}`));
        return;
      }
      setTimeout(attempt, intervalMs);
    };
    void attempt();
  });
}
