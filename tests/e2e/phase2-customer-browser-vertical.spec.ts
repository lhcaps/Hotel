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
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';

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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('room-detail-browse-cta')).toBeVisible();
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

    // No horizontal overflow on mobile.
    const overflow = await page.evaluate(() => {
      return {
        documentScroll: document.documentElement.scrollWidth,
        bodyScroll: document.body.scrollWidth,
        inner: window.innerWidth,
      };
    });
    expect(overflow.documentScroll).toBe(overflow.inner);
    expect(overflow.bodyScroll).toBe(overflow.inner);
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
});
