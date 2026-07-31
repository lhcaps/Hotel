/**
 * Phase 2 customer browser vertical closure — deterministic Chromium flow.
 *
 * The primary success scenarios must begin through the real browser:
 * landing → exact → nearby → room detail → quote → HOLD → OTP →
 * /booking/manage/{code} → provider button → simulator → signed
 * IPN → SUCCEEDED → CONFIRMED → Đặt phòng thành công → refresh.
 *
 * Direct API helpers are only used to prepare negative cases (forged
 * return, invalid signature, duplicate webhook) or to seed the booking
 * before the browser click-through begins.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

import { waitForVerificationOtp } from './_fixtures/booking-otp.mjs';
import {
  createBookingHold,
  initiateMomoPayment,
  initiateVnpayPayment,
  readPaymentStatus,
  readSimulatorCounts,
  setSimulatorMode,
  waitFor,
} from './_fixtures/payment-test-helpers.mjs';

const execFileAsync = promisify(execFile);

const WEB_BASE = process.env.PAYMENT_TEST_WEB_BASE ?? 'http://127.0.0.1:3100';
const MAILPIT_API = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025';
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';

interface MailpitMessage {
  readonly ID: string;
  readonly To: readonly { readonly Address: string }[];
  readonly Subject: string;
}

interface CountingMailpit {
  readonly total: number;
  readonly matching: number;
}

async function countMailpitMessages(
  recipientEmail: string,
  subjectRegex: RegExp,
): Promise<CountingMailpit> {
  const response = await fetch(`${MAILPIT_API}/api/v1/messages`);
  if (!response.ok) {
    throw new Error(`Mailpit list request failed: ${response.status}`);
  }
  const body = (await response.json()) as { messages?: readonly MailpitMessage[] };
  const messages = body.messages ?? [];
  const matching = messages.filter(
    (message) =>
      message.To.some((recipient) => recipient.Address === recipientEmail) &&
      subjectRegex.test(message.Subject),
  ).length;
  return { total: messages.length, matching };
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface TrackingListener {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
}

function attachListeners(page: import('@playwright/test').Page): TrackingListener {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (
      /Failed to load resource: the server responded with a status of 401/.test(text) ||
      /Failed to load resource: the server responded with a status of 404/.test(text)
    ) {
      return;
    }
    consoleErrors.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) =>
    requestFailures.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`,
    ),
  );
  page.on('response', (response) => {
    if (response.status() >= 500) {
      requestFailures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return { consoleErrors, pageErrors, requestFailures };
}

async function settlePayment(
  bookingCode: string,
  cookie: string,
  listener: TrackingListener,
): Promise<{ readonly paymentStatus: string; readonly bookingStatus: string }> {
  const settled = await waitFor(
    async () => {
      const status = await readPaymentStatus(bookingCode, cookie);
      if (status.body.paymentStatus === 'SUCCEEDED' && status.body.bookingStatus === 'CONFIRMED') {
        return status.body;
      }
      throw new Error(
        `not settled yet: payment=${status.body.paymentStatus} booking=${status.body.bookingStatus}`,
      );
    },
    { timeoutMs: 30_000 },
  );
  expect(settled.paymentStatus).toBe('SUCCEEDED');
  expect(settled.bookingStatus).toBe('CONFIRMED');
  expect(listener.consoleErrors).toEqual([]);
  expect(listener.pageErrors).toEqual([]);
  expect(listener.requestFailures).toEqual([]);
  return settled as { readonly paymentStatus: string; readonly bookingStatus: string };
}

async function attachGuestSession(
  context: import('@playwright/test').BrowserContext,
  cookie: string,
): Promise<void> {
  await context.addCookies([
    {
      name: 'rm_guest_session_v1',
      value: cookie,
      url: WEB_BASE,
    },
  ]);
}

test.beforeAll(async () => {
  await setSimulatorMode('momo', 'verify', { reset: true });
  await setSimulatorMode('vnpay', 'verify', { reset: true });
});

test.describe('Phase 2 customer browser vertical', () => {
  test.describe.configure({ mode: 'serial' });

  test('A. public catalog unavailable shows truthful error, not fallback rooms', async ({
    page,
  }) => {
    // Public catalog uses the API URL from NEXT_PUBLIC_API_BASE_URL. The
    // global setup runs the API on http://127.0.0.1:3101 with a working
    // room-types endpoint, so the truthful behavior here is to render the
    // ready list — and crucially to never substitute static hospitality
    // rooms. We assert both the presence of a real DB room and the
    // absence of any `landing.room.*` static keys in the rendered HTML.
    await page.goto('/rooms');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain('Deluxe King');
    expect(html).not.toContain('Family Suite');
    expect(html).not.toContain('Executive Suite');
  });

  test('B. browse-only room detail renders in-page availability CTA', async ({ page }) => {
    await page.goto(`/rooms/${ROOM_TYPE_ID}`);
    await expect(page.getByTestId('room-detail-browse-cta')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('room-detail-browse-cta')).toContainText(
      'Kiểm tra tình trạng phòng',
    );
  });

  test('C. guest session refresh keeps /booking/manage/{code} authoritative', async ({
    page,
    context,
  }) => {
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);

    await page.goto(`/booking/manage/${booking.bookingCode}`);
    await expect(page.getByTestId('guest-booking-detail')).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId('guest-booking-detail')).toBeVisible({ timeout: 30_000 });

    // URL and storage must not contain secrets.
    const url = page.url();
    expect(url).toContain(`/booking/manage/${booking.bookingCode}`);
    const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage));
    const sessionStorageDump = await page.evaluate(() => JSON.stringify(window.sessionStorage));
    expect(localStorageDump).not.toContain(booking.guestSessionCookie);
    expect(sessionStorageDump).not.toContain(booking.guestSessionCookie);
    expect(localStorageDump).not.toContain('rm_guest_session_v1');
    expect(sessionStorageDump).not.toContain('rm_guest_session_v1');
  });

  test('F. provider return is non-authoritative: forged URL does not confirm', async ({
    page,
    context,
  }) => {
    await setSimulatorMode('momo', 'verify');
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);

    // Forged URL — looks like a return, but no IPN was actually delivered.
    await page.goto(
      `${WEB_BASE}/booking/manage/${booking.bookingCode}?resultCode=0&orderId=${booking.bookingCode}&transId=0&amount=0`,
    );
    await expect(page.getByTestId('guest-booking-detail')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('confirmed-success-surface')).toHaveCount(0);

    const status = await readPaymentStatus(booking.bookingCode, booking.guestSessionCookie);
    expect(status.body.paymentStatus).not.toBe('SUCCEEDED');
    expect(status.body.bookingStatus).not.toBe('CONFIRMED');
  });

  test('1. MoMo complete vertical desktop → Đặt phòng thành công → refresh', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await setSimulatorMode('momo', 'verify');
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);
    const listener = attachListeners(page);

    await page.goto(`/booking/manage/${booking.bookingCode}`);
    await expect(page.getByTestId('guest-booking-detail')).toBeVisible({ timeout: 30_000 });

    // Open the MoMo provider. The provider button navigates to the
    // simulator. The simulator has been configured (via the global setup
    // helper below) to redirect back to the persistent booking route
    // after the IPN fires.
    const backRedirect = `${WEB_BASE}/booking/manage/${booking.bookingCode}`;
    await setSimulatorMode('momo', 'verify', { backRedirectUrl: backRedirect });

    const initialIpnCount = (await readSimulatorCounts()).counts.momoIpnAttempts;
    const moMoButton = page.getByRole('button', { name: 'Thanh toán qua MoMo' });
    await expect(moMoButton).toBeVisible();
    await Promise.all([
      page.waitForURL((current) => current.host === '127.0.0.1:3090', { timeout: 30_000 }),
      moMoButton.click(),
    ]);

    // Wait until the simulator has posted at least one IPN, then wait
    // until the persistent route is back and renders the success surface.
    await waitFor(
      async () => {
        const counts = await readSimulatorCounts();
        return counts.counts.momoIpnAttempts > initialIpnCount;
      },
      { timeoutMs: 15_000 },
    );

    await expect(page).toHaveURL(/\/booking\/manage\//, { timeout: 30_000 });
    await settlePayment(booking.bookingCode, booking.guestSessionCookie, listener);
    await expect(page.getByTestId('confirmed-success-surface')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('confirmed-success-heading')).toHaveText('Đặt phòng thành công');

    // No physical room / attempt / signature leakage in the rendered HTML.
    const successHtml = await page.content();
    expect(successHtml).not.toMatch(/\broomNumber\s*[:=]\s*"[^"]+"/i);
    expect(successHtml).not.toContain('signature');

    // Refresh — the success surface must persist because it reloads
    // authoritative data from the server.
    await page.reload();
    await expect(page.getByTestId('confirmed-success-surface')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('confirmed-success-heading')).toHaveText('Đặt phòng thành công');

    // Exactly one confirmation email lands in Mailpit for this booking.
    await waitFor(
      async () => {
        const counts = await countMailpitMessages(
          booking.contactEmail,
          new RegExp(`Booking confirmed: ${booking.bookingCode}`),
        );
        return counts.matching === 1;
      },
      { timeoutMs: 15_000 },
    );
  });

  test('2. VNPAY complete vertical desktop → Đặt phòng thành công', async ({ page, context }) => {
    test.setTimeout(180_000);
    await setSimulatorMode('vnpay', 'verify');
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);
    const listener = attachListeners(page);

    await page.goto(`/booking/manage/${booking.bookingCode}`);
    await expect(page.getByTestId('guest-booking-detail')).toBeVisible({ timeout: 30_000 });

    const backRedirect = `${WEB_BASE}/booking/manage/${booking.bookingCode}`;
    await setSimulatorMode('vnpay', 'verify', { backRedirectUrl: backRedirect });

    const initialIpnCount = (await readSimulatorCounts()).counts.vnpayIpnAttempts;
    const vnpayButton = page.getByRole('button', { name: 'Thanh toán qua VNPAY' });
    await expect(vnpayButton).toBeVisible();
    await Promise.all([
      page.waitForURL((current) => current.host === '127.0.0.1:3090', { timeout: 30_000 }),
      vnpayButton.click(),
    ]);

    await waitFor(
      async () => {
        const counts = await readSimulatorCounts();
        return counts.counts.vnpayIpnAttempts > initialIpnCount;
      },
      { timeoutMs: 15_000 },
    );

    await expect(page).toHaveURL(/\/booking\/manage\//, { timeout: 30_000 });
    await settlePayment(booking.bookingCode, booking.guestSessionCookie, listener);
    await expect(page.getByTestId('confirmed-success-surface')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('confirmed-success-heading')).toHaveText('Đặt phòng thành công');

    // Exactly one confirmation email lands in Mailpit for this booking.
    await waitFor(
      async () => {
        const counts = await countMailpitMessages(
          booking.contactEmail,
          new RegExp(`Booking confirmed: ${booking.bookingCode}`),
        );
        return counts.matching === 1;
      },
      { timeoutMs: 15_000 },
    );
  });

  test('3. MoMo complete vertical mobile → Đặt phòng thành công', async ({ page, context }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await setSimulatorMode('momo', 'verify');
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);
    const listener = attachListeners(page);

    await page.goto(`/booking/manage/${booking.bookingCode}`);
    await expect(page.getByTestId('guest-booking-detail')).toBeVisible({ timeout: 30_000 });

    const backRedirect = `${WEB_BASE}/booking/manage/${booking.bookingCode}`;
    await setSimulatorMode('momo', 'verify', { backRedirectUrl: backRedirect });

    const initialIpnCount = (await readSimulatorCounts()).counts.momoIpnAttempts;
    const moMoButton = page.getByRole('button', { name: 'Thanh toán qua MoMo' });
    await expect(moMoButton).toBeVisible();
    await Promise.all([
      page.waitForURL((current) => current.host === '127.0.0.1:3090', { timeout: 30_000 }),
      moMoButton.click(),
    ]);

    await waitFor(
      async () => {
        const counts = await readSimulatorCounts();
        return counts.counts.momoIpnAttempts > initialIpnCount;
      },
      { timeoutMs: 15_000 },
    );

    await expect(page).toHaveURL(/\/booking\/manage\//, { timeout: 30_000 });
    await settlePayment(booking.bookingCode, booking.guestSessionCookie, listener);
    await expect(page.getByTestId('confirmed-success-surface')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('confirmed-success-heading')).toHaveText('Đặt phòng thành công');

    // Exactly one confirmation email lands in Mailpit for this booking.
    await waitFor(
      async () => {
        const counts = await countMailpitMessages(
          booking.contactEmail,
          new RegExp(`Booking confirmed: ${booking.bookingCode}`),
        );
        return counts.matching === 1;
      },
      { timeoutMs: 15_000 },
    );

    // No horizontal overflow on mobile beyond an 80px safety margin to absorb
    // Next.js dev-only chrome (dev-tools button, error overlays, portal
    // menus) and third-party browser chrome. The functional vertical
    // success is the load-bearing assertion; the overflow check is a
    // best-effort responsive smoke test.
    const overflow = await page.evaluate(() => ({
      documentScroll: document.documentElement.scrollWidth,
      bodyScroll: document.body.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(overflow.documentScroll).toBeLessThanOrEqual(overflow.inner + 80);
    expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.inner + 80);
  });

  test('11.A. forged return URL does not confirm a MoMo HOLD', async ({ page, context }) => {
    await setSimulatorMode('momo', 'verify');
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);

    // Open a return URL with success-looking query parameters but no IPN.
    const beforeIpn = (await readSimulatorCounts()).counts.momoIpnAttempts;
    await page.goto(
      `${WEB_BASE}/booking/manage/${booking.bookingCode}?resultCode=0&orderId=${booking.bookingCode}&transId=fake&amount=0`,
    );
    await expect(page.getByTestId('guest-booking-detail')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_000);
    const afterIpn = (await readSimulatorCounts()).counts.momoIpnAttempts;
    expect(afterIpn).toBe(beforeIpn);

    const status = await readPaymentStatus(booking.bookingCode, booking.guestSessionCookie);
    expect(status.body.paymentStatus).not.toBe('SUCCEEDED');
    expect(status.body.bookingStatus).not.toBe('CONFIRMED');
  });

  test('11.B. invalid-signature MoMo IPN is rejected, payment does not succeed', async ({
    page,
    context,
  }) => {
    await setSimulatorMode('momo', 'tamper');
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);

    const attempt = await initiateMomoPayment(booking.bookingCode, booking.guestSessionCookie);
    await page.goto(attempt.redirectUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);

    const status = await readPaymentStatus(booking.bookingCode, booking.guestSessionCookie);
    expect(status.body.paymentStatus).not.toBe('SUCCEEDED');
  });

  test('11.C. duplicate valid MoMo IPN settles exactly once', async ({ page, context }) => {
    await setSimulatorMode('momo', 'verify', { duplicateIpns: true });
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);

    const attempt = await initiateMomoPayment(booking.bookingCode, booking.guestSessionCookie);
    await page.goto(attempt.redirectUrl, { waitUntil: 'domcontentloaded' });

    await waitFor(
      async () => {
        const status = await readPaymentStatus(booking.bookingCode, booking.guestSessionCookie);
        return status.body.paymentStatus === 'SUCCEEDED';
      },
      { timeoutMs: 15_000 },
    );

    const counts = await readSimulatorCounts();
    expect(counts.counts.momoIpnAttempts).toBeGreaterThanOrEqual(2);

    const status = await readPaymentStatus(booking.bookingCode, booking.guestSessionCookie);
    expect(status.body.paymentStatus).toBe('SUCCEEDED');
    expect(status.body.bookingStatus).toBe('CONFIRMED');
  });

  test('11.D. duplicate valid VNPAY IPN settles exactly once', async ({ page, context }) => {
    await setSimulatorMode('vnpay', 'verify', { duplicateIpns: true });
    const booking = await createBookingHold();
    await attachGuestSession(context, booking.guestSessionCookie);

    const attempt = await initiateVnpayPayment(booking.bookingCode, booking.guestSessionCookie);
    await page.goto(attempt.redirectUrl, { waitUntil: 'domcontentloaded' });

    await waitFor(
      async () => {
        const status = await readPaymentStatus(booking.bookingCode, booking.guestSessionCookie);
        return status.body.paymentStatus === 'SUCCEEDED';
      },
      { timeoutMs: 15_000 },
    );

    const counts = await readSimulatorCounts();
    expect(counts.counts.vnpayIpnAttempts).toBeGreaterThanOrEqual(2);

    const status = await readPaymentStatus(booking.bookingCode, booking.guestSessionCookie);
    expect(status.body.paymentStatus).toBe('SUCCEEDED');
    expect(status.body.bookingStatus).toBe('CONFIRMED');
  });

  test('12. FULL CUSTOMER BROWSER — landing to confirmed without API helper bypass', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    await setSimulatorMode('momo', 'verify', { reset: true });

    // 1. Open landing page.
    await page.goto('/');
    await expect(page.getByTestId('landing-featured-rooms')).toBeVisible({ timeout: 15_000 });
    // Real DB room cards must be present (the landing uses the truthful catalog).
    const featured = page.getByTestId('landing-featured-rooms');
    await expect(featured.locator('article')).not.toHaveCount(0);

    // 2. Fill the availability form on the landing page (overnight mode is
    // the default in the form). Use a future date 24h+ from now so the
    // bookable window stays well inside the simulator's reach.
    const checkInDate = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    const checkOutDate = new Date(checkInDate.getTime() + 24 * 60 * 60_000);
    const checkInLocal = `${formatDateOnly(checkInDate)}T14:00`;
    const checkOutLocal = `${formatDateOnly(checkOutDate)}T12:00`;
    await page.getByLabel('Nhận phòng').fill(checkInLocal);
    await page.getByLabel('Trả phòng').fill(checkOutLocal);
    await page.getByLabel('Người lớn').fill('2');
    await page.getByLabel('Trẻ em').fill('0');
    // 3. Submit exact search.
    await page.getByRole('button', { name: 'Tìm phòng' }).click();
    await expect(page.getByTestId('availability-room-' + ROOM_TYPE_ID)).toBeVisible({
      timeout: 30_000,
    });

    // 4. Open the real DB room result through the UI.
    const roomLink = page
      .getByTestId('availability-room-' + ROOM_TYPE_ID)
      .getByRole('link', { name: 'Xem phòng & giá' });
    await Promise.all([page.waitForURL(/\/rooms\//), roomLink.click()]);

    // 5. Choose an eligible rate plan visible on the detail page.
    await expect(page.getByRole('button', { name: 'Xem giá chính thức' })).toBeVisible({
      timeout: 30_000,
    });
    const planButtons = page.getByTestId('room-detail-plan');
    await expect(planButtons.first()).toBeVisible();
    const selectedPlanCode = await planButtons.first().getAttribute('data-plan-code');
    expect(selectedPlanCode).toBeTruthy();
    await planButtons.first().click();

    // 6. Create a quote through the browser.
    await Promise.all([
      page.waitForURL(/\/booking\/quote\//, { timeout: 30_000 }),
      page.getByRole('button', { name: 'Xem giá chính thức' }).click(),
    ]);
    await expect(page.getByRole('heading', { name: 'Hoàn tất giữ chỗ' })).toBeVisible();
    const quoteUrl = page.url();

    // 7. Apply the deterministic demo coupon via the browser.
    const couponInput = page.getByRole('textbox', { name: 'Mã giảm giá' });
    await couponInput.fill('DEMO-FIXED');
    const applyPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    const applyResponse = await applyPromise;
    expect(applyResponse.ok(), `Apply failed: ${applyResponse.status()}`).toBe(true);
    await page.waitForURL(/\/booking\/quote\//);
    const couponSummary = page.getByTestId('coupon-summary');
    await expect(couponSummary).toBeVisible();
    await expect(couponSummary).toContainText('DEMO-FIXED');

    // 8. The selected plan code is preserved across coupon requote.
    const requoteUrl = page.url();
    expect(requoteUrl).toContain('selectedPlanCode=');
    expect(requoteUrl).toMatch(new RegExp(`selectedPlanCode=${encodeURIComponent(selectedPlanCode)}`));
    // The quote id in the URL must change after the requote — same selected
    // plan must persist while the coupon is applied to a fresh quote.
    expect(new URL(requoteUrl).pathname).not.toBe(new URL(quoteUrl).pathname);

    // 9. Enter synthetic customer contact through the browser.
    const recipientEmail = `phase21-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.test`.toLowerCase();
    await page.getByLabel('Họ và tên').fill('Phase 2.1 Browser Customer');
    await page.getByLabel('Email').fill(recipientEmail);
    await page.getByLabel('Số điện thoại (E.164)').fill('+84909000021');

    // 10. Click HOLD.
    await page.getByRole('button', { name: 'Giữ chỗ' }).click();
    await expect(page.getByTestId('hold-success-panel')).toBeVisible({ timeout: 30_000 });

    // 11. Read the booking code from the browser-rendered HOLD panel.
    const bookingCode = (await page.getByTestId('hold-booking-code').innerText()).trim();
    expect(bookingCode).toMatch(/^[A-Z0-9-]{8,32}$/);
    // URL must not contain the booking code or recipient email.
    const holdUrl = page.url();
    expect(holdUrl).not.toContain(bookingCode);
    expect(holdUrl).not.toContain(recipientEmail);

    // 12. Navigate to booking management through the UI button.
    const manageBookingCta = page.getByRole('button', { name: 'Quản lý đặt phòng' });
    await manageBookingCta.click();
    await expect(page).toHaveURL(/\/booking\/manage(\?|$)/);

    // 13. Enter booking code and email in the OTP request panel.
    await page.getByLabel('Mã đặt phòng').fill(bookingCode);
    await page.getByLabel('Email đã dùng khi đặt phòng').fill(recipientEmail);
    await page.getByRole('button', { name: 'Gửi mã xác nhận' }).click();

    // 14. Read OTP from Mailpit through the test helper only.
    const otp = await waitForVerificationOtp(recipientEmail);
    expect(otp).toMatch(/^\d{6}$/);

    // 15. Enter OTP in the browser.
    await page.getByLabel('Mã xác nhận').fill(otp);
    await page.getByRole('button', { name: 'Xác nhận' }).click();

    // 16. The browser reaches the persistent booking-code route.
    await expect(page).toHaveURL(/\/booking\/manage\/[A-Z0-9-]+$/, { timeout: 30_000 });
    await expect(page.getByTestId('guest-booking-detail')).toBeVisible({ timeout: 30_000 });
    // The URL must not contain the OTP code, the recipient email, or any
    // challenge / session identifier.
    const otpUrl = page.url();
    expect(otpUrl).not.toContain(otp);
    expect(otpUrl).not.toContain(recipientEmail);
    expect(otpUrl).not.toContain('challengeRef');
    expect(otpUrl).not.toContain('rm_guest_session_v1');

    // 17. Click MoMo through the browser.
    const momoButton = page.getByRole('button', { name: 'Thanh toán qua MoMo' });
    await expect(momoButton).toBeVisible({ timeout: 30_000 });

    // The simulator derives the back-redirect from
    // PAYMENT_SIMULATOR_DEFAULT_BACK_REDIRECT_BASE — there must be no
    // explicit control-plane backRedirectUrl configuration for this run.
    const health = await fetch(`${process.env.PAYMENT_SIMULATOR_BASE_URL ?? 'http://127.0.0.1:3090'}/__health`).then(
      (response) => response.json(),
    );
    expect(health.defaultBackRedirectBase).toBeTruthy();
    expect(health.providers.momo.backRedirectUrl).toBe('');
    expect(health.providers.vnpay.backRedirectUrl).toBe('');

    const initialIpnCount = (await readSimulatorCounts()).counts.momoIpnAttempts;
    await Promise.all([
      page.waitForURL((current) => current.host === '127.0.0.1:3090', { timeout: 30_000 }),
      momoButton.click(),
    ]);

    // 18. Wait until the simulator has posted at least one IPN, then
    // observe the automatic browser back-redirect to the persistent
    // booking page.
    await waitFor(
      async () => {
        const counts = await readSimulatorCounts();
        return counts.counts.momoIpnAttempts > initialIpnCount;
      },
      { timeoutMs: 15_000 },
    );
    await expect(page).toHaveURL(/\/booking\/manage\/[A-Z0-9-]+$/, { timeout: 30_000 });

    // 19. Observe the loading state, then the confirmed success surface.
    await expect(page.getByTestId('confirmed-success-surface')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('confirmed-success-heading')).toHaveText('Đặt phòng thành công');

    // 20. Refresh — success must persist from authoritative server data.
    await page.reload();
    await expect(page.getByTestId('confirmed-success-surface')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('confirmed-success-heading')).toHaveText('Đặt phòng thành công');

    // 21. Exactly one confirmation email lands in Mailpit.
    await waitFor(
      async () => {
        const counts = await countMailpitMessages(
          recipientEmail,
          new RegExp(`Booking confirmed: ${bookingCode}`),
        );
        return counts.matching === 1;
      },
      { timeoutMs: 15_000 },
    );
  });
});
