import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:3001';
const EMAIL = 'demo-verify@room.local';
const PASSWORD = 'Aa1-KnownVerifyPass-1234';

test('Enable payment providers via admin API', async ({ page, context, request }) => {
  // 1. Login via the web UI (so the cookie is on the right origin)
  await context.clearCookies();
  await page.goto(BASE + '/admin/login');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForTimeout(3000);

  // 2. Use the browser's request context (which has the cookie)
  const enabledCookies = await context.cookies();
  const sessionCookie = enabledCookies.find((c) => c.name === 'better-auth.session_token');
  console.log('Session cookie present:', !!sessionCookie);
  console.log('Cookie domain:', sessionCookie?.domain);
  console.log('Cookie path:', sessionCookie?.path);

  // 3. Use browser's context to PATCH providers (browser context sends cookies)
  const enableMomo = await context.request.patch(API + '/api/v1/admin/payment-providers/MOMO', {
    headers: { 'content-type': 'application/json' },
    data: { enabled: true },
  });
  console.log('Enable MOMO status:', enableMomo.status());
  console.log('Enable MOMO body:', (await enableMomo.text()).slice(0, 200));

  const enableVnpay = await context.request.patch(API + '/api/v1/admin/payment-providers/VNPAY', {
    headers: { 'content-type': 'application/json' },
    data: { enabled: true },
  });
  console.log('Enable VNPAY status:', enableVnpay.status());
  console.log('Enable VNPAY body:', (await enableVnpay.text()).slice(0, 200));

  // 4. Check public endpoint
  const publicCheck = await request.get(API + '/api/v1/public/payment-providers');
  console.log('Public status:', publicCheck.status());
  console.log('Public body:', await publicCheck.text());
});
