import { expect, test } from '@playwright/test';

const baseURL = process.env.PUBLIC_E2E_BASE_URL!;
const adminEmail = process.env.PUBLIC_E2E_ADMIN_EMAIL;
const adminPassword = process.env.PUBLIC_E2E_ADMIN_PASSWORD;

test.describe('public release smoke', () => {
  test('HTTPS catalog and health endpoints are reachable', async ({ page, request }) => {
    for (const path of [
      '/health',
      '/api/v1/health/live',
      '/api/v1/health/ready',
      '/api/v1/public/room-types',
    ]) {
      const response = await request.get(new URL(path, baseURL).toString());
      expect(response.status(), path).toBe(200);
    }
    await page.goto(baseURL);
    await expect(page).toHaveURL(new RegExp(`^${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });

  test('ADMIN session uses a secure HttpOnly same-origin cookie', async ({ page, context }) => {
    test.skip(
      adminEmail === undefined || adminPassword === undefined,
      'public ADMIN credentials were not supplied',
    );
    await page.goto(new URL('/admin/login', baseURL).toString());
    await page.locator('input[name=email]').fill(adminEmail!);
    await page.locator('input[name=password]').fill(adminPassword!);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(/\/admin(\/|$)/);
    const cookies = await context.cookies(baseURL);
    const session = cookies.find((cookie) => cookie.name === 'better-auth.session_token');
    expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' });
    const me = await page.request.get(new URL('/api/admin/me', baseURL).toString());
    expect(me.status()).toBe(200);
  });
});
