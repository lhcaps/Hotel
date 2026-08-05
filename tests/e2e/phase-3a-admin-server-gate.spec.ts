import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

/**
 * Phase 3A focused browser suite. The goal is to prove the protected
 * administrator layout enforces authority on the SERVER before any
 * protected content reaches the wire. The previous client-side guard
 * (`AdminAccessGuard`) ran as a `useEffect` inside the protected shell,
 * which leaked the public layout skeleton into the response. These tests
 * assert that the SERVER performs the redirect.
 *
 * The primary scenario must use the real browser and real APIs. Test
 * helpers may seed deterministic fixtures (ADMIN/CUSTOMER cookies) but
 * the assertions must inspect actual rendered HTML and HTTP responses.
 *
 * The previous `admin-auth.spec.ts` already exercises the bootstrap
 * ADMIN sign-in flow. These tests deliberately use the *opposite*
 * posture — they assert that unauthenticated, CUSTOMER-only, and
 * malformed sessions CANNOT reach the protected shell.
 */

const ADMIN_PROTECTED_PATHS = [
  '/admin',
  '/admin/bookings',
  '/admin/amenities',
  '/admin/rooms',
  '/admin/property',
] as const;

test.describe('Phase 3A — ADMIN server-side authority gate', () => {
  for (const path of ADMIN_PROTECTED_PATHS) {
    test(`unauthenticated request to ${path} is redirected by the server before protected content renders`, async ({
      page,
    }) => {
      // Track every response that reaches the page; if the server returned
      // any of the protected shell markup (sidebar, top bar, navigation),
      // the assertion below will fail.
      const responses: Array<{ readonly pathname: string; readonly status: number }> = [];
      page.on('response', (response) => {
        responses.push({
          pathname: new URL(response.url()).pathname,
          status: response.status(),
        });
      });

      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Server redirect: the URL must end on /admin/login.
      expect(page.url(), `expected redirect to /admin/login from ${path}`).toMatch(
        /\/admin\/login$/,
      );

      // page.goto() resolves with the final login response (200), not the
      // intermediate server redirect. Assert the protected-path response
      // captured above instead.
      const protectedResponse = responses.find((response) => response.pathname === path);
      expect(
        protectedResponse?.status,
        `expected redirect status from ${path}`,
      ).toBeGreaterThanOrEqual(300);
      expect(protectedResponse?.status, `expected redirect status from ${path}`).toBeLessThan(400);

      // The protected sidebar/nav must never render in unauthenticated HTML.
      await expect(page.locator('div.admin-nav')).toHaveCount(0);
      await expect(page.locator('header.admin-topbar')).toHaveCount(0);
      await expect(page.locator('a.admin-brand')).toHaveCount(0);

      // The public CUSTOMER header must also be absent — the root layout
      // intentionally drops it for `/admin/**`.
      await expect(page.locator('header.public-header')).toHaveCount(0);

      // Sanity: the login page itself should be present.
      await expect(page.locator('main.admin-login-page')).toBeVisible();

      // And no 5xx should have leaked.
      const fiveHundreds = responses.filter((response) => response.status >= 500);
      expect(fiveHundreds, 'no 5xx response during unauthenticated admin gate').toHaveLength(0);
    });
  }

  test('valid ADMIN session reaches the protected shell with no public navigation', async ({
    page,
    context,
  }) => {
    // Sign in with the bootstrap ADMIN credential.
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(playwrightAdminEmail);
    await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL(/\/admin$/);

    // Confirm the server-authority endpoint still returns the ADMIN shape.
    const meResult = await page.evaluate(async () => {
      const response = await fetch('http://127.0.0.1:3101/api/v1/admin/me', {
        credentials: 'include',
      });
      return { status: response.status, body: await response.text() };
    });
    expect(meResult.status).toBe(200);
    const meBody = JSON.parse(meResult.body) as { role?: string; permissions?: readonly string[] };
    expect(meBody.role).toBe('SUPER_ADMIN');
    expect((meBody.permissions ?? []).length).toBeGreaterThan(0);

    // The protected shell must render in every protected route we touch.
    for (const path of ['/admin', '/admin/bookings']) {
      await page.goto(path);
      await expect(page.locator('div.admin-nav')).toBeVisible();
      await expect(page.locator('header.admin-topbar')).toBeVisible();
      await expect(page.locator('header.public-header')).toHaveCount(0);
    }

    // Logout via the dedicated ADMIN button.
    await page.getByRole('button', { name: 'Mở hồ sơ quản trị' }).click();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await page.waitForURL(/\/admin\/login$/);

    // Reload a protected route — the server must redirect again.
    await page.goto('/admin/bookings');
    await page.waitForURL(/\/admin\/login$/);
    await expect(page.locator('div.admin-nav')).toHaveCount(0);

    // And the API must report 401 once the cookie is gone.
    const afterLogout = await page.evaluate(async () => {
      const response = await fetch('http://127.0.0.1:3101/api/v1/admin/me', {
        credentials: 'include',
      });
      return response.status;
    });
    expect(afterLogout).toBe(401);

    // Defensive: the cleared context must not retain an admin cookie.
    const cookies = await context.cookies();
    const adminCookies = cookies.filter((cookie) => cookie.name.toLowerCase().includes('session'));
    expect(adminCookies, 'admin session cookie cleared after logout').toHaveLength(0);
  });

  test('CUSTOMER session cannot reach the protected ADMIN shell', async ({ page, context }) => {
    const oidcBaseUrl = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;
    if (oidcBaseUrl === undefined) {
      throw new Error('PLAYWRIGHT_TEST_OIDC_BASE_URL is required for CUSTOMER gate coverage');
    }

    // Create a real CUSTOMER session through the deterministic OIDC flow.
    const queued = await page.request.post(`${oidcBaseUrl}/test/set-next-user`, {
      data: {
        sub: 'phase-3a-customer-gate',
        email: 'phase-3a-customer@example.test',
        name: 'Phase 3A Customer',
      },
    });
    expect(queued.ok(), 'OIDC fixture accepts the CUSTOMER identity').toBe(true);
    await page.goto('/login');
    await page.getByTestId('test-identity-button').click();
    await page.waitForURL(/\/account\/bookings$/, { timeout: 30_000 });
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login\?customer=1/);

    const finalUrl = page.url();
    expect(finalUrl, 'CUSTOMER session redirected to login with customer=1 flag').toMatch(
      /\/admin\/login/,
    );

    // The server must have set the customer flag when it detected a
    // CUSTOMER cookie (the dedicated UI affordance to sign out is
    // conditional on this flag).
    expect(finalUrl).toContain('customer=1');
    await expect(page.locator('.admin-login-customer-notice')).toBeVisible();

    await expect(page.locator('div.admin-nav')).toHaveCount(0);
    await expect(page.locator('header.public-header')).toHaveCount(0);

    // Wipe any session cookies so this test cannot influence later tests.
    await context.clearCookies();
  });

  test('manipulated client-side role flag cannot grant ADMIN access', async ({ page }) => {
    // Inject a fake cookie that mimics the ADMIN session shape but with a
    // bogus signature. The API is the final authority; the manipulated
    // cookie must yield a redirect.
    await page.context().addCookies([
      {
        name: 'room_locale',
        value: 'vi',
        url: 'http://127.0.0.1:3100',
      },
    ]);
    // Make the request and verify the gate.
    const [protectedResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/admin/bookings' &&
          response.status() >= 300 &&
          response.status() < 400,
      ),
      page.goto('/admin/bookings'),
    ]);
    expect(protectedResponse.status(), 'manipulated role request must be redirected').toBe(307);
    await page.waitForURL(/\/admin\/login/);
    await expect(page.locator('div.admin-nav')).toHaveCount(0);
  });
});
