import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { expect, test, type Page } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

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
const OIDC_BASE_URL = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const RUN_TAG = `6e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

if (OIDC_BASE_URL === undefined) {
  throw new Error('PLAYWRIGHT_TEST_OIDC_BASE_URL is required for CUSTOMER authorization coverage');
}

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

interface AdminFetchOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
}

async function adminFetch(
  page: Page,
  path: string,
  options: AdminFetchOptions = {},
): Promise<FetchResult> {
  return page.evaluate(
    async ({ url, method, body }: { url: string; method: string; body: unknown | undefined }) => {
      const init: RequestInit = {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      const response = await fetch(url, init);
      return { status: response.status, body: await response.text() };
    },
    {
      url: `${API_BASE}${path}`,
      method: options.method ?? 'GET',
      body: options.body,
    },
  );
}

async function loginAsAdminThroughUi(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/\/admin$/);
}

async function loginAsCustomerThroughDeterministicOidc(page: Page): Promise<void> {
  const response = await page.request.post(`${OIDC_BASE_URL}/test/set-next-user`, {
    data: {
      sub: `coupon-customer-${RUN_TAG}`,
      email: `${RUN_TAG}-customer@playwright.test`,
      name: 'Coupon Customer',
    },
  });
  if (!response.ok()) {
    throw new Error(`OIDC fixture setup failed: ${response.status()} ${await response.text()}`);
  }
  await page.goto('/login');
  await page.getByTestId('test-identity-button').click();
  await page.waitForURL(/\/account\/bookings$/, { timeout: 30_000 });
}

test.describe('Phase 6E ADMIN coupon vertical', () => {
  test('ADMIN coupon workspace loads and supports safe navigation', async ({ page }) => {
    await loginAsAdminThroughUi(page);
    await page.goto('/admin/coupons');
    await expect(page.getByRole('heading', { name: 'Coupon' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tạo coupon' })).toBeVisible();
    await page.getByRole('link', { name: 'Tạo coupon' }).click();
    await expect(page).toHaveURL(/\/admin\/coupons\/new$/);
    await expect(page.getByRole('heading', { name: 'Tạo coupon' })).toBeVisible();
    await expect(page.getByLabel('Mã coupon')).toBeVisible();
  });

  test('ADMIN creates FIXED and PERCENTAGE coupons, then disables the FIXED one and the public flow rejects the disabled coupon', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        // Chromium v-flag regex warning for `[A-Za-z0-9-]` in form pattern.
        if (/Pattern attribute value .* is not a valid regular expression/.test(message.text())) {
          return;
        }
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
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

    const fixedCode = `6E-FIX-${RUN_TAG.toUpperCase()}`;
    const percentageCode = `6E-PCT-${RUN_TAG.toUpperCase()}`;
    const validityNow = new Date(Date.now() - 60_000);
    const validityEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const fromLocal = `${validityNow.getFullYear()}-${String(validityNow.getMonth() + 1).padStart(2, '0')}-${String(validityNow.getDate()).padStart(2, '0')}T${String(validityNow.getHours()).padStart(2, '0')}:${String(validityNow.getMinutes()).padStart(2, '0')}`;
    const untilLocal = `${validityEnd.getFullYear()}-${String(validityEnd.getMonth() + 1).padStart(2, '0')}-${String(validityEnd.getDate()).padStart(2, '0')}T${String(validityEnd.getHours()).padStart(2, '0')}:${String(validityEnd.getMinutes()).padStart(2, '0')}`;

    // 1-2. Authenticate as ADMIN and open the list.
    await loginAsAdminThroughUi(page);
    await page.goto('/admin/coupons');
    await expect(page.getByRole('heading', { name: 'Coupon' })).toBeVisible();

    // 3-4. Open the create page and create a FIXED coupon through the UI.
    await page.getByRole('link', { name: 'Tạo coupon' }).click();
    await expect(page).toHaveURL(/\/admin\/coupons\/new$/);
    await expect(page.getByRole('heading', { name: 'Tạo coupon' })).toBeVisible();

    const fixedCreatePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/admin/coupons') && response.request().method() === 'POST',
    );
    await page.getByLabel('Mã coupon').fill(fixedCode);
    await page.getByLabel('Hiệu lực từ').fill(fromLocal);
    await page.getByLabel('Hiệu lực đến').fill(untilLocal);
    await page.getByLabel('Số tiền VND').fill('50000');
    await page.getByRole('button', { name: 'Tạo coupon' }).click();
    const fixedCreateResponse = await fixedCreatePromise;
    if (!fixedCreateResponse.ok()) {
      const body = await fixedCreateResponse.text();
      throw new Error(`FIXED create failed: ${fixedCreateResponse.status()} body=${body}`);
    }

    // 5. The POST body must contain only the FIXED creation contract.
    const fixedCreateBody = JSON.parse(fixedCreateResponse.request().postData() ?? '{}') as Record<
      string,
      unknown
    >;
    expect(fixedCreateBody).toMatchObject({
      code: fixedCode,
      discountType: 'FIXED',
      fixedAmountVnd: 50_000,
      roomTypes: { all: true },
    });
    expect(fixedCreateBody).not.toHaveProperty('percentageBasisPoints');
    expect(fixedCreateBody).not.toHaveProperty('maximumDiscountVnd');

    // 6-7. Redirect to the detail page; verify FIXED amount and lifecycle.
    await page.waitForURL(/\/admin\/coupons\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: fixedCode })).toBeVisible();
    await expect(page.getByText('AVAILABLE')).toBeVisible();
    await expect(page.getByText(/50\.000/)).toBeVisible();
    const fixedDetailUrl = page.url();
    const fixedCouponId = fixedDetailUrl.split('/').pop() ?? '';
    if (fixedCouponId === '') throw new Error('Could not extract FIXED coupon id from URL');

    // 8-9. Return to the create page and create a PERCENTAGE coupon scoped to one room type.
    await page.goto('/admin/coupons/new');
    await expect(page.getByRole('heading', { name: 'Tạo coupon' })).toBeVisible();
    // Wait for the room types fetch to complete so the per-room checkboxes
    // are available after toggling "all" off.
    await expect.poll(async () => (await adminFetch(page, '/admin/room-types')).status).toBe(200);

    const percentageCreatePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/admin/coupons') && response.request().method() === 'POST',
    );
    await page.getByLabel('Mã coupon').fill(percentageCode);
    // Toggle the FIXED radio off and PERCENTAGE on.
    await page.getByLabel('PERCENTAGE').check();
    await page.getByLabel(/Tỷ lệ basis points/).fill('1000');
    await page.getByLabel('Hiệu lực từ').fill(fromLocal);
    await page.getByLabel('Hiệu lực đến').fill(untilLocal);
    // Switch scope to specific room type and select ROOM_TYPE_ID.
    await page.getByLabel('Tất cả loại phòng').uncheck();
    await page.getByLabel('Nami').check();
    await page.getByRole('button', { name: 'Tạo coupon' }).click();
    const percentageCreateResponse = await percentageCreatePromise;
    if (!percentageCreateResponse.ok()) {
      const body = await percentageCreateResponse.text();
      throw new Error(
        `PERCENTAGE create failed: ${percentageCreateResponse.status()} body=${body}`,
      );
    }

    // 10. The PERCENTAGE POST body must contain percentageBasisPoints, the
    // selected roomTypeIds, and must NOT contain fixedAmountVnd.
    const percentageCreateBody = JSON.parse(
      percentageCreateResponse.request().postData() ?? '{}',
    ) as Record<string, unknown>;
    expect(percentageCreateBody).toMatchObject({
      code: percentageCode,
      discountType: 'PERCENTAGE',
      percentageBasisPoints: 1000,
      roomTypes: { roomTypeIds: [ROOM_TYPE_ID] },
    });
    expect(percentageCreateBody).not.toHaveProperty('fixedAmountVnd');
    expect(percentageCreateBody).not.toHaveProperty('all');

    await page.waitForURL(/\/admin\/coupons\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: percentageCode })).toBeVisible();

    // 11. Return to the list and find both coupons.
    await page.goto('/admin/coupons');
    await expect(page.getByRole('heading', { name: 'Coupon' })).toBeVisible();
    // Filter to the unique run tag so we can deterministically find our two coupons.
    await page.getByLabel('Tìm theo mã').fill(RUN_TAG.toUpperCase().slice(0, 8));
    await expect(page.getByRole('heading', { name: fixedCode })).toBeVisible();
    await expect(page.getByRole('heading', { name: percentageCode })).toBeVisible();

    // 12-14. Open the FIXED coupon detail.
    await page.goto(`/admin/coupons/${fixedCouponId}`);
    await page.waitForURL(/\/admin\/coupons\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: fixedCode })).toBeVisible();

    // 15. Issue a live public quote with the FIXED coupon BEFORE disabling
    // it. The quote must succeed (the coupon is still ACTIVE). We capture
    // the quote id so we can revalidate at HOLD time after disabling.
    const liveQuoteBody = JSON.stringify({
      roomTypeId: ROOM_TYPE_ID,
      checkIn: '2027-03-12T04:00:00.000Z',
      checkOut: '2027-03-12T07:00:00.000Z',
      adults: 2,
      children: 0,
      couponCode: fixedCode,
    });
    const liveQuote = await page.evaluate(
      async ({ url, body }) => {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body,
        });
        return { status: response.status, body: await response.text() };
      },
      { url: `${API_BASE}/quotes`, body: liveQuoteBody },
    );
    expect(liveQuote.status, `Live quote must succeed: body=${liveQuote.body}`).toBe(201);
    const liveQuoteId = (JSON.parse(liveQuote.body) as { id: string }).id;

    // Capture pre-rejection error counters. The two requests immediately
    // below are deliberately expected to fail with safe 4xx and Chromium
    // prints "Failed to load resource: <status>" to the console for each.
    // Those lines are informational, not real bugs; the trailing assertion
    // filters them out by rejecting only errors that aren't part of the
    // expected rejection envelope.
    const preRejectionSnapshot = {
      console: consoleErrors.length,
      page: pageErrors.length,
      request: requestFailures.length,
    };
    // Known auto-logged Chromium console lines that follow a safe 4xx.
    const isExpectedRejectionConsoleLine = (line: string): boolean =>
      /Failed to load resource: the server responded with a status of (400|401|403|404|409|410|422|429)/.test(
        line,
      );
    // The request-failure listener at the top only flags responses with
    // status >= 500, so a 4xx rejection does not pollute the request
    // failures array. The consoleError listener above is the only one we
    // need to filter for known safe-rejection lines.

    // 16. Disable the FIXED coupon.
    page.once('dialog', (dialog) => {
      void dialog.accept();
    });
    const disablePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/admin/coupons/${fixedCouponId}/disable`) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Vô hiệu hóa coupon' }).click();
    const disableResponse = await disablePromise;
    expect(
      disableResponse.ok(),
      `Disable must succeed: ${disableResponse.status()} body=${await disableResponse.text()}`,
    ).toBe(true);

    // 17. Lifecycle becomes DISABLED.
    await expect(page.getByText('DISABLED')).toBeVisible();
    // 18. No re-enable action exists.
    expect(await page.getByRole('button', { name: 'Vô hiệu hóa coupon' }).count()).toBe(0);
    expect(
      await page.getByRole('button', { name: /kích hoạt lại|enable|re-?enable/i }).count(),
    ).toBe(0);

    // 19. Attempting to apply the DISABLED coupon in the public quote flow
    // must be safely rejected (4xx), and the post-disable HOLD revalidation
    // must also be safely rejected. Either path is documented by the Phase
    // 6D contract; both are acceptable safety gates.
    const disabledQuote = await adminFetch(page, '/quotes', {
      method: 'POST',
      body: {
        roomTypeId: ROOM_TYPE_ID,
        checkIn: '2027-03-12T04:00:00.000Z',
        checkOut: '2027-03-12T07:00:00.000Z',
        adults: 2,
        children: 0,
        couponCode: fixedCode,
      },
    });
    const disabledQuoteRejected = disabledQuote.status >= 400 && disabledQuote.status < 500;
    const holdResult = await adminFetch(page, `/public/quotes/${liveQuoteId}/bookings`, {
      method: 'POST',
      body: {
        contact: {
          fullName: 'Phase 6E Disabled',
          email: `${RUN_TAG}-disabled@playwright.test`,
          phone: '+84909000096',
        },
      },
    });
    const holdRejected = holdResult.status >= 400 && holdResult.status < 500;
    expect(
      disabledQuoteRejected || holdRejected,
      `Disabled coupon must be safely rejected: quote=${disabledQuote.status} body=${disabledQuote.body} | hold=${holdResult.status} body=${holdResult.body}`,
    ).toBe(true);
    const acceptedCodes = ['COUPON_REQUOTE_REQUIRED', 'COUPON_EXPIRED', 'COUPON_NOT_APPLICABLE'];
    if (holdRejected) {
      const matchedCode = acceptedCodes.find((code) => holdResult.body.includes(code));
      expect(matchedCode, `HOLD must surface one of ${acceptedCodes.join(', ')}`).toBeDefined();
      expect(holdResult.body).not.toMatch(/SELECT|INSERT|UPDATE|DELETE|FROM\s+\w+/i);
    } else if (disabledQuoteRejected) {
      const matchedCode = acceptedCodes.find((code) => disabledQuote.body.includes(code));
      expect(
        matchedCode,
        `Disabled-coupon quote must surface one of ${acceptedCodes.join(', ')}`,
      ).toBeDefined();
      expect(disabledQuote.body).not.toMatch(/SELECT|INSERT|UPDATE|DELETE|FROM\s+\w+/i);
    }

    // Assert no page errors, no 5xx request failures, and no unexpected
    // console errors beyond the Chromium auto-logged safe-rejection lines.
    expect(
      pageErrors.slice(preRejectionSnapshot.page),
      pageErrors.slice(preRejectionSnapshot.page).join('\n'),
    ).toHaveLength(0);
    expect(
      requestFailures.slice(preRejectionSnapshot.request),
      requestFailures.slice(preRejectionSnapshot.request).join('\n'),
    ).toHaveLength(0);
    const newConsoleErrors = consoleErrors
      .slice(preRejectionSnapshot.console)
      .filter((line) => !isExpectedRejectionConsoleLine(line));
    expect(newConsoleErrors, newConsoleErrors.join('\n')).toHaveLength(0);
  });

  test('unauthenticated access to /admin/coupons is rejected by the API', async () => {
    // Use a fresh request context with no cookies to simulate a brand-new
    // unauthenticated visitor. The admin coupon endpoints require
    // ADMIN authentication, so the request must be rejected (401/403).
    const response = await fetch(`${API_BASE}/admin/coupons?page=1&pageSize=10`, {
      headers: { accept: 'application/json' },
    });
    expect(response.status, `Expected 401/403, got ${response.status}`).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  test('CUSTOMER (non-ADMIN) access to /admin/coupons is rejected', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await loginAsCustomerThroughDeterministicOidc(page);
    const uiResponse = await page.goto('/admin/coupons');
    expect(uiResponse?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveURL(/\/admin\/(login|forbidden)(\?|$)/);

    const adminList = await page.request.get(`${API_BASE}/admin/coupons?page=1&pageSize=10`);
    expect(
      adminList.status(),
      `CUSTOMER must be rejected from admin endpoint, got ${adminList.status()}`,
    ).toBeGreaterThanOrEqual(400);
    expect(adminList.status()).toBeLessThan(500);
    expect(pageErrors).toEqual([]);
    // The protected route's client data request is intentionally rejected
    // while the guard redirects the already-authenticated CUSTOMER. Chromium
    // reports that expected 403 as a resource error; any other console error
    // remains a test failure.
    expect(
      consoleErrors.filter(
        (line) =>
          !/Failed to load resource: the server responded with a status of (401|403) \((Unauthorized|Forbidden)\)/.test(
            line,
          ),
      ),
    ).toEqual([]);
  });

  test('ADMIN access succeeds and returns the coupon list', async ({ page }) => {
    await loginAsAdminThroughUi(page);
    const list = await adminFetch(page, '/admin/coupons?page=1&pageSize=10');
    expect(list.status).toBe(200);
    const parsed = JSON.parse(list.body) as {
      readonly page: number;
      readonly pageSize: number;
      readonly items: readonly unknown[];
    };
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(10);
    expect(Array.isArray(parsed.items)).toBe(true);
  });

  test('mobile viewport renders the list and create form with critical controls visible', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdminThroughUi(page);

    await page.goto('/admin/coupons');
    await expect(page.getByRole('heading', { name: 'Coupon' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tạo coupon' })).toBeVisible();

    await page.getByRole('link', { name: 'Tạo coupon' }).click();
    await expect(page).toHaveURL(/\/admin\/coupons\/new$/);

    // Critical form controls must be visible and not clipped horizontally.
    const codeInput = page.getByLabel('Mã coupon');
    const submitButton = page.getByRole('button', { name: 'Tạo coupon' });
    await expect(codeInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    const codeBox = await codeInput.boundingBox();
    const buttonBox = await submitButton.boundingBox();
    const viewport = page.viewportSize();
    if (codeBox === null || buttonBox === null || viewport === null) {
      throw new Error('Could not measure form controls');
    }
    expect(codeBox.x + codeBox.width, 'code input must fit within viewport').toBeLessThanOrEqual(
      viewport.width,
    );
    expect(
      buttonBox.x + buttonBox.width,
      'submit button must fit within viewport',
    ).toBeLessThanOrEqual(viewport.width);

    // Fill the form and submit; the mobile viewport must produce a working
    // create request identical to the desktop shape.
    const mobileCode = `6E-M-${RUN_TAG.toUpperCase().slice(0, 8)}`;
    const validityNow = new Date(Date.now() - 60_000);
    const validityEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const mFromLocal = `${validityNow.getFullYear()}-${String(validityNow.getMonth() + 1).padStart(2, '0')}-${String(validityNow.getDate()).padStart(2, '0')}T${String(validityNow.getHours()).padStart(2, '0')}:${String(validityNow.getMinutes()).padStart(2, '0')}`;
    const mUntilLocal = `${validityEnd.getFullYear()}-${String(validityEnd.getMonth() + 1).padStart(2, '0')}-${String(validityEnd.getDate()).padStart(2, '0')}T${String(validityEnd.getHours()).padStart(2, '0')}:${String(validityEnd.getMinutes()).padStart(2, '0')}`;
    const createPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/admin/coupons') && response.request().method() === 'POST',
    );
    await codeInput.fill(mobileCode);
    await page.getByLabel('Hiệu lực từ').fill(mFromLocal);
    await page.getByLabel('Hiệu lực đến').fill(mUntilLocal);
    await page.getByLabel('Số tiền VND').fill('50000');
    await submitButton.click();
    const createResponse = await createPromise;
    expect(createResponse.ok(), `mobile create failed: ${createResponse.status()}`).toBe(true);
  });
});

test.afterAll(async () => {
  // Best-effort cleanup so the test run does not leak coupons across suites.
  try {
    await psql(
      `DELETE FROM coupons WHERE code LIKE '6E-%' AND code LIKE '%${RUN_TAG.toUpperCase()}%';`,
    );
  } catch {
    // No-op: cleanup is a safety net.
  }
});
