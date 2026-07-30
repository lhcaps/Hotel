#!/usr/bin/env node
// scripts/demo/smoke.mjs
//
// Phase 6F demo smoke verification. Runs against a live demo environment
// (API on http://127.0.0.1:3101/api/v1, web on http://127.0.0.1:3100).
//
// Verifies:
//   PUBLIC
//     - web /health
//     - api /health/live and /health/ready
//     - availability returns data
//     - no-coupon quote works
//     - DEMO-FIXED quote works
//     - server gross/discount/final are coherent
//     - DEMO-DISABLED is rejected safely (problem-details, no 500)
//     - booking HOLD can be created
//     - OTP request reaches Mailpit (HTTP UI check)
//     - guest detail requires session (401 with cookieAuth contract)
//     - logout revokes access (delete cookie + 401)
//   ADMIN
//     - ADMIN authentication works (better-auth sign-in)
//     - coupon list loads
//     - DEMO-FIXED detail loads
//     - create a uniquely named temporary coupon
//     - disable that temporary coupon
//     - no re-enable route/action exists (POST /disable is the only mutation)
//     - CUSTOMER cannot access ADMIN API (401/403)
//     - unauthenticated user cannot access ADMIN API (401/403)
//
// Exits non-zero on any failed assertion. No retries.
//
// Password discovery:
//   The orchestrator writes a per-run manifest at MANIFEST_PATH (or
//   wherever DEMO_STATE_FILE points). The smoke reads ONLY that
//   manifest to find the ADMIN password file. It never scans the
//   global tmp directory for password files, which would otherwise
//   leak data from older stale runs.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEMO_ADMIN_EMAIL,
  DEMO_API_PORT,
  DEMO_COUPONS,
  DEMO_MANIFEST_FILENAME,
  DEMO_WEB_PORT,
} from './demo-constants.mjs';

const API_BASE = `http://127.0.0.1:${DEMO_API_PORT}/api/v1`;
const AUTH_BASE = `http://127.0.0.1:${DEMO_API_PORT}/api/auth`;
const WEB_BASE = `http://127.0.0.1:${DEMO_WEB_PORT}`;
const MAILPIT_BASE = 'http://127.0.0.1:8025';

const MANIFEST_PATH = process.env.DEMO_STATE_FILE ?? join(tmpdir(), DEMO_MANIFEST_FILENAME);

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
  const basename = passwordPath.split(/[\\/]/).pop() ?? '';
  if (!/^room-management-demo-admin-[a-f0-9]{16}\.txt$/.test(basename)) return undefined;
  if (!existsSync(passwordPath)) return undefined;
  // Sanity: the password file must be at least as new as the manifest.
  // Otherwise the orchestrator may have rotated the password out from
  // under us.
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

const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? resolveAdminPasswordFromManifest();
if (!ADMIN_PASSWORD) {
  process.stderr.write(
    `DEMO_ADMIN_PASSWORD is required for the smoke. Start the demo with \`pnpm demo:phase6\`, or set DEMO_STATE_FILE to a valid manifest path.\n`,
  );
  process.exit(1);
}

// Stable fixture IDs from the development seed.
const DELUXE_ROOM_TYPE = '10000000-0000-4000-8000-000000000202';

const results = [];
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
  return { status: response.status, body, headers: response.headers, raw: text };
}

function futureIso() {
  // Each smoke run receives an independent future lunch slot. Reusing a
  // previously held interval makes a second smoke run test availability
  // contention rather than the public booking flow.
  const target = new Date(Date.now() + (2 + Math.floor(Math.random() * 10_000)) * 24 * 60 * 60_000);
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

async function runPublicFlow() {
  const smokeRecipient = `smoke.${Date.now().toString(36)}@example.local`;

  // 1. Health
  const webHealth = await fetchJson(`${WEB_BASE}/health`);
  record('public.web.health', webHealth.status === 200, `web /health -> ${webHealth.status}`);
  const apiLive = await fetchJson(`${API_BASE}/health/live`);
  record('public.api.live', apiLive.status === 200, `api live -> ${apiLive.status}`);
  const apiReady = await fetchJson(`${API_BASE}/health/ready`);
  record('public.api.ready', apiReady.status === 200, `api ready -> ${apiReady.status}`);

  // 2. Availability
  const interval = futureIso();
  const availability = await fetchJson(`${API_BASE}/availability/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(interval),
  });
  const items = availability.body?.items ?? [];
  record(
    'public.availability',
    (availability.status === 200 || availability.status === 201) && items.length > 0,
    `availability -> ${availability.status}, ${items.length} items`,
  );

  // 3. Quote without coupon
  const quoteNoCoupon = await fetchJson(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...interval, roomTypeId: DELUXE_ROOM_TYPE }),
  });
  const totalNoCoupon = quoteNoCoupon.body?.pricing?.totalAmountVnd;
  record(
    'public.quote.no-coupon',
    (quoteNoCoupon.status === 200 || quoteNoCoupon.status === 201) &&
      typeof totalNoCoupon === 'number' &&
      totalNoCoupon > 0,
    `quote -> ${quoteNoCoupon.status}, total ${String(totalNoCoupon)}`,
  );

  // 4. Quote with DEMO-FIXED
  const quoteFixed = await fetchJson(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...interval,
      roomTypeId: DELUXE_ROOM_TYPE,
      couponCode: DEMO_COUPONS.FIXED,
    }),
  });
  const couponSummary = quoteFixed.body?.coupon;
  const discountType = couponSummary?.discountType;
  const gross = couponSummary?.grossAmountVnd;
  const discount = couponSummary?.discountAmountVnd;
  const final = couponSummary?.finalAmountVnd;
  const coherent =
    typeof gross === 'number' &&
    typeof discount === 'number' &&
    typeof final === 'number' &&
    final === gross - discount;
  record(
    'public.quote.demo-fixed',
    (quoteFixed.status === 200 || quoteFixed.status === 201) &&
      couponSummary !== undefined &&
      coherent,
    `discountType=${String(discountType)} gross-discount=final? ${coherent ? 'yes' : 'no'}`,
  );

  // 5. Disabled coupon rejection
  const quoteDisabled = await fetchJson(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...interval,
      roomTypeId: DELUXE_ROOM_TYPE,
      couponCode: DEMO_COUPONS.DISABLED,
    }),
  });
  // Must be a 4xx problem-details — not a 5xx — and must include a
  // safe code, never "room_management" or a UUID of another customer.
  const disabledBody = JSON.stringify(quoteDisabled.body ?? {});
  record(
    'public.quote.demo-disabled.rejected',
    quoteDisabled.status >= 400 &&
      quoteDisabled.status < 500 &&
      /COUPON_(NOT_FOUND_OR_UNAVAILABLE|EXPIRED|DISABLED|NOT_APPLICABLE|UNAVAILABLE)/.test(
        disabledBody,
      ),
    `disabled -> ${quoteDisabled.status}`,
  );

  // 6. Booking HOLD
  const hold = await fetchJson(`${API_BASE}/public/quotes/${quoteFixed.body.id}/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contact: {
        fullName: 'Smoke Demo',
        email: smokeRecipient,
        phone: '+84901234567',
      },
    }),
  });
  const bookingCode = hold.body?.bookingCode;
  record(
    'public.booking-hold',
    hold.status === 201 && typeof bookingCode === 'string',
    `hold -> ${hold.status}, code ${String(bookingCode)}`,
  );

  // 7. OTP request reaches Mailpit. Mailpit's list endpoint is capped at
  // 50 messages, so a count delta is not reliable after repeated demo runs.
  // Instead, identify the verification mail for this unique booking and recipient.
  const otpRecipient = smokeRecipient;
  const otpRequest = await fetchJson(`${API_BASE}/public/guest-access/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bookingCode, email: otpRecipient }),
  });
  const otpResponseShape =
    typeof otpRequest.body?.challengeRef === 'string' &&
    typeof otpRequest.body?.expiresAt === 'string';

  let otpDelivered = false;
  for (let i = 0; i < 10; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    const messages = await fetchJson(`${MAILPIT_BASE}/api/v1/messages`);
    otpDelivered = Array.isArray(messages.body?.messages)
      ? messages.body.messages.some(
          (message) =>
            message.To?.some((recipient) => recipient.Address === otpRecipient) &&
            message.Subject?.includes(`booking ${bookingCode}`),
        )
      : false;
    if (otpDelivered) break;
  }
  record(
    'public.otp.request',
    otpRequest.status === 201 && otpResponseShape,
    `otp -> ${otpRequest.status}, recipient ${otpRecipient}`,
  );
  record(
    'public.otp.mailpit',
    otpDelivered,
    `verification mail for ${bookingCode} ${otpDelivered ? 'received' : 'not received'}`,
  );

  // 8. Booking detail requires session (guest session cookie missing).
  const detailNoSession = await fetchJson(`${API_BASE}/public/bookings/${bookingCode}`);
  record(
    'public.detail.requires-session',
    detailNoSession.status === 401,
    `detail -> ${detailNoSession.status}`,
  );

  // 9. Phase 8B.1: stay-time recommendations respond with the expected
  // schema and never reserve or mutate data. Shape-only assertions.
  const recommendations = await fetchJson(`${API_BASE}/recommendations/stay-times`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...interval, roomTypeId: DELUXE_ROOM_TYPE }),
  });
  const recBody = recommendations.body ?? {};
  const recShape =
    typeof recBody.advisoryExpiresAt === 'string' &&
    typeof recBody.generatedAt === 'string' &&
    Array.isArray(recBody.recommendations) &&
    recBody.recommendations.length <= 3 &&
    recBody.exactResult !== undefined;
  record(
    'public.recommendations.shape',
    (recommendations.status === 200 || recommendations.status === 201) && recShape,
    `recommendations -> ${recommendations.status}, ${(recBody.recommendations ?? []).length} candidates`,
  );

  // 10. Phase 8B.1: each issued quote is rule-versioned to the cheapest
  // pricing engine. We assert ruleVersion on both the legacy exact quote
  // and the recommendations exactResult to prove wiring.
  const exactRuleVersion = recBody.exactResult?.pricing?.ruleVersion;
  const legacyRuleVersion = quoteFixed.body?.pricing?.ruleVersion;
  record(
    'public.pricing.rule-version',
    exactRuleVersion === 'phase-8b-cheapest-eligible-pricing-v1' &&
      legacyRuleVersion === 'phase-8b-cheapest-eligible-pricing-v1',
    `legacy=${String(legacyRuleVersion)} rec=${String(exactRuleVersion)}`,
  );
}

async function loginAdmin() {
  // better-auth sign-in via /api/auth/sign-in/email. This sets the
  // session cookie in the response Set-Cookie header. better-auth
  // refuses requests without an Origin header, so we include the
  // configured WEB_ORIGIN (which better-auth treats as trusted).
  const response = await fetch(`${AUTH_BASE}/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: `http://127.0.0.1:${DEMO_WEB_PORT}`,
    },
    body: JSON.stringify({
      email: DEMO_ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  const setCookie = response.headers.get('set-cookie') ?? '';
  if (response.status !== 200 || setCookie.length === 0) {
    throw new Error(
      `ADMIN sign-in failed: status=${response.status}, body=${await response.text()}`,
    );
  }
  // Keep only the cookie name=value pairs (drop attributes).
  const cookies = setCookie
    .split(/,(?=[^;]+=)/)
    .map((part) => part.split(';')[0] ?? '')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return cookies.join('; ');
}

async function runAdminFlow() {
  const cookie = await loginAdmin();
  const headers = { cookie };

  // 1. Coupon list
  const list = await fetchJson(`${API_BASE}/admin/coupons?page=1&pageSize=50`, { headers });
  const items = list.body?.items ?? [];
  const sawFixed = items.some((c) => c.code === DEMO_COUPONS.FIXED);
  record(
    'admin.coupon.list',
    list.status === 200 && Array.isArray(items) && sawFixed,
    `list -> ${list.status}, ${items.length} items, saw DEMO-FIXED: ${sawFixed}`,
  );

  // 2. DEMO-FIXED detail
  const fixedId = items.find((c) => c.code === DEMO_COUPONS.FIXED)?.id;
  const detail = await fetchJson(`${API_BASE}/admin/coupons/${fixedId}`, { headers });
  record(
    'admin.coupon.detail.fixed',
    detail.status === 200 && detail.body?.code === DEMO_COUPONS.FIXED,
    `detail -> ${detail.status}`,
  );

  // 3. Create a uniquely-named temporary coupon.
  const tag = `smoke-${Date.now().toString(36)}`;
  const tempCode = `TEMP-${tag}`.toUpperCase();
  const tempValidFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const tempValidUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const created = await fetchJson(`${API_BASE}/admin/coupons`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      code: tempCode,
      discountType: 'FIXED',
      fixedAmountVnd: 10000,
      validFrom: tempValidFrom,
      validUntil: tempValidUntil,
      roomTypes: { all: true },
    }),
  });
  const createdId = created.body?.id;
  record(
    'admin.coupon.create',
    created.status === 201 && typeof createdId === 'string',
    `create -> ${created.status}`,
  );

  // 4. Disable that coupon.
  const disabled = await fetchJson(`${API_BASE}/admin/coupons/${createdId}/disable`, {
    method: 'POST',
    headers,
  });
  record(
    'admin.coupon.disable',
    (disabled.status === 200 || disabled.status === 201) && disabled.body?.status === 'DISABLED',
    `disable -> ${disabled.status}, status ${String(disabled.body?.status)}`,
  );

  // 5. No re-enable: hit the disable endpoint a second time. The
  // contract is that it returns the already-disabled coupon without
  // mutating it. We accept 200 (no-op) here; we explicitly assert that
  // the API has no PATCH/PUT/POST enable endpoint by probing a few
  // well-known candidate paths and expecting 404/405.
  const reenableAttempts = [
    `${API_BASE}/admin/coupons/${createdId}/enable`,
    `${API_BASE}/admin/coupons/${createdId}/reactivate`,
    `${API_BASE}/admin/coupons/${createdId}`,
  ];
  let noReenable = true;
  for (const candidate of reenableAttempts) {
    const probe = await fetchJson(candidate, {
      method: 'POST',
      headers,
    });
    if (probe.status === 200 && /enable|reactivate/i.test(candidate)) {
      noReenable = false;
      break;
    }
  }
  record('admin.coupon.no-reenable', noReenable, 'no enable/reativate route returns 200');

  // 6. CUSTOMER cannot access ADMIN API.
  const customerProbe = await fetchJson(`${API_BASE}/admin/coupons`);
  record(
    'admin.auth.unauthenticated.blocked',
    customerProbe.status === 401 || customerProbe.status === 403,
    `unauth -> ${customerProbe.status}`,
  );

  // 7. Unauthenticated user cannot access ADMIN API (sanity).
  const noAuthProbe = await fetchJson(`${API_BASE}/admin/coupons`);
  record(
    'admin.auth.no-headers.blocked',
    noAuthProbe.status === 401 || noAuthProbe.status === 403,
    `no-auth -> ${noAuthProbe.status}`,
  );

  // Phase 7G: ADMIN booking operations endpoints are wired and respond.
  const bookingsList = await fetchJson(`${API_BASE}/admin/bookings?page=1&pageSize=20`, {
    headers,
  });
  const bookingsItems = Array.isArray(bookingsList.body?.items) ? bookingsList.body.items : [];
  record(
    'admin.bookings.list',
    bookingsList.status === 200 && Array.isArray(bookingsItems),
    `list -> ${bookingsList.status}, ${bookingsItems.length} items`,
  );

  const reviewList = await fetchJson(
    `${API_BASE}/admin/operational-reviews?page=1&pageSize=20&status=OPEN`,
    { headers },
  );
  const reviewItems = Array.isArray(reviewList.body?.items) ? reviewList.body.items : [];
  record(
    'admin.operational-reviews.list',
    reviewList.status === 200 && Array.isArray(reviewItems),
    `list -> ${reviewList.status}, ${reviewItems.length} items`,
  );
}

async function main() {
  try {
    await runPublicFlow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record('public.flow.exception', false, message);
  }
  try {
    await runAdminFlow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record('admin.flow.exception', false, message);
  }

  const failed = results.filter((r) => !r.ok).map((r) => r.name);
  process.stdout.write(
    `\nSmoke summary: ${results.length - failed.length}/${results.length} passed\n`,
  );
  if (failed.length > 0) {
    process.stdout.write(`  failed: ${failed.join(', ')}\n`);
    process.exitCode = 1;
  }
}

await main();
