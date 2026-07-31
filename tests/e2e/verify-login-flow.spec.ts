import { test, expect } from '@playwright/test';

test('ADMIN login full flow against 127.0.0.1:3000', async ({ page, context }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[console:${m.type()}] ${m.text()}`));
  page.on('response', async (r) => {
    const url = r.url();
    if (url.includes('/api/auth/') || url.includes('/api/admin/me') || /\/admin(\b|\?)/.test(url)) {
      const setCookies: string[] = [];
      try {
        for (const [k, v] of Object.entries((await r.allHeaders()) ?? {}))
          if (k.toLowerCase() === 'set-cookie') setCookies.push(v);
      } catch {
        /* ignore */
      }
      logs.push(
        `[resp] ${r.status()} ${url} ${setCookies.length > 0 ? 'COOKIE: ' + setCookies.map((s) => s.split(';')[0]).join(',') : ''}`,
      );
    }
  });

  // --- 1. GET /admin/login ---
  console.log('--- STEP 1: GET /admin/login ---');
  await page.goto('http://127.0.0.1:3000/admin/login');
  await page.waitForLoadState('domcontentloaded');
  console.log('  url:', page.url());
  const loginHtml = await page.content();
  console.log('  has admin-login-card class:', /admin-login-card/.test(loginHtml));
  console.log('  has Đăng nhập:', /Đăng nhập quản trị/.test(loginHtml));

  // --- 2. Try wrong password ---
  console.log('--- STEP 2: Submit WRONG password ---');
  await page.fill('input[name=email]', 'demo-verify@room.local');
  await page.fill('input[name=password]', 'Aa1-WrongPassword-JustForTest');
  await page.click('button[type=submit]');
  await page.waitForTimeout(1500);
  console.log('  url:', page.url());
  const errorVisible = await page.locator('.admin-login-error').count();
  console.log('  error alert count:', errorVisible);
  // Count how many times the error text appears in DOM
  const errorText = await page
    .locator('.admin-login-error')
    .first()
    .innerText()
    .catch(() => '');
  console.log('  error text snippet:', errorText.slice(0, 200).replace(/\n+/g, ' | '));

  // --- 3. Try correct password ---
  console.log('--- STEP 3: Submit CORRECT password ---');
  await page.fill('input[name=email]', 'demo-verify@room.local');
  await page.fill('input[name=password]', 'Aa1-KnownVerifyPass-1234');
  await page.click('button[type=submit]');
  await page.waitForTimeout(3000);
  console.log('  url:', page.url());
  const cookies = await context.cookies();
  console.log(
    '  cookies:',
    cookies.map((c) => `${c.name}@${c.domain}${c.path} samesite=${c.sameSite}`).join(', '),
  );

  // --- 4. Check admin page rendered ---
  console.log('--- STEP 4: After login check admin page ---');
  const adminHtml = await page.content();
  console.log('  url:', page.url());
  console.log('  has admin-layout:', /admin-layout/.test(adminHtml));
  console.log('  has admin-content:', /admin-content/.test(adminHtml));

  // --- 5. Logout ---
  console.log('--- STEP 5: Click logout ---');
  const logoutBtn = page
    .locator('button:has-text("Đăng xuất"), button:has-text("Sign out")')
    .first();
  if ((await logoutBtn.count()) > 0) {
    await logoutBtn.click();
    await page.waitForTimeout(1500);
    console.log('  url after logout:', page.url());
  } else {
    console.log('  no logout button visible');
  }

  console.log('--- LOGS ---');
  for (const l of logs) console.log(l);
});
