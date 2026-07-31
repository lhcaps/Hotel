import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo-verify@room.local';
const PASSWORD = 'Aa1-KnownVerifyPass-1234';

test('Detailed admin flow', async ({ page, context }) => {
  await context.clearCookies();

  // Step 1: GET /admin should redirect to /admin/login
  console.log('=== Step 1: GET /admin (unauth) ===');
  await page.goto(BASE + '/admin');
  console.log('  url:', page.url());
  expect(page.url()).toMatch(/\/admin\/login/);

  // Step 2: Login
  console.log('=== Step 2: Login ===');
  await page.goto(BASE + '/admin/login');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForTimeout(3000);
  console.log('  url after login:', page.url());

  // Step 3: Inspect the admin page content
  console.log('=== Step 3: Inspect admin page ===');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000); // Wait for client-side data fetches
  const html = await page.content();
  console.log('  html length:', html.length);
  console.log('  has admin-layout:', /admin-layout/.test(html));
  console.log('  has admin-content:', /admin-content/.test(html));
  console.log('  has Không gian quản trị:', /Không gian quản trị/.test(html));
  console.log('  has Tổng quan:', /Tổng quan/.test(html));
  console.log('  has Đặt phòng:', /Đặt phòng/.test(html));
  console.log('  has Logout:', /(Đăng xuất|Sign out)/.test(html));

  // Step 4: Refresh /admin
  console.log('=== Step 4: Refresh /admin ===');
  await page.goto(BASE + '/admin');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  console.log('  url:', page.url());
  const refreshHtml = await page.content();
  console.log('  has Không gian quản trị:', /Không gian quản trị/.test(refreshHtml));

  // Step 5: Visit /admin/login while authenticated — should redirect to /admin
  console.log('=== Step 5: Visit /admin/login while auth ===');
  await page.goto(BASE + '/admin/login');
  await page.waitForTimeout(1500);
  console.log('  url:', page.url());

  // Step 6: Logout
  console.log('=== Step 6: Logout ===');
  // First navigate to /admin to see logout button
  await page.goto(BASE + '/admin');
  await page.waitForTimeout(1500);
  const logoutBtn = page
    .locator('button:has-text("Đăng xuất"), button:has-text("Sign out")')
    .first();
  if ((await logoutBtn.count()) > 0) {
    await logoutBtn.click();
    await page.waitForTimeout(2000);
    console.log('  logout clicked');
  } else {
    console.log('  NO LOGOUT BUTTON');
  }

  // Step 7: After logout, GET /admin should redirect to /admin/login
  console.log('=== Step 7: After logout, GET /admin ===');
  await page.goto(BASE + '/admin');
  await page.waitForTimeout(1500);
  console.log('  url:', page.url());

  // Step 8: Wrong password
  console.log('=== Step 8: Wrong password ===');
  await page.goto(BASE + '/admin/login');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', 'Aa1-WrongPassword-JustForTest');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2000);
  console.log('  url:', page.url());
  const errorCount = await page.locator('.admin-login-error').count();
  console.log('  error count:', errorCount);
  const errorText = await page
    .locator('.admin-login-error')
    .first()
    .innerText()
    .catch(() => '');
  console.log('  error text:', errorText.replace(/\n+/g, ' | ').slice(0, 200));
});
