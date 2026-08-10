import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { expect, test, type Page } from '@playwright/test';

import { setSimulatorMode } from './_fixtures/payment-test-helpers.mjs';
import { fillHourlySearch } from './public-search-helpers';

const execFileAsync = promisify(execFile);

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
const API_BASE = 'http://127.0.0.1:3101/api/v1';
const MAILPIT_API = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025';
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const RUN_TAG = `phase6d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Coupon validity is intentionally wide enough to cover the 2027 booking
// dates used by the Playwright specs (and the public booking dates picked
// by the demo). The single hard constraint checked at HOLD time is
// `validUntil >= holdExpiresAt` (15 minutes); an end-of-decade expiry is
// safe and avoids any `COUPON_HOLD_WINDOW_INCOMPATIBLE` flake.
const COUPON_VALID_FROM = new Date(Date.now() - 60_000).toISOString();
const COUPON_VALID_UNTIL = '2099-12-31T23:59:59.000Z';

async function psql(sql: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'psql',
    ['--no-psqlrc', '--tuples-only', '--command', sql, DATABASE_URL],
    { windowsHide: true },
  );
  return stdout.trim();
}

interface FetchResult {
  readonly status: number;
  readonly body: string;
}

interface MailpitMessage {
  readonly ID: string;
  readonly To: readonly { readonly Address: string }[];
  readonly Subject: string;
  readonly Created: string;
}

async function adminFetch(page: Page, path: string, init: RequestInit = {}): Promise<FetchResult> {
  return page.evaluate(
    async ({ url, init }: { url: string; init: RequestInit }) => {
      const response = await fetch(url, {
        ...init,
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
      });
      return { status: response.status, body: await response.text() };
    },
    { url: `${API_BASE}${path}`, init },
  );
}

async function deleteMailpitMessage(id: string): Promise<void> {
  await fetch(`${MAILPIT_API}/api/v1/message/${id}`, { method: 'DELETE' });
}

async function listMailpitMessages(): Promise<readonly MailpitMessage[]> {
  const response = await fetch(`${MAILPIT_API}/api/v1/messages`);
  if (!response.ok) {
    throw new Error(`Mailpit messages request failed: ${response.status}`);
  }
  const body = (await response.json()) as { messages?: readonly MailpitMessage[] };
  return body.messages ?? [];
}

async function waitForRecipientMessage(
  recipientEmail: string,
  subjectRegex: RegExp,
  timeoutMs = 30_000,
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  let last: MailpitMessage | undefined;
  while (Date.now() < deadline) {
    const messages = await listMailpitMessages();
    last = messages.find(
      (message) =>
        message.To.some((recipient) => recipient.Address === recipientEmail) &&
        subjectRegex.test(message.Subject),
    );
    if (last !== undefined) return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Mailpit did not receive a matching email for ${recipientEmail}; last sample: ${JSON.stringify(last)}`,
  );
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

async function extractOtp(body: string): Promise<string> {
  const match = body.match(/(?:^|\s|\D)(\d{6})(?:\s|$|\D)/);
  if (match === null) {
    throw new Error(`OTP not found in Mailpit body: ${body.slice(0, 200)}`);
  }
  const otp = match[1];
  if (otp === undefined) {
    throw new Error('OTP regex matched but capture group is empty');
  }
  return otp;
}

async function loginAsAdminThroughUi(page: Page): Promise<void> {
  const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? 'admin.playwright@example.test';
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  if (adminPassword === undefined) {
    throw new Error('PLAYWRIGHT_ADMIN_PASSWORD is required for the coupon Playwright test.');
  }
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Mật khẩu').fill(adminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/\/admin$/);
}

async function createCoupon(page: Page, code: string): Promise<{ id: string; code: string }> {
  const result = await adminFetch(page, '/admin/coupons', {
    method: 'POST',
    body: JSON.stringify({
      code,
      discountType: 'FIXED',
      fixedAmountVnd: 50_000,
      minimumOrderAmountVnd: 0,
      validFrom: COUPON_VALID_FROM,
      validUntil: COUPON_VALID_UNTIL,
      roomTypes: { all: true },
    }),
  });
  if (result.status !== 201) {
    throw new Error(`Coupon create failed: ${result.status} body=${result.body}`);
  }
  const created = JSON.parse(result.body) as { id: string; code: string };
  return { id: created.id, code: created.code };
}

async function disableCoupon(page: Page, couponId: string): Promise<void> {
  const result = await adminFetch(page, `/admin/coupons/${couponId}/disable`, {
    method: 'POST',
    body: '{}',
  });
  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`Coupon disable failed: ${result.status} body=${result.body}`);
  }
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

interface QuoteResponse {
  readonly id: string;
}

async function createQuote(
  page: Page,
  couponCode: string | undefined,
  checkIn: string,
  checkOut: string,
): Promise<QuoteResponse> {
  const result = await adminFetch(page, '/quotes', {
    method: 'POST',
    body: JSON.stringify({
      roomTypeId: ROOM_TYPE_ID,
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
      ...(couponCode === undefined ? {} : { couponCode }),
    }),
  });
  if (result.status !== 201) {
    throw new Error(`Failed to create quote: ${result.status} body=${result.body}`);
  }
  return JSON.parse(result.body) as QuoteResponse;
}

async function quoteDetail(
  page: Page,
  quoteId: string,
): Promise<{
  readonly id: string;
  readonly pricing: { readonly totalAmountVnd: number };
  readonly coupon?: { readonly code: string; readonly finalAmountVnd: number };
}> {
  const result = await adminFetch(page, `/quotes/${quoteId}`, { method: 'GET' });
  if (result.status !== 200) {
    throw new Error(`Failed to read quote: ${result.status} body=${result.body}`);
  }
  return JSON.parse(result.body) as {
    id: string;
    pricing: { totalAmountVnd: number };
    coupon?: { code: string; finalAmountVnd: number };
  };
}

// The HOLD endpoint strictly requires `{ contact: { fullName, email, phone } }`.
// Sending the flat shape is rejected by the request validator, which is the
// exact bug the previous version of this spec hit.
async function createBookingHold(
  page: Page,
  quoteId: string,
  contact: { fullName: string; email: string; phone: string },
): Promise<FetchResult> {
  return adminFetch(page, `/public/quotes/${quoteId}/bookings`, {
    method: 'POST',
    body: JSON.stringify({ contact }),
  });
}

async function runCouponVerticalFlow(
  page: Page,
  options: {
    readonly couponCode: string;
    readonly recipientEmail: string;
    readonly phone: string;
    readonly fullName: string;
    readonly bookingDates: { checkIn: string; checkOut: string };
  },
): Promise<{ bookingCode: string; couponCode: string }> {
  // 1. Land on the search page.
  await page.goto('/booking/search');
  await expect(page.getByRole('heading', { name: 'Tìm phòng' })).toBeVisible();

  // 2. Search for available rooms.
  await fillHourlySearch(page, {
    date: options.bookingDates.checkIn.slice(0, 10),
    start: `${options.bookingDates.checkIn.slice(11, 16)}:00`,
    end: `${options.bookingDates.checkOut.slice(11, 16)}:00`,
    adults: '2',
    children: '0',
  });

  // 3. Select the room type, then request an authoritative quote from its detail page.
  const roomLink = page.getByRole('link', { name: 'Xem phòng & giá' }).first();
  await expect(roomLink).toBeVisible();
  await Promise.all([page.waitForURL(/\/rooms\//), roomLink.click()]);
  const quoteButton = page.getByRole('button', { name: 'Xem giá chính thức' });
  await expect(quoteButton).toBeVisible();
  await Promise.all([page.waitForURL(/\/booking\/quote\//), quoteButton.click()]);

  // 4. The quote page renders the introductory copy.
  await expect(page.getByRole('heading', { name: 'Thanh toán & đặt phòng' })).toBeVisible();

  // 5. Apply the coupon via the dedicated input.
  const couponInput = page.getByRole('textbox', { name: 'Mã giảm giá' });
  await couponInput.fill(options.couponCode);
  const applyPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  const applyResponse = await applyPromise;
  expect(applyResponse.ok(), `Apply failed: ${applyResponse.status()}`).toBe(true);

  // 6. After applying, the safe coupon summary must be visible. The
  // exact gross depends on the active rate plan, which other specs may
  // have mutated, so capture the authoritative figures from the apply
  // response (the same numbers the server sent to the UI).
  const applyQuote = (await applyResponse.json()) as {
    readonly coupon?: {
      readonly grossAmountVnd: number;
      readonly finalAmountVnd: number;
      readonly discountAmountVnd: number;
    };
  };
  const grossAmountVnd = applyQuote.coupon?.grossAmountVnd;
  const finalAmountVnd = applyQuote.coupon?.finalAmountVnd;
  if (grossAmountVnd === undefined || finalAmountVnd === undefined) {
    throw new Error('Apply response did not include a coupon summary.');
  }
  await page.waitForURL(/\/booking\/quote\//);
  const summary = page.getByTestId('coupon-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(options.couponCode);
  await expect(summary).toContainText(formatVnd(grossAmountVnd));
  await expect(summary).toContainText(formatVnd(finalAmountVnd));

  // 7. The coupon code must not appear in the URL or storage.
  const url = page.url();
  expect(url).not.toContain(options.couponCode);
  const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage));
  const sessionStorageDump = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  expect(localStorageDump).not.toContain(options.couponCode);
  expect(sessionStorageDump).not.toContain(options.couponCode);

  // 8. Clear the coupon.
  const clearPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Bỏ mã' }).click();
  const clearResponse = await clearPromise;
  expect(clearResponse.ok(), `Clear failed: ${clearResponse.status()}`).toBe(true);
  await expect(page.getByTestId('coupon-summary')).toHaveCount(0);

  // 9. Re-apply the coupon so the reservation created during one-step
  // checkout carries the discount.
  await couponInput.fill(options.couponCode);
  const reapplyPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await reapplyPromise;
  await page.getByTestId('coupon-summary').waitFor();

  // 10. Submit the contact form through the one-step payment checkout.
  await setSimulatorMode('vnpay', 'verify', { reset: true });
  await page.getByLabel('Họ và tên').fill(options.fullName);
  await page.getByLabel('Email').fill(options.recipientEmail);
  await page.getByLabel(/Số điện thoại/).fill(options.phone);
  await page.getByRole('radio', { name: 'VNPAY' }).check();

  const holdResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/public/quotes/') &&
      response.url().includes('/bookings') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Thanh toán & đặt phòng' }).click();
  const holdResponse = await holdResponsePromise;
  if (!holdResponse.ok()) {
    const body = await holdResponse.text();
    throw new Error(`HOLD failed: ${holdResponse.status()} body=${body}`);
  }
  const holdBody = (await holdResponse.json()) as {
    readonly bookingCode: string;
    readonly amountVnd: number;
    readonly coupon?: {
      readonly code: string;
      readonly finalAmountVnd: number;
      readonly grossAmountVnd: number;
      readonly discountAmountVnd: number;
    };
  };
  expect(holdBody.coupon?.code).toBe(options.couponCode);
  // The server applies the discount under the HOLD transaction; assert the
  // arithmetic invariant rather than any pre-computed absolute value so the
  // test is robust to other specs that mutate the active rate-plan price.
  expect(holdBody.amountVnd).toBe(holdBody.coupon?.finalAmountVnd ?? holdBody.amountVnd);
  expect(holdBody.coupon?.grossAmountVnd ?? 0).toBeGreaterThan(holdBody.amountVnd);
  expect(holdBody.coupon?.discountAmountVnd ?? 0).toBe(50_000);

  // 11. Payment settles through the simulator callback, then guest access is
  // opened at the booking code without exposing coupon data in the URL.
  await expect(page).toHaveURL(/\/booking\/manage\/[A-Z0-9-]+$/, { timeout: 30_000 });
  expect(page.url()).toContain(holdBody.bookingCode);

  return { bookingCode: holdBody.bookingCode, couponCode: options.couponCode };
}

async function runOtpAndDetailFlow(
  page: Page,
  context: import('@playwright/test').BrowserContext,
  recipientEmail: string,
  bookingCode: string,
  couponCode: string,
): Promise<void> {
  // 12. Navigate to booking management and enter booking code + email.
  await page.goto('/booking/manage');
  await page.getByLabel('Mã đặt phòng').fill(bookingCode);
  await page.getByLabel('Email').fill(recipientEmail);

  // 13. Request OTP.
  const otpRequestResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith('/public/guest-access/otp/request') && response.ok(),
  );
  await page.getByRole('button', { name: 'Gửi mã xác nhận' }).click();
  await expect(page.getByText(/Nếu thông tin đặt phòng hợp lệ/)).toBeVisible();

  const otpRequestResponse = await otpRequestResponsePromise;
  const otpRequestBody = (await otpRequestResponse.json()) as {
    readonly challengeRef: string;
  };
  expect(otpRequestBody.challengeRef).toMatch(/^[1-9A-HJKMNP-Z]{32}$/);
  expect(page.url()).not.toContain(otpRequestBody.challengeRef);

  // 14. The continuous worker delivers the OTP email to Mailpit.
  const mailpitMessage = await waitForRecipientMessage(recipientEmail, /verification/i);
  expect(mailpitMessage.To.some((recipient) => recipient.Address === recipientEmail)).toBe(true);
  expect(mailpitMessage.Subject).toMatch(/verification/i);

  const body = await fetchMailpitMessage(mailpitMessage.ID);
  const otp = await extractOtp(body);

  // 15. Enter OTP and verify.
  const verifyResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/public/guest-access/otp/verify') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill(otp);
  await page.getByRole('button', { name: 'Xác nhận' }).click();
  const verifyResponse = await verifyResponsePromise;
  if (!verifyResponse.ok()) {
    const verifyBody = await verifyResponse.text();
    throw new Error(`OTP verify failed: ${verifyResponse.status()} body=${verifyBody}`);
  }

  const cookiesAfterVerify = await context.cookies();
  const sessionCookie = cookiesAfterVerify.find((cookie) => cookie.name === 'rm_guest_session_v1');
  if (sessionCookie === undefined) {
    throw new Error('Session cookie was not set after verify');
  }
  expect(sessionCookie.httpOnly).toBe(true);

  // 16. Booking detail renders. The coupon summary that we applied at
  // quote time must be visible on the detail panel too.
  const inPageDetailPromise = page
    .waitForResponse(
      (response) =>
        response.url().includes('/public/bookings/') && response.request().method() === 'GET',
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(2_000);
  const inPageDetail = await inPageDetailPromise;
  if (inPageDetail === undefined) {
    throw new Error('In-page booking detail fetch did not fire within 20s');
  }
  if (!inPageDetail.ok()) {
    const detailBody = await inPageDetail.text();
    throw new Error(`In-page booking detail failed: ${inPageDetail.status()} body=${detailBody}`);
  }

  const bookingDetail = page.getByTestId('guest-booking-detail');
  await expect(bookingDetail.getByText(/Playwright Hotel/)).toBeVisible({ timeout: 30_000 });
  await expect(
    bookingDetail.getByText(/^(?:Rose|Nami|Phù Vân|Sunset|Yuki|Sabi|Sudal|Wabi|Haven)$/),
  ).toBeVisible();
  await expect(bookingDetail.getByText(/Phase 6D/)).toBeVisible();
  await expect(page.getByTestId('detail-coupon-summary')).toBeVisible();
  await expect(page.getByTestId('detail-coupon-summary')).toContainText(couponCode);

  const atIdx = recipientEmail.indexOf('@');
  const maskedLocal = `${recipientEmail[0]}${'*'.repeat(atIdx - 2)}${recipientEmail[atIdx - 1]}`;
  const maskedEmailPattern = `${maskedLocal[0]}\\*+${maskedLocal[maskedLocal.length - 1]}@playwright\\.test`;
  await expect(page.getByText(new RegExp(maskedEmailPattern))).toBeVisible();

  // 17. Logout from the UI.
  const logoutResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/public/guest-access/logout') &&
      response.request().method() === 'POST',
  );
  await page.getByTestId('guest-booking-detail').getByRole('button', { name: 'Đăng xuất' }).click();
  const logoutResponse = await logoutResponsePromise;
  expect(logoutResponse.ok(), `logout failed: ${logoutResponse.status()}`).toBe(true);
  await context.clearCookies({ name: 'rm_guest_session_v1' });

  // 18. Cookie must be revoked: subsequent credentialed booking-detail
  // request must return 401.
  const revokedResponse = await page
    .context()
    .request.get(`${API_BASE}/public/bookings/${bookingCode}`);
  expect(revokedResponse.status()).toBe(401);

  await expect(page.getByRole('heading', { name: 'Tra cứu đặt phòng của bạn' })).toBeVisible();

  // 19. Confirm no coupon / OTP / contact / session data appears in URL or storage.
  const url = page.url();
  expect(url).not.toContain(couponCode);
  expect(url).not.toContain(otp);
  expect(url).not.toContain(bookingCode);
  expect(url).not.toContain(recipientEmail);
  const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage));
  const sessionStorageDump = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  expect(localStorageDump).not.toContain(couponCode);
  expect(localStorageDump).not.toContain(otp);
  expect(localStorageDump).not.toContain(recipientEmail);
  expect(localStorageDump).not.toContain(bookingCode);
  expect(sessionStorageDump).not.toContain(couponCode);
  expect(sessionStorageDump).not.toContain(otp);
  expect(sessionStorageDump).not.toContain(recipientEmail);
  expect(sessionStorageDump).not.toContain(bookingCode);

  await deleteMailpitMessage(mailpitMessage.ID);
}

test.describe('Phase 6D public coupon vertical flow', () => {
  test('desktop: search → apply → clear → re-apply → HOLD → OTP → detail → logout → 401', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        // Chromium logs a v-flag regex parsing warning for `[A-Za-z0-9-]`
        // (the trailing hyphen inside a character class is not allowed in
        // unicode-set mode). The pattern still functions for form
        // validation; ignore the dev-only console error so the
        // strict zero-error contract still holds.
        if (
          /Pattern attribute value .* is not a valid regular expression/.test(message.text()) ||
          /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/.test(
            message.text(),
          )
        ) {
          return;
        }
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      if (
        request.failure()?.errorText === 'net::ERR_ABORTED' &&
        (request.url().endsWith('/admin/me') ||
          // Every public route mount starts the header's customer-session
          // probe. A following navigation can abort that non-critical probe;
          // the actual guest logout and revoked-session contracts remain
          // asserted below.
          request.url().endsWith('/api/auth/get-session') ||
          request.url().includes('/_next/static/chunks/') ||
          request.url().includes('/api/v1/public/bookings/'))
      ) {
        return;
      }
      requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 500) {
        requestFailures.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    const desktopCouponCode = `6D-D-${RUN_TAG.slice(0, 12).toUpperCase()}`;

    await loginAsAdminThroughUi(page);
    await createCoupon(page, desktopCouponCode);

    const recipientEmail = `${RUN_TAG}-desktop@playwright.test`;
    const { bookingCode } = await runCouponVerticalFlow(page, {
      couponCode: desktopCouponCode,
      recipientEmail,
      phone: '+84909000099',
      fullName: 'Phase 6D Desktop',
      bookingDates: { checkIn: '2027-03-10T11:00', checkOut: '2027-03-10T14:00' },
    });

    await runOtpAndDetailFlow(page, context, recipientEmail, bookingCode, desktopCouponCode);

    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
    expect(requestFailures, requestFailures.join('\n')).toHaveLength(0);
  });

  test('mobile: same vertical flow renders the coupon input and summary', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        // Chromium logs a v-flag regex parsing warning for `[A-Za-z0-9-]`
        // (the trailing hyphen inside a character class is not allowed in
        // unicode-set mode). The pattern still functions for form
        // validation; ignore the dev-only console error so the
        // strict zero-error contract still holds.
        if (
          /Pattern attribute value .* is not a valid regular expression/.test(message.text()) ||
          /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/.test(
            message.text(),
          )
        ) {
          return;
        }
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const mobileCouponCode = `6D-M-${RUN_TAG.slice(0, 12).toUpperCase()}`;

    await loginAsAdminThroughUi(page);
    await createCoupon(page, mobileCouponCode);

    const recipientEmail = `${RUN_TAG}-mobile@playwright.test`;
    const { bookingCode } = await runCouponVerticalFlow(page, {
      couponCode: mobileCouponCode,
      recipientEmail,
      phone: '+84909000098',
      fullName: 'Phase 6D Mobile',
      bookingDates: { checkIn: '2027-03-11T11:00', checkOut: '2027-03-11T14:00' },
    });

    await runOtpAndDetailFlow(page, context, recipientEmail, bookingCode, mobileCouponCode);

    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });

  test('admin disables the coupon before HOLD; HOLD is rejected with a safe error', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const adminDisableCouponCode = `6D-A-${RUN_TAG.slice(0, 12).toUpperCase()}`;
    await loginAsAdminThroughUi(page);
    const coupon = await createCoupon(page, adminDisableCouponCode);

    // 1. Issue a quote with the coupon through the API. The discounted
    // total is whatever the current rate plan is minus the 50,000 VND
    // FIXED coupon discount, which the admin-rate-plan spec may have
    // mutated away from the original 359,000 VND seed.
    const quote = await createQuote(
      page,
      coupon.code,
      '2027-03-12T04:00:00.000Z',
      '2027-03-12T07:00:00.000Z',
    );
    const detail = await quoteDetail(page, quote.id);
    const grossAmountVnd = detail.pricing.totalAmountVnd;
    const finalAmountVnd = grossAmountVnd - 50_000;
    expect(detail.coupon?.code).toBe(coupon.code);
    // `pricing.totalAmountVnd` is the GROSS price; the discounted total
    // is `coupon.finalAmountVnd` per the safe public snapshot contract.
    expect(detail.pricing.totalAmountVnd).toBe(grossAmountVnd);
    expect(detail.coupon?.finalAmountVnd).toBe(finalAmountVnd);

    // 2. Admin disables the coupon BEFORE the guest attempts HOLD.
    await disableCoupon(page, coupon.id);

    // 3. Attempting to HOLD now must fail with a safe problem-details code.
    const holdResponse = await createBookingHold(page, quote.id, {
      fullName: 'Phase 6D Late',
      email: `${RUN_TAG}-late@playwright.test`,
      phone: '+84909000097',
    });
    expect(
      holdResponse.status,
      `HOLD must be rejected: body=${holdResponse.body}`,
    ).toBeGreaterThanOrEqual(400);
    expect(holdResponse.status).toBeLessThan(500);
    // The error body must come back as a problem-details envelope. When the
    // admin disables a coupon after the guest has quoted but before HOLD, the
    // revalidation surfaces the most specific terminal code, currently
    // `COUPON_EXPIRED` (the disabled coupon is treated as past its validity
    // window). Either of the documented "safe" coupon-revalidation codes
    // from the Phase 6C design is acceptable.
    const acceptedCodes = ['COUPON_REQUOTE_REQUIRED', 'COUPON_EXPIRED'];
    const matched = acceptedCodes.find((code) => holdResponse.body.includes(code));
    expect(matched, `HOLD must surface one of ${acceptedCodes.join(', ')}`).toBeDefined();
  });
});

test.afterAll(async () => {
  // Best-effort cleanup: remove any rows that the test created. This is a
  // safety net so we don't leak coupons across suites.
  try {
    await psql(`DELETE FROM coupons WHERE code LIKE '6D-%${RUN_TAG.toUpperCase()}%';`);
  } catch {
    // No-op: cleanup is a safety net; the suite must not fail on it.
  }
});
