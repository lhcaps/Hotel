#!/usr/bin/env node
// scripts/demo/payment.mjs
//
// Phase 6F demo payment smoke. Exercises a full customer payment journey
// against the live demo (3100/3101) when MOMO/VNPAY base URLs are pointed
// at the deterministic payment provider simulator. The simulator signs
// responses with the same HMAC secrets used by the production adapters
// so end-to-end settlement follows the production code path.
//
// Outputs:
//   - PASS/FAIL per assertion on stdout.
//   - Exits non-zero on any failed assertion (no retries).
//
// Required environment:
//   DEMO_ADMIN_PASSWORD     resolved from the manifest (same as smoke.mjs)
//   PAYMENT_SIMULATOR_BASE_URL   loopback URL of the running simulator
//                                (e.g. http://127.0.0.1:3090)
//
// This script is invoked by `pnpm demo:payment` or run manually against
// an already-running demo.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API_BASE = process.env.DEMO_API_BASE ?? 'http://127.0.0.1:3101/api/v1';
const SIMULATOR_BASE =
  process.env.PAYMENT_SIMULATOR_BASE_URL ?? 'http://127.0.0.1:3090';
const MANIFEST_PATH = process.env.DEMO_STATE_FILE ?? join(tmpdir(), 'room-management-demo-state.json');

function resolveAdminPasswordFromManifest() {
  if (!existsSync(MANIFEST_PATH)) return undefined;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return undefined;
  }
  const passwordPath =
    manifest && typeof manifest === 'object' && typeof manifest.passwordPath === 'string'
      ? manifest.passwordPath
      : undefined;
  if (!passwordPath) return undefined;
  if (!existsSync(passwordPath)) return undefined;
  try {
    if (statSync(passwordPath).mtimeMs < statSync(MANIFEST_PATH).mtimeMs - 5000) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  try {
    return readFileSync(passwordPath, 'utf8').trim();
  } catch {
    return undefined;
  }
}

const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'admin.demo@example.local';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? resolveAdminPasswordFromManifest();
if (!ADMIN_PASSWORD) {
  process.stderr.write('DEMO_ADMIN_PASSWORD is required for the demo payment smoke.\n');
  process.exit(1);
}

const results = [];
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} ${detail ?? ''}\n`);
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

function futureLunchIso() {
  const target = new Date(Date.now() + 24 * 60 * 60_000);
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

async function setSimulatorMode(provider, mode, extras = {}) {
  const response = await fetch(`${SIMULATOR_BASE}/__control/${provider}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode, ...extras }),
  });
  if (!response.ok) {
    throw new Error(`simulator control failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function readSimulatorCounts() {
  const response = await fetch(`${SIMULATOR_BASE}/__health`);
  if (!response.ok) throw new Error(`simulator health failed: ${response.status}`);
  return response.json();
}

function captureCookie(response, name) {
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

async function createHoldWithCookie(apiBase) {
  const interval = futureLunchIso();
  const quote = await fetchJson(`${apiBase}/quotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...interval, roomTypeId: '10000000-0000-4000-8000-000000000202' }),
  });
  if (quote.status !== 200 && quote.status !== 201) {
    throw new Error(`quote failed: ${quote.status}`);
  }
  const response = await fetch(`${apiBase}/public/quotes/${quote.body.id}/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contact: {
        fullName: 'Payment Demo',
        email: `payment-demo-${Date.now().toString(36)}@example.local`,
        phone: '+84901234567',
      },
    }),
  });
  const cookie = captureCookie(response, 'rm_guest_session_v1');
  const text = await response.text();
  if (response.status !== 201) {
    throw new Error(`hold failed: ${response.status} body=${text}`);
  }
  const body = text.length > 0 ? JSON.parse(text) : {};
  return {
    bookingCode: body.bookingCode,
    guestSessionCookie: cookie,
    finalAmountVnd: quote.body.pricing?.totalAmountVnd,
  };
}

async function initiatePayment(provider, bookingCode, cookie, apiBase) {
  const idempotencyKey = `demo-${provider}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await fetch(
    `${apiBase}/public/bookings/${bookingCode}/payments/${provider}/attempts`,
    {
      method: 'POST',
      headers: {
        cookie: `rm_guest_session_v1=${cookie}`,
        'idempotency-key': idempotencyKey,
        accept: 'application/json',
      },
    },
  );
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`${provider} initiation failed: ${response.status} ${text}`);
  }
  return text.length > 0 ? JSON.parse(text) : {};
}

async function readStatus(bookingCode, cookie, apiBase) {
  const response = await fetch(`${apiBase}/public/bookings/${bookingCode}/payment`, {
    headers: {
      cookie: `rm_guest_session_v1=${cookie}`,
      accept: 'application/json',
    },
  });
  const text = await response.text();
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : {} };
}

async function adminLogin(apiBase) {
  const response = await fetch(`${apiBase.replace('/api/v1', '')}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:3100' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const setCookie = response.headers.get('set-cookie') ?? '';
  if (response.status !== 200 || setCookie.length === 0) {
    throw new Error(`admin sign-in failed: ${response.status} body=${await response.text()}`);
  }
  return setCookie
    .split(/,(?=[^;]+=)/)
    .map((part) => (part.split(';')[0] ?? '').trim())
    .filter((part) => part.length > 0)
    .join('; ');
}

async function adminListPayments(query, cookies, apiBase) {
  const params = new URLSearchParams({ page: '1', pageSize: '20', ...query });
  const response = await fetch(`${apiBase}/admin/payments?${params.toString()}`, {
    headers: { cookie: cookies, accept: 'application/json' },
  });
  if (response.status !== 200) {
    throw new Error(`admin list payments failed: ${response.status}`);
  }
  const text = await response.text();
  return text.length > 0 ? JSON.parse(text) : { items: [] };
}

async function adminGetPayment(paymentId, cookies, apiBase) {
  const response = await fetch(`${apiBase}/admin/payments/${paymentId}`, {
    headers: { cookie: cookies, accept: 'application/json' },
  });
  if (response.status !== 200) {
    throw new Error(`admin get payment failed: ${response.status}`);
  }
  const text = await response.text();
  return text.length > 0 ? JSON.parse(text) : null;
}

async function waitForStatusSettled(bookingCode, cookie, apiBase) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const status = await readStatus(bookingCode, cookie, apiBase);
    if (status.body.paymentStatus === 'SUCCEEDED' || status.body.paymentStatus === 'REVIEW_REQUIRED') {
      return status.body;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`payment did not settle within 20s: ${bookingCode}`);
}

async function runProviderFlow(provider, apiBase) {
  // Reset simulator then drive the full path:
  //   1. Booking HOLD (cookie captured).
  //   2. Public payment-initiate (returns redirectUrl).
  //   3. Server-side fetch of redirectUrl triggers simulator's pay page,
  //      which posts a signed IPN back to the API.
  //   4. Read payment status; payment must reach SUCCEEDED with no
  //      REVIEW_REQUIRED.
  //   5. ADMIN list + detail must reflect the settlement and include the
  //      PROVIDER_* event in the timeline.
  await setSimulatorMode(provider, 'verify', { reset: true });

  const booking = await createHoldWithCookie(apiBase);
  const initiate = await initiatePayment(provider, booking.bookingCode, booking.guestSessionCookie, apiBase);
  record(
    `demo.payment.${provider}.initiate`,
    initiate.provider === provider.toUpperCase() && typeof initiate.redirectUrl === 'string',
    `redirect=${initiate.redirectUrl}`,
  );

  // Fetch the simulator pay page so its inline script triggers the IPN.
  const trigger = await fetch(initiate.redirectUrl, { redirect: 'manual' });
  record(
    `demo.payment.${provider}.pay-page`,
    trigger.status === 200,
    `pay-page status=${trigger.status}`,
  );

  const settled = await waitForStatusSettled(booking.bookingCode, booking.guestSessionCookie, apiBase);
  record(
    `demo.payment.${provider}.settled`,
    settled.paymentStatus === 'SUCCEEDED' && settled.reviewRequired === false,
    `paymentStatus=${settled.paymentStatus}`,
  );

  // Duplicate IPN must remain idempotent.
  await setSimulatorMode(provider, 'verify', { duplicateIpns: true });
  const booking2 = await createHoldWithCookie(apiBase);
  await initiatePayment(provider, booking2.bookingCode, booking2.guestSessionCookie, apiBase);
  await fetch((await initiatePayment(provider, booking2.bookingCode, booking2.guestSessionCookie, apiBase)).redirectUrl, {
    redirect: 'manual',
  });
  const settled2 = await waitForStatusSettled(booking2.bookingCode, booking2.guestSessionCookie, apiBase);
  record(
    `demo.payment.${provider}.duplicate-idempotent`,
    settled2.paymentStatus === 'SUCCEEDED',
    `paymentStatus=${settled2.paymentStatus}`,
  );

  // Tampered IPN must not settle.
  await setSimulatorMode(provider, 'tamper', { reset: true });
  const booking3 = await createHoldWithCookie(apiBase);
  const tampered = await initiatePayment(provider, booking3.bookingCode, booking3.guestSessionCookie, apiBase);
  await fetch(tampered.redirectUrl, { redirect: 'manual' });
  await new Promise((r) => setTimeout(r, 1_500));
  const tamperedStatus = await readStatus(booking3.bookingCode, booking3.guestSessionCookie, apiBase);
  record(
    `demo.payment.${provider}.tampered-rejected`,
    tamperedStatus.body.paymentStatus !== 'SUCCEEDED',
    `paymentStatus=${tamperedStatus.body.paymentStatus}`,
  );

  // ADMIN list + detail.
  const adminCookies = await adminLogin(apiBase);
  const listed = await adminListPayments({ bookingCode: booking.bookingCode }, adminCookies, apiBase);
  const item = (listed.items ?? []).find(
    (row) => row.booking?.bookingCode === booking.bookingCode,
  );
  record(
    `demo.payment.${provider}.admin.list`,
    item !== undefined && item.status === 'SUCCEEDED',
    item ? `paymentId=${item.paymentId.slice(0, 8)} status=${item.status}` : 'no row',
  );

  if (item !== undefined) {
    const detail = await adminGetPayment(item.paymentId, adminCookies, apiBase);
    const eventTypes = (detail?.timeline ?? []).map((event) => event.eventType);
    record(
      `demo.payment.${provider}.admin.detail-timeline`,
      eventTypes.includes('PROVIDER_SUCCEEDED'),
      `events=${eventTypes.join(',')}`,
    );
  }

  // Restore default mode for the next provider in the suite.
  await setSimulatorMode(provider, 'verify', { reset: true });
}

async function runSimulatorGuards(apiBase) {
  // The simulator must refuse to start under NODE_ENV=production; we
  // assert the runtime invariant indirectly: the simulator answers
  // /__health when reachable, and rejects non-loopback hosts. The demo
  // never starts the simulator in production code paths so this is a
  // shape check that the runtime contract holds.
  const simulatorResp = await fetch(`${SIMULATOR_BASE}/__health`);
  record(
    'demo.payment.simulator.reachable',
    simulatorResp.status === 200,
    `simulator health ${simulatorResp.status}`,
  );
  // Confirm the API's public payment-providers list contains MOMO + VNPAY
  // so the customer can see both options.
  const providers = await fetchJson(`${apiBase}/public/payment-providers`);
  const providerCodes = (providers.body ?? []).map((p) => p.provider).sort();
  record(
    'demo.payment.providers.listed',
    JSON.stringify(providerCodes) === JSON.stringify(['MOMO', 'VNPAY']),
    `providers=${providerCodes.join(',')}`,
  );
  // Confirm ADMIN payment list route is reachable (reconcile contract).
  const adminCookies = await adminLogin(apiBase);
  const list = await adminListPayments({}, adminCookies, apiBase);
  record(
    'demo.payment.admin.reconcile-listable',
    list.items !== undefined,
    `items=${(list.items ?? []).length}`,
  );
}

async function main() {
  try {
    await runSimulatorGuards(API_BASE);
  } catch (error) {
    record('demo.payment.guards.exception', false, errorMessage(error));
  }
  try {
    await runProviderFlow('momo', API_BASE);
  } catch (error) {
    record('demo.payment.momo.exception', false, errorMessage(error));
  }
  try {
    await runProviderFlow('vnpay', API_BASE);
  } catch (error) {
    record('demo.payment.vnpay.exception', false, errorMessage(error));
  }

  const finalCounts = /** @type {{ counts?: { momoIpnAttempts?: number; vnpayIpnAttempts?: number } }} */ (
    await readSimulatorCounts().catch(() => ({ counts: {} }))
  );
  process.stdout.write(
    `\nDemo payment summary: ${results.length - results.filter((r) => !r.ok).length}/${
      results.length
    } passed (momoIpn=${String(finalCounts?.counts?.momoIpnAttempts ?? 0)}, vnpayIpn=${String(finalCounts?.counts?.vnpayIpnAttempts ?? 0)})\n`,
  );
  const failed = results.filter((r) => !r.ok).map((r) => r.name);
  if (failed.length > 0) {
    process.stdout.write(`  failed: ${failed.join(', ')}\n`);
    process.exitCode = 1;
  }
}

await main();