import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo-verify@room.local';
const PASSWORD = 'Aa1-KnownVerifyPass-1234';

async function login(page, context) {
  await context.clearCookies();
  await page.goto(BASE + '/admin/login');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForTimeout(3000);
}

test('All admin pages accessible', async ({ page, context }) => {
  await login(page, context);

  const pages = [
    { url: '/admin', name: 'Dashboard' },
    { url: '/admin/bookings', name: 'Bookings' },
    { url: '/admin/rooms', name: 'Rooms' },
    { url: '/admin/room-types', name: 'Room types' },
    { url: '/admin/payment-providers', name: 'Payment providers' },
    { url: '/admin/property', name: 'Property' },
  ];

  for (const { url, name } of pages) {
    await page.goto(BASE + url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    const status = page.url();
    const html = await page.content();
    const hasAdminLayout = /admin-layout/.test(html);
    console.log(`${url}: url=${status}, hasLayout=${hasAdminLayout}`);
  }
});
