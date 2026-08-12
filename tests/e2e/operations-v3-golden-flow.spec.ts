import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect } from '@playwright/test';

import { setSimulatorMode } from './_fixtures/payment-test-helpers.mjs';
import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials.js';

test.describe.configure({ mode: 'serial' });

function resolveDatabaseUrl(): string {
  try {
    const url = readFileSync(join(tmpdir(), 'playwright-test-database-url.txt'), 'utf8').trim();
    if (url.length > 0) return url;
  } catch {
    // Fall through to env vars.
  }
  return (
    process.env.PLAYWRIGHT_TEST_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    'postgresql://room:room@127.0.0.1:5432/room_management_test_base'
  );
}

const DATABASE_URL = resolveDatabaseUrl();

interface TestDatabasePool {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[] }>;
  end(): Promise<void>;
}

const databaseRequire = createRequire(join(process.cwd(), 'packages', 'database', 'package.json'));
const { Pool } = databaseRequire('pg') as {
  readonly Pool: new (config: Record<string, unknown>) => TestDatabasePool;
};
const databasePool = new Pool({
  connectionString: DATABASE_URL,
  max: 1,
  application_name: 'room-management-playwright-golden-flow',
});

// The golden flow adds an isolated catalog fixture so every operational state
// transition can run through the application boundary. The generic fixture is
// deliberately not part of the curated public presentation catalog, so retire
// it after each run (including a failed run) before later public browser specs
// select their first available room type.
const goldenFixtureRoomTypeIds: string[] = [];
const goldenFixtureRoomIds: string[] = [];

test.afterEach(async () => {
  const roomIds = goldenFixtureRoomIds.splice(0);
  const roomTypeIds = goldenFixtureRoomTypeIds.splice(0);
  if (roomIds.length > 0) {
    await databasePool.query(`UPDATE rooms SET status = 'INACTIVE' WHERE id = ANY($1::uuid[])`, [
      roomIds,
    ]);
  }
  if (roomTypeIds.length > 0) {
    await databasePool.query(
      `UPDATE room_types SET status = 'INACTIVE' WHERE id = ANY($1::uuid[])`,
      [roomTypeIds],
    );
  }
});

const MAILPIT_API = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025';
const API_BASE = 'http://127.0.0.1:3101/api/v1';
const WEB_BASE = 'http://127.0.0.1:3100';
const SIMULATOR_BASE = 'http://127.0.0.1:3090';

const PROPERTY_ID = '10000000-0000-4000-8000-000000000001';
const PRICE_TIER_ID = '10000000-0000-4000-8000-000000000101';
const HOUSEKEEPING_STAFF_EMAIL = 'housekeeping.staff.playwright@example.test';

async function dbQuerySingleValue(sql: string, values?: readonly unknown[]): Promise<string> {
  const result = await databasePool.query<{ value: string }>(sql, values);
  return result.rows[0]?.value ?? '';
}

async function waitForDatabaseValue(
  sql: string,
  expected: string,
  values?: readonly unknown[],
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await dbQuerySingleValue(sql, values)) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for database value ${expected}`);
}

async function currentGoldenPricingWindowStart(now: Date): Promise<Date> {
  const startMinute = Number(
    await dbQuerySingleValue(
      `SELECT component.local_start_minute_inclusive::text AS value
         FROM pricing_policy_components component
         JOIN pricing_policy_versions policy ON policy.id = component.policy_version_id
        WHERE policy.property_id = $1
          AND policy.status = 'PUBLISHED'
          AND component.component_code = 'B0_FINAL_NIGHT'
        ORDER BY policy.published_at DESC NULLS LAST
        LIMIT 1`,
      [PROPERTY_ID],
    ),
  );
  if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute >= 1_440) {
    throw new Error(`Golden flow pricing window is invalid: ${String(startMinute)}`);
  }
  // The isolated Playwright property has the fixed Asia/Ho_Chi_Minh UTC+07:00
  // timezone. Convert its current local calendar day and policy minute back to
  // an instant without coupling the test to the host timezone.
  const propertyLocal = new Date(now.getTime() + 7 * 60 * 60_000);
  let candidate = new Date(
    Date.UTC(
      propertyLocal.getUTCFullYear(),
      propertyLocal.getUTCMonth(),
      propertyLocal.getUTCDate(),
      0,
      startMinute,
    ) -
      7 * 60 * 60_000,
  );
  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60_000);
  }
  return candidate;
}

interface MailpitMessage {
  readonly ID: string;
  readonly To: readonly { readonly Address: string }[];
  readonly Subject: string;
}

async function listMailpitMessages(): Promise<readonly MailpitMessage[]> {
  const response = await fetch(`${MAILPIT_API}/api/v1/messages`);
  if (!response.ok) {
    throw new Error(`Mailpit messages request failed: ${response.status}`);
  }
  const body = (await response.json()) as { messages?: readonly MailpitMessage[] };
  return body.messages ?? [];
}

async function fetchMailpitMessage(id: string): Promise<string> {
  const response = await fetch(`${MAILPIT_API}/api/v1/message/${id}`);
  if (!response.ok) {
    throw new Error(`Mailpit message fetch failed: ${response.status}`);
  }
  const body = (await response.json()) as {
    readonly Text?: string;
    readonly HTML?: string;
  };
  return body.Text ?? body.HTML ?? '';
}

async function waitForOtpEmail(recipientEmail: string): Promise<string> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const messages = await listMailpitMessages();
    const otpMessage = messages.find(
      (message) =>
        message.To.some((recipient) => recipient.Address === recipientEmail) &&
        /verification/i.test(message.Subject),
    );
    if (otpMessage !== undefined) {
      const body = await fetchMailpitMessage(otpMessage.ID);
      const match = body.match(/(?:^|\s|\D)(\d{6})(?:\s|$|\D)/);
      if (match?.[1] !== undefined) {
        return match[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Mailpit did not receive OTP email for ${recipientEmail}`);
}

/**
 * ORIG-H-001: Full booking-to-next-booking connected lifecycle
 *
 * This is the canonical golden flow that proves the entire Operations V3
 * release candidate meets the original authority requirements for a
 * production-shaped multi-night stay lifecycle.
 *
 * CRITICAL: This test uses ONLY real API boundaries. NO direct database
 * fabrication of lifecycle states (CONFIRMED, CHECKED_IN, CHECKED_OUT).
 */
test('GOLDEN FLOW: quote → HOLD → payment → CONFIRMED → T-30 credential → check-in → stay → checkout → housekeeping → READY → next booking', async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];

  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !/Failed to load resource: the server responded with a status of 401/.test(message.text())
    ) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText;
    const url = request.url();
    if (
      errorText === 'net::ERR_ABORTED' &&
      (url.includes('/_next/static/chunks/') ||
        url.includes('/__nextjs_font/') ||
        url.endsWith('/api/auth/get-session'))
    ) {
      return;
    }
    requestFailures.push(`${request.method()} ${url} ${errorText}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      requestFailures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  // Isolated catalog fixture creation is permitted. Lifecycle state changes
  // below are exclusively through the application APIs.
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const fixtureCode = `GOLDEN_${roomTypeId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  goldenFixtureRoomTypeIds.push(roomTypeId);
  goldenFixtureRoomIds.push(roomId);
  await databasePool.query(
    `INSERT INTO room_types
       (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
     VALUES ($1, $2, $3, $4, 'Golden lifecycle room type', 2, 0, 2)`,
    [roomTypeId, PROPERTY_ID, PRICE_TIER_ID, fixtureCode],
  );
  await databasePool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number)
     VALUES ($1, $2, $3, $4)`,
    [roomId, PROPERTY_ID, roomTypeId, `G-${fixtureCode.slice(-6)}`],
  );

  // ===========================================
  // PREREQUISITE: Admin session for check-in/check-out/housekeeping operations
  // ===========================================
  await page.goto(`${WEB_BASE}/admin/login`);
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // Wait for redirect to admin dashboard
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10000 });

  // Verify admin session is established by checking a protected page
  await page.goto(`${WEB_BASE}/admin/room-operations`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1', { hasText: 'Tình trạng phòng' })).toBeVisible();

  // ===========================================
  // PREREQUISITE: Pricing policy is seeded by playwright-global-setup.ts
  // via seedPlaywrightB0Policy() which creates a complete bootstrapped policy
  // with proper overnight window, rate plan mappings, and published status.
  // ===========================================

  // ===========================================
  // 1. CREATE QUOTE VIA API
  // ===========================================
  // Request a real multi-night stay shortly before check-in. The test policy
  // retains B0's complete-coverage shape but has a fixture clock window far
  // enough ahead for its leading boundary component to cover this interval.
  const now = new Date();
  const checkInDate = new Date(Math.ceil((now.getTime() + 45 * 1_000) / 1_000) * 1_000);
  const firstPricingWindowStart = await currentGoldenPricingWindowStart(now);
  expect(firstPricingWindowStart.getTime()).toBeGreaterThan(checkInDate.getTime());
  const checkOutDate = new Date(firstPricingWindowStart.getTime() + 2 * 24 * 60 * 60 * 1000);

  const checkInISO = checkInDate.toISOString();
  const checkOutISO = checkOutDate.toISOString();

  const quoteResponse = await fetch(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomTypeId,
      checkIn: checkInISO,
      checkOut: checkOutISO,
      adults: 2,
      children: 0,
      mode: 'multi_night',
    }),
  });

  if (!quoteResponse.ok) {
    throw new Error(
      `Quote creation failed for ${checkInISO} -> ${checkOutISO}: ${quoteResponse.status} ${await quoteResponse.text()}`,
    );
  }

  const quote = (await quoteResponse.json()) as {
    id: string;
    propertyId: string;
    pricing: { finalAmountVnd: number; selectionReason?: string; alternatives?: unknown[] };
  };

  // INVARIANT: ONE_QUOTE
  expect(quote.id).toBeTruthy();

  // INVARIANT: G-004 pricing explanation contract
  expect(quote.propertyId).toBe(PROPERTY_ID);
  expect(quote.pricing.finalAmountVnd).toBeGreaterThan(0);
  expect(quote.pricing.selectionReason).toBeTruthy();
  expect(quote.pricing.alternatives).toEqual(expect.any(Array));

  // ===========================================
  // 2. CREATE HOLD VIA API
  // ===========================================
  const testEmail = `golden-flow-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const testPhone = '+84909123456';

  const holdResponse = await fetch(`${API_BASE}/public/quotes/${quote.id}/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contact: {
        fullName: 'Golden Flow Test',
        email: testEmail,
        phone: testPhone,
      },
    }),
  });

  if (!holdResponse.ok) {
    throw new Error(`HOLD creation failed: ${holdResponse.status} ${await holdResponse.text()}`);
  }

  const holdResult = (await holdResponse.json()) as { bookingCode: string };
  const bookingCode = holdResult.bookingCode;

  // INVARIANT: ONE_HOLD, ONE_BOOKING
  expect(bookingCode).toMatch(/^[A-Z0-9-]{6,32}$/);

  // Verify ONE physical room allocated via database read (allowed for verification)
  const allocatedRoomId = await dbQuerySingleValue(
    `SELECT room_id::text AS value FROM bookings WHERE booking_code = $1`,
    [bookingCode],
  );
  expect(allocatedRoomId).toBeTruthy();

  // INVARIANT: ONE_PHYSICAL_ROOM_FOR_WHOLE_STAY
  const bookingId = await dbQuerySingleValue(
    `SELECT id::text AS value FROM bookings WHERE booking_code = $1`,
    [bookingCode],
  );

  // ===========================================
  // 3. ESTABLISH GUEST SESSION VIA OTP
  // ===========================================
  const otpRequestResponse = await fetch(`${API_BASE}/public/guest-access/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bookingCode, email: testEmail }),
  });

  if (!otpRequestResponse.ok) {
    throw new Error(`OTP request failed: ${otpRequestResponse.status}`);
  }

  const otpRequest = (await otpRequestResponse.json()) as { challengeRef: string };
  const otp = await waitForOtpEmail(testEmail);

  const otpVerifyResponse = await fetch(`${API_BASE}/public/guest-access/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeRef: otpRequest.challengeRef, otp }),
  });

  if (!otpVerifyResponse.ok) {
    throw new Error(`OTP verify failed: ${otpVerifyResponse.status}`);
  }

  const setCookie = otpVerifyResponse.headers.get('set-cookie');
  expect(setCookie).toContain('rm_guest_session_v1=');
  const sessionCookie = setCookie?.split(';')[0]?.split('=')[1]?.trim();
  expect(sessionCookie).toBeTruthy();

  // ===========================================
  // 4. INITIATE MOMO PAYMENT VIA API (using simulator in verify mode)
  // ===========================================
  // Set simulator to verify mode for auto-settlement
  const simulatorResponse = await fetch(`${SIMULATOR_BASE}/__control/momo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'verify', redirectDelayMs: 0, duplicateIpns: true }),
  });
  expect(simulatorResponse.ok).toBe(true);

  const paymentAttemptResponse = await fetch(
    `${API_BASE}/public/bookings/${bookingCode}/payments/momo/attempts`,
    {
      method: 'POST',
      headers: {
        cookie: `rm_guest_session_v1=${sessionCookie}`,
        'idempotency-key': `golden-${Date.now()}-${randomUUID()}`,
        accept: 'application/json',
      },
    },
  );

  if (!paymentAttemptResponse.ok) {
    throw new Error(
      `Payment initiation failed: ${paymentAttemptResponse.status} ${await paymentAttemptResponse.text()}`,
    );
  }

  const paymentAttempt = (await paymentAttemptResponse.json()) as { redirectUrl: string };
  expect(paymentAttempt.redirectUrl).toContain('momo');

  // INVARIANT: browser navigation is not itself payment authority.
  expect(
    await dbQuerySingleValue(`SELECT status::text AS value FROM bookings WHERE id = $1`, [
      bookingId,
    ]),
  ).toBe('HOLD');

  // Visit the payment simulator URL to trigger the IPN callback
  await page.goto(paymentAttempt.redirectUrl, { waitUntil: 'domcontentloaded' });

  // INVARIANT: ONE_PAYMENT
  // Wait for Momo simulator callback to settle payment and redirect
  await expect(page).toHaveURL(/\/booking\/manage\/[A-Z0-9-]+$/, { timeout: 30_000 });

  // Verify payment and booking status
  const paymentStatus = await dbQuerySingleValue(
    `SELECT status::text AS value FROM payments WHERE booking_id = $1`,
    [bookingId],
  );
  const bookingStatus = await dbQuerySingleValue(
    `SELECT status::text AS value FROM bookings WHERE id = $1`,
    [bookingId],
  );

  // INVARIANT: SIGNED_CALLBACK_IS_AUTHORITY
  expect(paymentStatus).toBe('SUCCEEDED');
  expect(bookingStatus).toBe('CONFIRMED');
  expect(
    await dbQuerySingleValue(
      `SELECT count(*)::text AS value FROM payments WHERE booking_id = $1 AND status = 'SUCCEEDED'`,
      [bookingId],
    ),
  ).toBe('1');

  // Verify same physical room remains after payment confirmation
  const confirmedRoomId = await dbQuerySingleValue(
    `SELECT room_id::text AS value FROM bookings WHERE id = $1`,
    [bookingId],
  );
  expect(confirmedRoomId).toBe(allocatedRoomId);
  expect(
    await dbQuerySingleValue(`SELECT property_id::text AS value FROM bookings WHERE id = $1`, [
      bookingId,
    ]),
  ).toBe(PROPERTY_ID);

  // ===========================================
  // 5. ENSURE ROOM READINESS FOR CREDENTIAL ISSUANCE
  // ===========================================
  // The isolated fixture room is created ACTIVE and CLEAN.

  // ===========================================
  // 6. T-30 CREDENTIAL TIMING THROUGH THE CONTINUOUS WORKER
  // ===========================================
  // The worker is part of the live Playwright stack.
  // It must issue an eligible credential at T-30 without creating a duplicate.
  // The post-payment polling below proves issuance and duplicate-worker safety.
  // Checkout later verifies revocation of this same issued credential.
  await waitForDatabaseValue(
    `SELECT count(*)::text AS value
       FROM access_credentials
      WHERE booking_id = $1 AND status IN ('ISSUED', 'DELIVERED')`,
    '1',
    [bookingId],
  );
  expect(
    await dbQuerySingleValue(
      `SELECT count(*)::text AS value FROM access_credentials WHERE booking_id = $1`,
      [bookingId],
    ),
  ).toBe('1');
  await page.waitForTimeout(1_000);
  expect(
    await dbQuerySingleValue(
      `SELECT count(*)::text AS value FROM access_credentials WHERE booking_id = $1`,
      [bookingId],
    ),
  ).toBe('1');

  // ===========================================
  // 7. ADMIN CHECK-IN VIA API
  // ===========================================
  // Wait until check-in time is reached.
  // Calculate remaining wait time to ensure now >= checkIn
  const nowBeforeCheckIn = new Date();
  const msUntilCheckIn = checkInDate.getTime() - nowBeforeCheckIn.getTime();
  if (msUntilCheckIn > 0) {
    await page.waitForTimeout(msUntilCheckIn + 1000); // +1s buffer
  }

  // Use page.request API which properly handles browser context cookies.
  // No body/content-type: matches the admin-api client (empty POST, no JSON payload).
  const checkInResponse = await page.request.post(
    `${API_BASE}/admin/bookings/${bookingCode}/check-in`,
  );

  if (!checkInResponse.ok()) {
    throw new Error(`Check-in failed: ${checkInResponse.status()} ${await checkInResponse.text()}`);
  }

  const checkInResult = (await checkInResponse.json()) as { status: string };
  expect(checkInResult.status).toBe('CHECKED_IN');

  // ===========================================
  // 8. MULTI-NIGHT STAY (SAME ROOM)
  // ===========================================
  // Verify room remains the same throughout stay
  const stayRoomId = await dbQuerySingleValue(
    `SELECT room_id::text AS value FROM bookings WHERE id = $1`,
    [bookingId],
  );
  expect(stayRoomId).toBe(allocatedRoomId);

  const stayStatus = await dbQuerySingleValue(
    `SELECT status::text AS value FROM bookings WHERE id = $1`,
    [bookingId],
  );
  expect(stayStatus).toBe('CHECKED_IN');

  // ===========================================
  // 9. ADMIN CHECK-OUT VIA API
  // ===========================================
  const checkOutResponse = await page.request.post(
    `${API_BASE}/admin/bookings/${bookingCode}/check-out`,
  );

  if (!checkOutResponse.ok()) {
    throw new Error(
      `Check-out failed: ${checkOutResponse.status()} ${await checkOutResponse.text()}`,
    );
  }

  const checkOutResult = (await checkOutResponse.json()) as { status: string };

  // INVARIANT: FINAL_CHECKOUT_ONLY
  expect(checkOutResult.status).toBe('CHECKED_OUT');

  // ===========================================
  // 10. ACCESS CREDENTIAL REVOKED
  // ===========================================
  // The same T-30 credential must be revoked by this checkout.

  // ===========================================
  expect(
    await dbQuerySingleValue(
      `SELECT count(*)::text AS value
         FROM access_credentials
        WHERE booking_id = $1 AND status = 'REVOKED'`,
      [bookingId],
    ),
  ).toBe('1');

  // 11. ROOM BECOMES DIRTY
  // ===========================================
  const roomHousekeepingStatus = await dbQuerySingleValue(
    `SELECT housekeeping_status::text AS value FROM rooms WHERE id = $1`,
    [allocatedRoomId],
  );
  expect(roomHousekeepingStatus).toBe('DIRTY');

  // ===========================================
  // 12. ONE TURNOVER TASK CREATED
  // ===========================================
  const taskCount = await dbQuerySingleValue(
    `SELECT count(*)::text AS value
       FROM housekeeping_tasks
      WHERE booking_id = $1 AND type = 'TURNOVER'`,
    [bookingId],
  );

  // INVARIANT: ONE_TURNOVER_TASK
  expect(parseInt(taskCount, 10)).toBe(1);

  const taskId = await dbQuerySingleValue(
    `SELECT id::text AS value
       FROM housekeeping_tasks
      WHERE booking_id = $1 AND type = 'TURNOVER'`,
    [bookingId],
  );
  expect(taskId).toBeTruthy();

  const taskVersion = await dbQuerySingleValue(
    `SELECT version::text AS value FROM housekeeping_tasks WHERE id = $1`,
    [taskId],
  );

  // ===========================================
  // 13. MANAGER ASSIGNS TASK VIA API
  // ===========================================
  // Get the seeded HOUSEKEEPING_STAFF user for assignment.
  const staffUserId = await dbQuerySingleValue(
    `SELECT u.id::text AS value
       FROM users u
       JOIN admin_memberships am ON am.user_id = u.id
      WHERE u.email = $1
        AND am.role = 'HOUSEKEEPING_STAFF'
        AND am.status = 'ACTIVE'
      LIMIT 1`,
    [HOUSEKEEPING_STAFF_EMAIL],
  );

  if (!staffUserId) {
    throw new Error('No HOUSEKEEPING_STAFF user found for assignment');
  }

  const assignResponse = await page.request.patch(
    `${API_BASE}/admin/rooms/${allocatedRoomId}/housekeeping/assignment`,
    {
      headers: {
        'content-type': 'application/json',
      },
      data: { assigneeId: staffUserId, expectedVersion: parseInt(taskVersion, 10) },
    },
  );

  if (!assignResponse.ok()) {
    throw new Error(
      `Task assignment failed: ${assignResponse.status()} ${await assignResponse.text()}`,
    );
  }
  const assignment = (await assignResponse.json()) as { version: number };

  // INVARIANT: ASSIGNMENT_AUDITED (verify via audit log)
  const assignmentAudit = await dbQuerySingleValue(
    `SELECT count(*)::text AS value
       FROM audit_events
      WHERE aggregate_type = 'HOUSEKEEPING_TASK'
        AND aggregate_id = $1
        AND event_type = 'ROOM_HOUSEKEEPING_ASSIGNED'`,
    [taskId],
  );
  expect(parseInt(assignmentAudit, 10)).toBeGreaterThan(0);

  // ===========================================
  // 14. STAFF STARTS CLEANING VIA API (room housekeeping status: DIRTY -> CLEANING)
  // ===========================================
  const browser = context.browser();
  if (browser === null)
    throw new Error('Playwright browser is unavailable for staff authentication');
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await staffPage.goto(`${WEB_BASE}/admin/login`);
  await staffPage.getByLabel('Email').fill(HOUSEKEEPING_STAFF_EMAIL);
  await staffPage.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await staffPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(staffPage).toHaveURL(/\/admin\/room-operations$/, { timeout: 10_000 });

  const startResponse = await staffPage.request.patch(
    `${API_BASE}/admin/rooms/${allocatedRoomId}/housekeeping`,
    {
      headers: {
        'content-type': 'application/json',
      },
      data: { status: 'CLEANING', expectedVersion: assignment.version },
    },
  );

  if (!startResponse.ok()) {
    throw new Error(`Task start failed: ${startResponse.status()} ${await startResponse.text()}`);
  }

  // INVARIANT: START_AUDITED (task transitions to IN_PROGRESS as a side effect of the room status update)
  const startTaskStatus = await dbQuerySingleValue(
    `SELECT status::text AS value FROM housekeeping_tasks WHERE id = $1`,
    [taskId],
  );
  expect(startTaskStatus).toBe('IN_PROGRESS');

  const startTaskVersion = await dbQuerySingleValue(
    `SELECT version::text AS value FROM housekeeping_tasks WHERE id = $1`,
    [taskId],
  );

  const startAudit = await dbQuerySingleValue(
    `SELECT count(*)::text AS value
       FROM audit_events
      WHERE aggregate_type = 'ROOM'
        AND aggregate_id = $1
        AND event_type = 'ROOM_HOUSEKEEPING_UPDATED'`,
    [allocatedRoomId],
  );
  expect(parseInt(startAudit, 10)).toBeGreaterThan(0);

  // ===========================================
  // 15. STAFF COMPLETES CLEANING VIA API (room housekeeping status: CLEANING -> CLEAN)
  // ===========================================
  const completeResponse = await staffPage.request.patch(
    `${API_BASE}/admin/rooms/${allocatedRoomId}/housekeeping`,
    {
      headers: {
        'content-type': 'application/json',
      },
      data: { status: 'CLEAN', expectedVersion: parseInt(startTaskVersion, 10) },
    },
  );

  if (!completeResponse.ok()) {
    throw new Error(
      `Task complete failed: ${completeResponse.status()} ${await completeResponse.text()}`,
    );
  }

  // INVARIANT: COMPLETE_AUDITED (task transitions to DONE as a side effect of the room status update)
  const completeTaskStatus = await dbQuerySingleValue(
    `SELECT status::text AS value FROM housekeeping_tasks WHERE id = $1`,
    [taskId],
  );
  expect(completeTaskStatus).toBe('DONE');

  const completeTaskVersion = await dbQuerySingleValue(
    `SELECT version::text AS value FROM housekeeping_tasks WHERE id = $1`,
    [taskId],
  );
  await staffContext.close();

  // ===========================================
  // 16. MANAGER VERIFIES VIA API
  // ===========================================
  const verifyResponse = await page.request.patch(
    `${API_BASE}/admin/rooms/${allocatedRoomId}/housekeeping/verification`,
    {
      headers: {
        'content-type': 'application/json',
      },
      data: { expectedVersion: parseInt(completeTaskVersion, 10) },
    },
  );

  if (!verifyResponse.ok()) {
    throw new Error(
      `Task verification failed: ${verifyResponse.status()} ${await verifyResponse.text()}`,
    );
  }

  // INVARIANT: VERIFY_AUDITED
  const verifyAudit = await dbQuerySingleValue(
    `SELECT count(*)::text AS value
       FROM audit_events
      WHERE aggregate_type = 'HOUSEKEEPING_TASK'
        AND aggregate_id = $1
        AND event_type = 'ROOM_HOUSEKEEPING_VERIFIED'`,
    [taskId],
  );
  expect(parseInt(verifyAudit, 10)).toBeGreaterThan(0);

  // ===========================================
  // 17. SERVER-DERIVED READY STATUS
  // ===========================================
  const roomOpsFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const roomOpsTo = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const roomOperationsResponse = await page.request.get(`${API_BASE}/admin/room-operations`, {
    headers: {
      accept: 'application/json',
    },
    params: {
      from: roomOpsFrom,
      to: roomOpsTo,
    },
  });

  if (!roomOperationsResponse.ok()) {
    throw new Error(`Room operations fetch failed: ${roomOperationsResponse.status()}`);
  }

  const roomOperations = (await roomOperationsResponse.json()) as {
    items: readonly { roomId: string; displayGroup: string; housekeepingStatus: string }[];
  };

  const goldenRoom = roomOperations.items.find((room) => room.roomId === allocatedRoomId);
  expect(goldenRoom).toBeTruthy();

  // INVARIANT: READY_DERIVED_SERVER_SIDE
  expect(goldenRoom!.displayGroup).toBe('ready');
  expect(goldenRoom!.housekeepingStatus).toBe('CLEAN');

  // ===========================================
  // 18. NEXT BOOKING CAN USE SAME ROOM
  // ===========================================
  // Create another HOLD for a non-overlapping interval after the original
  // scheduled stay. The isolated room type has only one physical room.
  const nextCheckInDate = new Date(checkOutDate.getTime() + 30 * 60 * 1000);
  const nextCheckOutDate = new Date(nextCheckInDate.getTime() + 3 * 60 * 60 * 1000);

  const nextCheckInISO = nextCheckInDate.toISOString();
  const nextCheckOutISO = nextCheckOutDate.toISOString();

  const nextQuoteResponse = await fetch(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomTypeId,
      checkIn: nextCheckInISO,
      checkOut: nextCheckOutISO,
      adults: 2,
      children: 0,
      mode: 'hourly',
    }),
  });

  if (!nextQuoteResponse.ok) {
    throw new Error(
      `Next quote creation failed: ${nextQuoteResponse.status} ${await nextQuoteResponse.text()}`,
    );
  }

  const nextQuote = (await nextQuoteResponse.json()) as { id: string };

  // INVARIANT: NEXT_BOOKING_NO_OVERLAP
  expect(nextQuote.id).toBeTruthy();
  const nextHoldResponse = await fetch(`${API_BASE}/public/quotes/${nextQuote.id}/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contact: {
        fullName: 'Golden Flow Next Guest',
        email: `golden-next-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`,
        phone: '+84909123457',
      },
    }),
  });
  if (!nextHoldResponse.ok) {
    throw new Error(
      `Next HOLD creation failed: ${nextHoldResponse.status} ${await nextHoldResponse.text()}`,
    );
  }
  const nextHold = (await nextHoldResponse.json()) as { bookingCode: string };
  const nextAllocatedRoomId = await dbQuerySingleValue(
    `SELECT room_id::text AS value FROM bookings WHERE booking_code = $1`,
    [nextHold.bookingCode],
  );
  expect(nextAllocatedRoomId).toBe(allocatedRoomId);

  // Verify inventory blocks are released for the original booking
  const activeBlockCount = await dbQuerySingleValue(
    `SELECT count(*)::text AS value
       FROM room_inventory_blocks
      WHERE booking_id = $1 AND status = 'ACTIVE'`,
    [bookingId],
  );
  expect(parseInt(activeBlockCount, 10)).toBe(0);

  // ===========================================
  // FINAL INVARIANTS VERIFICATION
  // ===========================================
  if (consoleErrors.length > 0) {
    console.warn('Console errors detected:', consoleErrors);
  }
  if (pageErrors.length > 0) {
    throw new Error(`Page errors detected: ${pageErrors.join('; ')}`);
  }
  if (requestFailures.length > 0) {
    throw new Error(`Request failures detected: ${requestFailures.join('; ')}`);
  }
});
