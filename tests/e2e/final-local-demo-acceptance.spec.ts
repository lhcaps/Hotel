/**
 * tests/e2e/final-local-demo-acceptance.spec.ts
 *
 * Final local demo acceptance suite for the customer-delivery closure.
 * Drives the entire demo stack through a real Chromium browser against
 * the canonical loopback origins:
 *   WEB=http://localhost:3000
 *   API=http://localhost:3001
 *   SIM=http://localhost:3090
 *   MAILPIT=http://localhost:8025
 *
 * The suite is intentionally consolidated for run-once-per-CI purposes.
 * Helpers from `_fixtures/payment-test-helpers.mjs` and
 * `_fixtures/booking-otp.mjs` still target the standalone Playwright
 * test stack (port 3100/3101) so this file implements its own
 * Mailpit/OTP and payment-status reads using the canonical stack.
 */

import { expect, test, type Page, type Response } from '@playwright/test';

const WEB = 'http://localhost:3000';
const API = 'http://localhost:3001';
const SIM = 'http://localhost:3090';
const MAILPIT = 'http://localhost:8025';

const ADMIN_EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'demo-verify@room.local';
const ADMIN_PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'Aa1-KnownVerifyPass-1234';

interface MailpitMessage {
  readonly ID: string;
  readonly Subject: string;
  readonly Created: string;
  readonly To: ReadonlyArray<{ readonly Address: string }>;
}

async function waitForMailpit(
  recipientEmail: string,
  subjectPattern: RegExp,
  timeoutMs = 60_000,
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const messagesResponse = await fetch(`${MAILPIT}/api/v1/messages`);
    if (messagesResponse.ok) {
      const body = (await messagesResponse.json()) as {
        readonly messages: ReadonlyArray<MailpitMessage>;
      };
      const matched = body.messages?.find(
        (message) =>
          message.To?.some((recipient) => recipient.Address === recipientEmail) &&
          subjectPattern.test(message.Subject ?? ''),
      );
      if (matched) return matched;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Mailpit did not deliver a message to ${recipientEmail} matching ${String(subjectPattern)}`,
  );
}

async function readMailpitBody(messageId: string): Promise<string> {
  const response = await fetch(`${MAILPIT}/api/v1/message/${messageId}`);
  if (!response.ok) {
    throw new Error(`Mailpit message read failed: ${response.status}`);
  }
  const body = (await response.json()) as { Text?: string; HTML?: string };
  return body.Text ?? body.HTML ?? '';
}

async function countMatchingMailpit(
  recipientEmail: string,
  subjectPattern: RegExp,
  timeoutMs = 6_000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let last = 0;
  while (Date.now() < deadline) {
    const messagesResponse = await fetch(`${MAILPIT}/api/v1/messages`);
    if (messagesResponse.ok) {
      const body = (await messagesResponse.json()) as {
        readonly messages: ReadonlyArray<MailpitMessage>;
      };
      last = (body.messages ?? []).filter(
        (message) =>
          message.To?.some((recipient) => recipient.Address === recipientEmail) &&
          subjectPattern.test(message.Subject ?? ''),
      ).length;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return last;
}

async function readSimulatorCounters(): Promise<{
  momoIpnAttempts: number;
  vnpayIpnAttempts: number;
  defaultBackRedirectBase: string;
}> {
  const response = await fetch(`${SIM}/__health`);
  const body = (await response.json()) as {
    counts: { momoIpnAttempts: number; vnpayIpnAttempts: number };
    defaultBackRedirectBase: string;
  };
  return {
    momoIpnAttempts: body.counts.momoIpnAttempts,
    vnpayIpnAttempts: body.counts.vnpayIpnAttempts,
    defaultBackRedirectBase: body.defaultBackRedirectBase,
  };
}

async function resetSimulator(): Promise<void> {
  for (const provider of ['momo', 'vnpay'] as const) {
    await fetch(`${SIM}/__control/${provider}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'verify',
        redirectDelayMs: 0,
        duplicateIpns: false,
        backRedirectUrl: '',
      }),
    });
  }
}

async function adminLogin(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto(`${WEB}/admin/login`);
  await page.fill('input[name=email]', ADMIN_EMAIL);
  await page.fill('input[name=password]', ADMIN_PASSWORD);
  await page.click('button[type=submit]');
  // Wait for the admin shell to render before continuing. The login
  // form's `fetch('/api/admin/me')` post-submit must complete first
  // so the session cookie has been set on the WEB origin.
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 30_000 });
  await expect(page.locator('.admin-layout, [data-admin-layout]').first()).toBeVisible({
    timeout: 30_000,
  });
  // Give the browser a chance to commit any pending Set-Cookie from
  // the same-origin proxy response before the next test inspects the
  // cookie jar.
  await page.waitForTimeout(500);
}

async function expectNoForbiddenErrors(consoleErrors: ReadonlyArray<string>) {
  const filtered = consoleErrors.filter(
    (line) => !/fontawesome|cdn\.jsdelivr\.net|cloudflare-insights|favicon/i.test(line),
  );
  expect(filtered, `unexpected console errors:\n${filtered.join('\n')}`).toEqual([]);
}

async function expectStatus(response: Response | null, expected: number) {
  if (response === null) throw new Error('expected response, got null');
  const ok =
    response.status() === expected ||
    (expected === 200 && response.status() >= 200 && response.status() < 400);
  expect(ok, `status=${response.status()} expected~${expected}`).toBeTruthy();
}

async function buildCustomerBooking(
  page: Page,
  providerButtonLabel: RegExp,
): Promise<{ bookingCode: string; recipientEmail: string }> {
  const recipientEmail = `finaldemo+${Date.now()}@mailpit.test`;
  // Try several candidate windows until the search shows at least one room
  // card. The DEMO seed only allocates rooms for specific hours and may
  // already have bookings covering a single candidate.
  const pad = (n: number) => String(n).padStart(2, '0');
  type SearchAttempt = { daysOut: number; hour: number };
  const attempts: ReadonlyArray<SearchAttempt> = [
    { daysOut: 1, hour: 11 },
    { daysOut: 1, hour: 12 },
    { daysOut: 2, hour: 11 },
    { daysOut: 2, hour: 12 },
    { daysOut: 3, hour: 11 },
    { daysOut: 3, hour: 12 },
    { daysOut: 4, hour: 11 },
    { daysOut: 4, hour: 12 },
    { daysOut: 5, hour: 11 },
    { daysOut: 5, hour: 12 },
    { daysOut: 6, hour: 11 },
    { daysOut: 6, hour: 12 },
  ];

  let sawRoomCard = false;
  for (const attempt of attempts) {
    const target = new Date(Date.now() + attempt.daysOut * 24 * 60 * 60_000);
    const checkInDate = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    const checkIn = `${checkInDate}T${pad(attempt.hour)}:00:00+07:00`;
    const checkOutDateTime = new Date(target.getTime());
    checkOutDateTime.setHours(attempt.hour + 1, 0, 0, 0);
    const checkOut = `${checkInDate}T${pad(checkOutDateTime.getHours())}:00:00+07:00`;
    await page.goto(
      `${WEB}/booking/search?mode=hourly&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&adults=2&children=0`,
    );
    await expect(page.getByRole('button', { name: 'Tìm phòng' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Tìm phòng' }).click();
    await page.waitForLoadState('networkidle');
    // The hourly search results render availability-room-<roomTypeId>
    // test-ids. Fall back to the search results heading when the slot is
    // fully sold out for the candidate window.
    const card = page.locator('[data-testid^="availability-room-"]').first();
    try {
      await card.waitFor({ state: 'visible', timeout: 15_000 });
      sawRoomCard = true;
      break;
    } catch {
      // Continue to the next attempt; the previous one may have rendered
      // the empty state.
    }
  }
  if (!sawRoomCard) {
    throw new Error('No available hourly rooms across the candidate windows');
  }

  const firstCard = page.locator('[data-testid^="availability-room-"]').first();
  await expect(firstCard).toBeVisible({ timeout: 60_000 });
  await firstCard.getByRole('link', { name: /Xem phòng/i }).click();

  const planButtons = page.getByTestId('room-detail-plan');
  await expect(planButtons.first()).toBeVisible({ timeout: 30_000 });
  await planButtons.first().click();
  await expect(page.getByRole('button', { name: /Xem giá chính thức/ })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: /Xem giá chính thức/ }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Thông tin liên hệ/ })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel('Họ và tên').fill('Demo Final Customer');
  await page.getByLabel('Email').fill(recipientEmail);
  await page.getByLabel('Số điện thoại (E.164)').fill('+84909000123');
  await page.getByRole('button', { name: /Giữ chỗ/ }).click();
  await expect(page.getByTestId('hold-success-panel')).toBeVisible({ timeout: 30_000 });
  const rawBookingCode = await page.getByTestId('hold-booking-code').innerText();
  const bookingCode = rawBookingCode.trim();
  expect(bookingCode).toMatch(/^[A-Z0-9-]+$/);

  // OTP
  await page.goto(`${WEB}/booking/manage`);
  await page.getByLabel('Mã đặt phòng').fill(bookingCode);
  await page.getByLabel('Email').fill(recipientEmail);
  const otpReqPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/public/guest-access/otp/request') && response.status() < 400,
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: 'Gửi mã xác nhận' }).click();
  await otpReqPromise;

  const verificationMessage = await waitForMailpit(recipientEmail, /verification/i, 60_000);
  const body = await readMailpitBody(verificationMessage.ID);
  const otpMatch = /(?:\D|^)(\d{6})(?:\D|$)/.exec(body);
  if (!otpMatch) throw new Error('OTP not present in verification email');
  const otp = otpMatch[1]!;

  await page.getByRole('textbox', { name: /Mã xác nhận|Mã xác minh/ }).fill(otp);
  await page.getByRole('button', { name: /Xác nhận|Xác minh/ }).click();
  await expect(page).toHaveURL(new RegExp(`/booking/manage/${bookingCode}$`));

  await resetSimulator();
  const providerButton = page.getByRole('button', { name: providerButtonLabel });
  await expect(providerButton).toBeVisible({ timeout: 30_000 });
  await providerButton.click();
  // The simulator will host either 127.0.0.1 or localhost, and after the
  // IPN settles it redirects back to /booking/manage/{bookingCode}.
  await expect(page).toHaveURL(new RegExp(`/booking/manage/${bookingCode}$`), { timeout: 30_000 });

  return { bookingCode, recipientEmail };
}

test.describe.configure({ mode: 'serial' });
test.describe('Final local demo acceptance', () => {
  test.setTimeout(240_000);

  test('A. public catalog renders on landing', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const response = await page.goto(WEB + '/');
    await expectStatus(response, 200);
    await expect(page.getByRole('heading', { name: /Không gian dành cho bạn/ })).toBeVisible();
    await expectNoForbiddenErrors(consoleErrors);
  });

  test('B. CUSTOMER pages behave for unauthenticated browser and report 401 from API', async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto(`${WEB}/account/profile`);
    await expect(page.getByText(/đăng nhập|Đăng nhập/).first()).toBeVisible({ timeout: 15_000 });
    await page.goto(`${WEB}/account/bookings`);
    const api = await page.request.get(`${API}/api/v1/customer/profile`);
    expect(api.status(), `unauthenticated customer/profile=${api.status()}`).toBe(401);
  });

  test('C. MOMO full browser flow → /booking/manage/{code} auto-redirect', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const { bookingCode, recipientEmail } = await buildCustomerBooking(page, /Thanh toán qua MoMo/);
    const counters = await readSimulatorCounters();
    expect(counters.defaultBackRedirectBase).toBe('http://localhost:3000/booking/manage');
    // Simulator must observe at least one IPN, then redirect to the persistent route.
    await expect(page).toHaveURL(new RegExp(`/booking/manage/${bookingCode}$`), {
      timeout: 30_000,
    });
    expect(page.url()).not.toContain('MOMO-');

    // The persistent route renders the confirmed-success surface on
    // first arrival after the simulator redirect; this is the customer
    // persistence proof.
    await expect(page.getByTestId('confirmed-success-surface')).toBeVisible({ timeout: 30_000 });

    // Persistence is also proven by the single Mailpit confirmation
    // email; no extra reload is required because the simulator's
    // checkout page may abort a follow-up navigation.

    // Exactly one confirmation email landed in Mailpit for that booking code.
    const confirmationCount = await countMatchingMailpit(
      recipientEmail,
      new RegExp(`Booking confirmed: ${bookingCode}`),
      8_000,
    );
    expect(confirmationCount, `confirmations for ${bookingCode}`).toBe(1);

    await expectNoForbiddenErrors(consoleErrors);
  });

  test('D. VNPAY full browser flow → /booking/manage/{code} auto-redirect', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const { bookingCode, recipientEmail } = await buildCustomerBooking(
      page,
      /Thanh toán qua VNPay/,
    );
    await expect(page).toHaveURL(new RegExp(`/booking/manage/${bookingCode}$`), {
      timeout: 30_000,
    });
    expect(page.url()).not.toContain('vnp_');
    await expect(page.getByTestId('confirmed-success-surface')).toBeVisible({ timeout: 30_000 });
    // Persistence is also proven by the single Mailpit confirmation
    // email; no extra reload is required because the simulator's
    // checkout page may abort a follow-up navigation.
    const confirmationCount = await countMatchingMailpit(
      recipientEmail,
      new RegExp(`Booking confirmed: ${bookingCode}`),
      8_000,
    );
    expect(confirmationCount, `VNPAY confirmations for ${bookingCode}`).toBe(1);
    await expectNoForbiddenErrors(consoleErrors);
  });

  test('E. forged MoMo return cannot confirm a booking', async ({ request }) => {
    const forgedUrl = `${API}/api/v1/payments/providers/momo/return?orderId=forged&resultCode=0&signature=deadbeef`;
    const response = await request.get(forgedUrl);
    expect(response.status()).not.toBe(200);
  });

  test('F. ADMIN login, /api/v1/admin/me 200, protected pages render', async ({
    context,
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await adminLogin(page);

    // Pull the cookie out of the WEB origin's cookie jar and assert
    // the same session reaches the API through both surfaces: the
    // WEB-origin proxy route (`/api/admin/me`) and the API directly
    // (`/api/v1/admin/me`).
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'better-auth.session_token');
    expect(session, 'session cookie set on web origin').toBeTruthy();

    const me = await page.request.get(`${WEB}/api/admin/me`);
    expect(
      me.status(),
      `web /api/admin/me status=${me.status()} body=${(await me.text()).slice(0, 200)}`,
    ).toBe(200);

    const apiMe = await page.request.get(`${API}/api/v1/admin/me`, {
      headers: { cookie: `better-auth.session_token=${session?.value}` },
    });
    expect(apiMe.status(), `API /api/v1/admin/me status=${apiMe.status()}`).toBe(200);

    for (const path of [
      '/admin',
      '/admin/rooms',
      '/admin/room-types',
      '/admin/payment-providers',
      '/admin/bookings',
    ]) {
      const response = await page.goto(WEB + path);
      await expectStatus(response, 200);
      await expect(page.locator('.admin-layout, [data-admin-layout]').first()).toBeVisible({
        timeout: 30_000,
      });
    }
    await expectNoForbiddenErrors(consoleErrors);
  });

  test('G. ADMIN refresh persists session, logout revokes', async ({ context, page }) => {
    await adminLogin(page);
    await page.goto(`${WEB}/admin`);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${WEB}/admin$`));
    const logoutBtn = page
      .locator('button:has-text("Đăng xuất"), button:has-text("Sign out")')
      .first();
    await expect(logoutBtn).toBeVisible({ timeout: 15_000 });
    await Promise.all([page.waitForURL(/\/admin\/login/, { timeout: 15_000 }), logoutBtn.click()]);
    const me = await page.request.get(`${API}/api/v1/admin/me`);
    expect(me.status(), `post-logout /api/v1/admin/me=${me.status()}`).toBe(401);
    await context.clearCookies();
  });
});
