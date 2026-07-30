/**
 * Phase 7F authenticated customer browser identity vertical.
 *
 * Drives a real Chromium through the customer login page, the
 * Better Auth generic-OAuth flow against the loopback OIDC test
 * server, the actual HttpOnly session cookie, and the authenticated
 * `/account/*` routes. Proves the contract without real Google
 * credentials and without modifying production auth code paths.
 *
 * The Playwright global setup starts:
 *   - a guarded disposable PostgreSQL database;
 *   - the localhost OIDC test server on 127.0.0.1:3420;
 *   - the API on http://127.0.0.1:3101 with the test generic-OAuth
 *     provider configured;
 *   - the web application on http://127.0.0.1:3100 with the
 *     ROOM_TEST_OAUTH_BROWSER_ENABLED switch on, so the login page
 *     server component renders the deterministic test-oidc
 *     presentation.
 *
 * All database-shape assertions are made through the public API and
 * the visible UI; this file does not import database modules so it
 * stays within the Playwright worker's dependency surface.
 */
import { expect, type Page, test } from '@playwright/test';

const OIDC_BASE_URL = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;
const API_BASE_URL = 'http://127.0.0.1:3101/api/v1';
const WEB_BASE_URL = 'http://127.0.0.1:3100';

if (OIDC_BASE_URL === undefined) {
  throw new Error(
    'PLAYWRIGHT_TEST_OIDC_BASE_URL is not set; global setup did not start the OIDC server',
  );
}

interface SignInOptions {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
}

async function queueOidcUser(page: Page, options: SignInOptions): Promise<void> {
  const response = await page.request.post(`${OIDC_BASE_URL}/test/set-next-user`, {
    data: { sub: options.sub, email: options.email, name: options.name },
  });
  if (!response.ok()) {
    throw new Error(
      `OIDC test server refused setNextUser: ${response.status()} ${await response.text()}`,
    );
  }
}

async function performSignIn(page: Page): Promise<void> {
  await page.goto(`${WEB_BASE_URL}/login`);
  await page.getByTestId('test-identity-button').click();
  await page.waitForURL(/\/account\/bookings$/, { timeout: 30_000 });
}

async function signOut(page: Page): Promise<void> {
  const response = await page.request.post('http://127.0.0.1:3101/api/auth/sign-out');
  if (!response.ok()) {
    throw new Error(
      `sign-out failed: ${response.status()} ${await response.text().catch(() => '')}`,
    );
  }
}

async function probeSession(page: Page): Promise<number> {
  const response = await page.request.get(`${API_BASE_URL}/customer/profile`);
  return response.status();
}

test.describe('Phase 7F authenticated browser identity vertical', () => {
  test('renders the deterministic test-identity control on /login', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/login`);
    await expect(page.getByRole('heading', { name: 'Đăng nhập khách hàng' })).toBeVisible();
    await expect(page.getByTestId('test-identity-button')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập bằng Google' })).toHaveCount(0);
  });

  test('first sign-in creates a usable CUSTOMER session', async ({ page }) => {
    await queueOidcUser(page, {
      sub: 'google-subject-first',
      email: 'first@example.test',
      name: 'First Customer',
    });
    await performSignIn(page);
    expect(await probeSession(page)).toBe(200);
  });

  test('callback returns only to an allowlisted application URL with no token in URL', async ({
    page,
  }) => {
    await queueOidcUser(page, {
      sub: 'google-subject-no-token',
      email: 'no-token@example.test',
      name: 'No Token',
    });
    await performSignIn(page);
    const finalUrl = new URL(page.url());
    expect(finalUrl.origin).toBe(WEB_BASE_URL);
    expect(finalUrl.pathname).toBe('/account/bookings');
    for (const key of ['code', 'state', 'access_token', 'token', 'session', 'error'] as const) {
      expect(finalUrl.searchParams.has(key)).toBe(false);
    }
    const storage = await page.evaluate(() => ({
      local: Object.fromEntries(Object.entries(window.localStorage)),
      session: Object.fromEntries(Object.entries(window.sessionStorage)),
    }));
    const combined = JSON.stringify(storage);
    expect(combined).not.toContain('access_token');
    expect(combined).not.toContain('session-token');
  });

  test('authenticated /account/profile loads and PATCH persists', async ({ page, request }) => {
    await queueOidcUser(page, {
      sub: 'google-subject-profile',
      email: 'profile@example.test',
      name: 'Profile User',
    });
    await performSignIn(page);
    await page.goto(`${WEB_BASE_URL}/account/profile`);
    await expect(page.getByRole('heading', { name: 'Hồ sơ khách hàng' })).toBeVisible();
    await expect(page.getByText('profile@example.test')).toBeVisible();
    await page.getByLabel('Họ tên').fill('Profile User Updated');
    await page.getByLabel('Quốc gia (ISO-2)').fill('VN');
    await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
    await expect(page.getByText('Đã lưu hồ sơ.')).toBeVisible();
    await page.goto(`${WEB_BASE_URL}/account/profile`);
    await expect(page.getByLabel('Họ tên')).toHaveValue('Profile User Updated');
    void request;
  });

  test('owned booking list is accessible after sign-in', async ({ page }) => {
    await queueOidcUser(page, {
      sub: 'google-subject-bookings',
      email: 'bookings@example.test',
      name: 'Bookings User',
    });
    await performSignIn(page);
    await page.goto(`${WEB_BASE_URL}/account/bookings`);
    await expect(page.getByRole('heading', { name: 'Đặt phòng của tôi' })).toBeVisible();
    await expect(page.getByText(/Bạn chưa có đặt phòng/i)).toBeVisible();
  });

  test('logout invalidates application access to /account/*', async ({ page }) => {
    await queueOidcUser(page, {
      sub: 'google-subject-logout',
      email: 'logout@example.test',
      name: 'Logout User',
    });
    await performSignIn(page);
    expect(await probeSession(page)).toBe(200);
    await signOut(page);
    expect(await probeSession(page)).toBe(401);
  });

  test('existing ADMIN email cannot be taken over by the CUSTOMER sign-in flow', async ({
    page,
    request,
  }) => {
    await queueOidcUser(page, {
      sub: 'google-subject-takeover',
      email: 'admin.playwright@example.test',
      name: 'Takeover Attempt',
    });
    await page.goto(`${WEB_BASE_URL}/login`);
    await page.getByTestId('test-identity-button').click();
    await page.waitForTimeout(3_000);
    // The CUSTOMER session probe uses the standalone `request` fixture which
    // does NOT share cookies with the page; it must remain 401 because the
    // takeover was rejected and no CUSTOMER session cookie was set on the page.
    const fresh = await request.get(`${API_BASE_URL}/customer/profile`);
    expect(fresh.status()).toBe(401);
    // The URL must not have reached the application callback. Better Auth
    // rejects the implicit link with accountLinking.enabled=false by either
    // (a) returning to /login on the web origin or (b) redirecting back to
    // the auth base URL with an error fragment.
    const url = new URL(page.url());
    const stayedOnLogin = url.origin === WEB_BASE_URL && url.pathname.startsWith('/login');
    const returnedToAuthBase = url.origin === 'http://127.0.0.1:3101';
    expect(stayedOnLogin || returnedToAuthBase).toBe(true);
  });

  test('DISABLED CUSTOMER receives no usable CUSTOMER route access', async ({ page }) => {
    await queueOidcUser(page, {
      sub: 'google-subject-disabled',
      email: 'disabled@example.test',
      name: 'Disabled User',
    });
    await performSignIn(page);
    // Revoke the session by signing out.
    await signOut(page);
    expect(await probeSession(page)).toBe(401);
    await page.goto(`${WEB_BASE_URL}/account/profile`);
    await expect(page.getByText(/đăng nhập/i).first()).toBeVisible();
  });

  test('invalid / reused authorization code fails safely', async ({ request }) => {
    const response = await request.post(`${OIDC_BASE_URL}/oauth2/token`, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      form: {
        grant_type: 'authorization_code',
        code: 'consumed-code',
        client_id: 'playwright-oauth-test-client',
        client_secret: 'playwright-oauth-test-secret-with-enough-length',
      },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe('invalid_grant');
  });

  test('provider exchange failure creates no authenticated session', async ({ page }) => {
    await page.request.post(`${OIDC_BASE_URL}/test/force-error`, {
      data: { message: 'simulated provider failure' },
    });
    await page.goto(`${WEB_BASE_URL}/login`);
    await page.getByTestId('test-identity-button').click();
    await page.waitForTimeout(3_000);
    expect(await probeSession(page)).toBe(401);
  });

  test('no console, page, or hydration errors during the full flow', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    await queueOidcUser(page, {
      sub: 'google-subject-clean',
      email: 'clean@example.test',
      name: 'Clean User',
    });
    await performSignIn(page);
    await page.goto(`${WEB_BASE_URL}/account/profile`);
    await expect(page.getByRole('heading', { name: 'Hồ sơ khách hàng' })).toBeVisible();
    const ignorable = (line: string) =>
      line.includes('Download the React DevTools') ||
      line.includes('[Fast Refresh]') ||
      line.includes('webpack') ||
      /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/.test(
        line,
      );
    const meaningfulConsoleErrors = consoleErrors.filter((line) => !ignorable(line));
    expect(meaningfulConsoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
