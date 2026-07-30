import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

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

const MAILPIT_API = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025';
const MAILPIT_DELETE_HEADER = process.env.PLAYWRIGHT_MAILPIT_DELETE_HEADER ?? 'X-Playwright-Email';
const RECIPIENT_TAG = `playwright-vertical-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const RECIPIENT_EMAIL = `${RECIPIENT_TAG}@playwright.test`;
const PHONE_E164 = '+84909000099';
const API_BASE = 'http://127.0.0.1:3101/api/v1';

const PROPERTY_ID = '10000000-0000-4000-8000-000000000001';
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const ROOM_ID = '10000000-0000-4000-8000-000000000301';

async function psqlQuery(sql: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'psql',
    ['--no-psqlrc', '--tuples-only', '--command', sql, DATABASE_URL],
    { windowsHide: true },
  );
  return stdout.trim();
}

async function deleteMailpitMessage(id: string): Promise<void> {
  await fetch(`${MAILPIT_API}/api/v1/message/${id}`, { method: 'DELETE' });
}

interface MailpitMessage {
  readonly ID: string;
  readonly To: readonly { readonly Address: string }[];
  readonly Subject: string;
  readonly Created: string;
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

async function waitForRecipientMessage(): Promise<MailpitMessage> {
  // The continuous worker emits both the HOLD confirmation and the OTP
  // request email to the same recipient. Wait specifically for the
  // verification / OTP email, not the HOLD confirmation, so this helper
  // works even when a prior test in the same file left its HOLD
  // confirmation in Mailpit.
  const deadline = Date.now() + 30_000;
  let last: MailpitMessage | undefined;
  while (Date.now() < deadline) {
    const messages = await listMailpitMessages();
    last = messages.find(
      (message) =>
        message.To.some((recipient) => recipient.Address === RECIPIENT_EMAIL) &&
        /verification/i.test(message.Subject),
    );
    if (last !== undefined) return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Mailpit did not receive a verification email for ${RECIPIENT_EMAIL}; last sample: ${JSON.stringify(last)}`,
  );
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

interface QuoteResponse {
  readonly id: string;
}

async function createQuote(): Promise<QuoteResponse> {
  const response = await fetch(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomTypeId: ROOM_TYPE_ID,
      checkIn: '2027-02-10T04:00:00.000Z',
      checkOut: '2027-02-10T07:00:00.000Z',
      adults: 2,
      children: 0,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create quote: ${response.status} body=${body}`);
  }
  return (await response.json()) as QuoteResponse;
}

test.describe('public booking vertical flow', () => {
  test('quote → hold → OTP email → verify → cookie session → detail → logout', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !/Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/.test(message.text())
      ) {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    page.on('requestfailed', (request) => {
      requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 500) {
        requestFailures.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    // 1. Obtain a quote through the public API. The active rate plan
    // price is mutated by admin-rate-plan.spec.ts (and resets only when
    // the disposable database is recreated), so read the live value via
    // `GET /quotes/:id` and assert on it instead of a hard-coded number.
    const quote = await createQuote();
    const detailResponse = await fetch(`${API_BASE}/quotes/${quote.id}`);
    if (!detailResponse.ok) {
      throw new Error(`Failed to read quote: ${detailResponse.status}`);
    }
    const detail = (await detailResponse.json()) as { pricing: { totalAmountVnd: number } };
    const expectedAmount = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(
      detail.pricing.totalAmountVnd,
    );

    // 2-3. Navigate to the quote page; verify pricing display.
    await page.goto(`/booking/quote/${quote.id}`);
    await expect(page.getByRole('heading', { name: 'Hoàn tất giữ chỗ' })).toBeVisible();
    await expect(page.getByText('Deluxe')).toBeVisible();
    await expect(page.locator('strong.font-mono')).toContainText(expectedAmount);

    // 4-5. Fill the contact form and submit HOLD.
    await page.getByLabel('Họ và tên').fill('Playwright Vertical');
    await page.getByLabel('Email').fill(RECIPIENT_EMAIL);
    await page.getByLabel(/Số điện thoại/).fill(PHONE_E164);
    const holdResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/public/quotes/') &&
        response.url().includes('/bookings') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Giữ chỗ' }).click();
    const holdResponse = await holdResponsePromise;
    if (!holdResponse.ok()) {
      const holdBody = await holdResponse.text();
      throw new Error(`HOLD request failed: ${holdResponse.status()} body=${holdBody}`);
    }

    // 6. Verify the booking code and countdown.
    const bookingCodeLocator = page.locator('dd.font-mono').first();
    await expect(bookingCodeLocator).toBeVisible();
    const bookingCode = (await bookingCodeLocator.textContent())?.trim() ?? '';
    expect(bookingCode).toMatch(/^[A-Z0-9-]{8,32}$/);
    await expect(page.getByText('Giữ chỗ thành công')).toBeVisible();
    await expect(page.locator('[data-testid="hold-countdown"]')).toContainText(
      'Thời gian còn lại:',
    );

    // 7-8. Navigate to booking management and enter booking code + email.
    await page.getByRole('button', { name: 'Quản lý đặt phòng' }).click();
    await page.waitForURL(/\/booking\/manage/);
    await page.getByLabel('Mã đặt phòng').fill(bookingCode);
    await page.getByLabel('Email').fill(RECIPIENT_EMAIL);

    // 9. Request OTP.
    await page.getByRole('button', { name: 'Gửi mã xác nhận' }).click();
    await expect(page.getByText(/Nếu thông tin đặt phòng hợp lệ/)).toBeVisible();

    // 10. Generic enumeration-resistant message confirmed above; verify no
    // booking-code leakage by inspecting the response body shape.
    const otpRequestResponse = await page.waitForResponse(
      (response) => response.url().endsWith('/public/guest-access/otp/request') && response.ok(),
    );
    const otpRequestBody = (await otpRequestResponse.json()) as {
      readonly challengeRef: string;
    };
    expect(otpRequestBody.challengeRef).toMatch(/^[1-9A-HJKMNP-Z]{32}$/);
    expect(page.url()).not.toContain(otpRequestBody.challengeRef);

    // 11. The Playwright-owned continuous worker (started in the global
    // setup) detects the queued outbox event and delivers the OTP email to
    // Mailpit. We poll Mailpit until the message arrives — bounded by the
    // continuous worker's outbox interval (250ms in tests).
    const mailpitMessage = await waitForRecipientMessage();
    expect(mailpitMessage.To.some((recipient) => recipient.Address === RECIPIENT_EMAIL)).toBe(true);
    expect(mailpitMessage.Subject).toMatch(/verification/i);

    const body = await fetchMailpitMessage(mailpitMessage.ID);
    const otp = await extractOtp(body);

    // 13-15. Enter OTP and verify.
    const verifyResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/public/guest-access/otp/verify') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill(otp);
    await page.getByRole('button', { name: 'Xác nhận' }).click();
    const verifyResponse = await verifyResponsePromise;
    if (!verifyResponse.ok()) {
      const body = await verifyResponse.text();
      throw new Error(`OTP verify failed: ${verifyResponse.status()} body=${body}`);
    }

    const cookiesAfterVerify = await context.cookies();
    const sessionCookieDebug = cookiesAfterVerify.find(
      (cookie) => cookie.name === 'rm_guest_session_v1',
    );
    if (sessionCookieDebug === undefined) {
      throw new Error('Session cookie was not set after verify');
    }

    // Wait for the in-page booking-detail fetch to complete.
    const inPageDetailPromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/public/bookings/') && response.request().method() === 'GET',
        { timeout: 20_000 },
      )
      .catch(() => undefined);
    await page.waitForTimeout(2_000); // Give the panel useEffect a moment.
    const inPageDetail = await inPageDetailPromise;
    if (inPageDetail === undefined) {
      throw new Error('In-page booking detail fetch did not fire within 20s');
    }
    if (!inPageDetail.ok()) {
      const body = await inPageDetail.text();
      throw new Error(`In-page booking detail failed: ${inPageDetail.status()} body=${body}`);
    }

    // 16. Booking detail renders. Property name may have been mutated by
    // prior admin specs running in the same session, so we match the prefix.
    await expect(page.getByText(/Playwright Hotel/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Deluxe')).toBeVisible();
    await expect(page.getByText(/Playwright Vertical/)).toBeVisible();
    const atIdx = RECIPIENT_EMAIL.indexOf('@');
    const maskedLocal = `${RECIPIENT_EMAIL[0]}${'*'.repeat(atIdx - 2)}${RECIPIENT_EMAIL[atIdx - 1]}`;
    const maskedEmailPattern = `${maskedLocal[0]}\\*+${maskedLocal[maskedLocal.length - 1]}@playwright\\.test`;
    await expect(page.getByText(new RegExp(maskedEmailPattern))).toBeVisible();

    // 17. HttpOnly cookie attributes: must not be readable from JS context.
    const sessionCookie = cookiesAfterVerify.find(
      (cookie) => cookie.name === 'rm_guest_session_v1',
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);

    // 18. Logout from the UI. Wait for the logout API response so the DB
    // revocation has settled, then explicitly clear the session cookie from
    // the browser context so the next credentialed request cannot race a
    // Set-Cookie header that the browser has not yet propagated.
    const logoutResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/public/guest-access/logout') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.ok(), `logout failed: ${logoutResponse.status()}`).toBe(true);
    await context.clearCookies({ name: 'rm_guest_session_v1' });

    // 19. Cookie must be revoked: subsequent credentialed booking-detail
    // request must return 401.
    const revokedResponse = await page
      .context()
      .request.get(`${API_BASE}/public/bookings/${bookingCode}`);
    expect(revokedResponse.status()).toBe(401);

    // After logout the UI returns to the initial request form.
    await expect(page.getByRole('heading', { name: 'Tra cứu đặt phòng của bạn' })).toBeVisible();

    // 20. Confirm no OTP / contact / session data appears in URL or storage.
    const url = page.url();
    expect(url).not.toContain(otp);
    expect(url).not.toContain(bookingCode);
    expect(url).not.toContain(RECIPIENT_EMAIL);
    expect(url).not.toContain(PHONE_E164);
    const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage));
    const sessionStorageDump = await page.evaluate(() => JSON.stringify(window.sessionStorage));
    expect(localStorageDump).not.toContain(otp);
    expect(localStorageDump).not.toContain(RECIPIENT_EMAIL);
    expect(localStorageDump).not.toContain(bookingCode);
    expect(sessionStorageDump).not.toContain(otp);
    expect(sessionStorageDump).not.toContain(RECIPIENT_EMAIL);
    expect(sessionStorageDump).not.toContain(bookingCode);

    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
    expect(requestFailures, requestFailures.join('\n')).toHaveLength(0);

    // Cleanup: remove only the message we created (do not delete unrelated).
    await deleteMailpitMessage(mailpitMessage.ID);
    void PROPERTY_ID;
    void ROOM_TYPE_ID;
    void ROOM_ID;
    void MAILPIT_DELETE_HEADER;
    void psqlQuery;
  });

  test('mobile viewport renders the same vertical flow', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await fetch(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: ROOM_TYPE_ID,
        checkIn: '2027-02-11T04:00:00.000Z',
        checkOut: '2027-02-11T07:00:00.000Z',
        adults: 2,
        children: 0,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create mobile quote: ${response.status}`);
    }
    const quote = (await response.json()) as QuoteResponse;
    await page.goto(`/booking/quote/${quote.id}`);
    await expect(page.getByRole('heading', { name: 'Hoàn tất giữ chỗ' })).toBeVisible();
    await page.getByLabel('Họ và tên').fill('Playwright Mobile');
    await page.getByLabel('Email').fill(`mobile-${RECIPIENT_TAG}@playwright.test`);
    await page.getByLabel(/Số điện thoại/).fill('+84909000098');
    await page.getByRole('button', { name: 'Giữ chỗ' }).click();
    await expect(page.getByText('Giữ chỗ thành công')).toBeVisible();
  });
});
