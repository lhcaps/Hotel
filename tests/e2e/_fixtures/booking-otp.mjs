// tests/e2e/_fixtures/booking-otp.mjs
//
// Phase 1 helper: create a HOLD booking via the API and surface the OTP
// needed to drive the /booking/manage UI flow. Returns enough context for
// the spec to fill in the OTP form.
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_API_BASE = 'http://127.0.0.1:3101/api/v1';
const MAILPIT_API = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025';

function resolveDatabaseUrl() {
  try {
    const value = readFileSync(join(tmpdir(), 'playwright-test-database-url.txt'), 'utf8').trim();
    if (value.length > 0) return value;
  } catch {
    // Fall through; not all callers need this.
  }
  return undefined;
}

function apiBase() {
  return process.env.PAYMENT_TEST_API_BASE ?? DEFAULT_API_BASE;
}

async function fetchJson(url, init) {
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

export const DELUXE_ROOM_TYPE = '10000000-0000-4000-8000-000000000201';

function futureLunchIso(offsetMinutes = 0) {
  // Pick a future date with 11:00 UTC lunch pricing window. The
  // offsetMinutes parameter lets the caller stagger distinct holds onto
  // different physical rooms when the deterministic DELUXE seed has only
  // one room per slot.
  const dayOffset = 3 + Math.floor(Math.random() * 6_000);
  const target = new Date(Date.now() + dayOffset * 24 * 60 * 60_000);
  const lunch = new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      target.getUTCDate(),
      11,
      offsetMinutes,
      0,
      0,
    ),
  );
  return {
    checkIn: lunch.toISOString(),
    checkOut: new Date(lunch.getTime() + 60 * 60_000).toISOString(),
    adults: 2,
    children: 0,
  };
}

export async function waitForVerificationOtp(recipientEmail) {
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
        if (!messageResponse.ok) continue;
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

export async function createHoldsForUi({ count = 1 } = {}) {
  const base = apiBase();
  const holds = [];
  for (let i = 0; i < count; i += 1) {
    const interval = futureLunchIso();
    const quote = await fetchJson(`${base}/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...interval, roomTypeId: DELUXE_ROOM_TYPE }),
    });
    if (quote.status !== 200 && quote.status !== 201) {
      throw new Error(`quote failed: ${quote.status} ${quote.text}`);
    }
    const contactEmail = `phase1p-${Date.now().toString(36)}-${i}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.test`.toLowerCase();
    const booking = await fetchJson(`${base}/public/quotes/${quote.body.id}/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contact: {
          fullName: 'Phase 1 Browser Pay',
          email: contactEmail,
          phone: '+84901234567',
        },
      }),
    });
    if (booking.status !== 201) {
      throw new Error(`hold failed: ${booking.status} ${booking.text}`);
    }
    holds.push({
      bookingCode: booking.body.bookingCode,
      email: contactEmail,
      quoteId: quote.body.id,
      finalAmountVnd: quote.body.pricing?.totalAmountVnd,
    });
  }
  return holds;
}

export async function fetchOtpFor(hold) {
  return waitForVerificationOtp(hold.email);
}

export function getDatabaseUrl() {
  return resolveDatabaseUrl();
}
