import { expect, test, type Page } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

const routes = [
  '/admin',
  '/admin/profile',
  '/admin/bookings',
  '/admin/bookings/PW-UAT-CONFIRMED-20270711',
  '/admin/scanner',
  '/admin/room-operations',
  '/admin/housekeeping',
  '/admin/rooms',
  '/admin/rooms/new',
  '/admin/rooms/10000000-0000-4000-8000-000000000301',
  '/admin/maintenance',
  '/admin/payments',
  '/admin/payments/__from-list__',
  '/admin/operational-reviews',
  '/admin/room-types',
  '/admin/amenities',
  '/admin/property',
  '/admin/price-tiers',
  '/admin/rate-plans',
  '/admin/pricing-policies',
  '/admin/coupons',
  '/admin/coupons/new',
  '/admin/coupons/10000000-0000-4000-8000-000000000801',
  '/admin/payment-providers',
  '/admin/accounts',
  '/admin/customer-accounts',
  '/admin/departments',
  '/admin/audit',
] as const;

const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
] as const;

const primaryScreenshots = [
  ['/admin', 'dashboard', 1920, 1080],
  ['/admin/room-operations', 'room-operations', 1920, 1080],
  ['/admin/rooms', 'rooms', 1440, 900],
  ['/admin/housekeeping', 'housekeeping', 1440, 900],
  ['/admin/bookings', 'bookings', 1440, 900],
  ['/admin/pricing-policies', 'pricing-policies', 1440, 900],
  ['/admin/accounts', 'accounts', 1440, 900],
] as const;

async function login(page: Page) {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function waitForRouteData(page: Page) {
  await expect
    .poll(
      async () =>
        page
          .locator('.admin-page')
          .first()
          .evaluate((pageElement) => {
            return !pageElement.textContent?.includes('Đang tải');
          }),
      { timeout: 15_000 },
    )
    .toBe(true);
}

test('ADMIN V3 renders all accessible protected routes without errors or page overflow', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  let authenticated = false;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    const location = message.location();
    if (authenticated && message.type() === 'error') {
      consoleErrors.push(`${message.text()} @ ${location.url || '<inline>'}`);
    }
  });

  await login(page);
  authenticated = true;
  await page.goto('/admin/payments', { waitUntil: 'domcontentloaded' });
  const paymentDetailRoute = await page
    .locator('a[href^="/admin/payments/"]')
    .first()
    .getAttribute('href');
  expect(paymentDetailRoute).toBeTruthy();
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      const actualRoute = route === '/admin/payments/__from-list__' ? paymentDetailRoute! : route;
      await page.goto(actualRoute, { waitUntil: 'domcontentloaded' });
      await expect(
        page.locator('.admin-page').first(),
        `${actualRoute} failed to render`,
      ).toBeVisible();
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${actualRoute} overflows at ${viewport.name}`).toBeLessThanOrEqual(
        viewport.width,
      );
    }
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('ADMIN V3 core interactions work through the shared UI system', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/admin/accounts', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Tài khoản khách hàng' }).click();
  await expect(page.getByRole('tab', { name: 'Tài khoản khách hàng' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('[data-slot="tabs-content"] table')).toBeVisible();

  await page.goto('/admin/room-operations', { waitUntil: 'domcontentloaded' });
  const occupiedTab = page.getByRole('tab', { name: 'Đang có khách' });
  await occupiedTab.focus();
  await page.keyboard.press('Enter');
  await expect(occupiedTab).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Tất cả' }).click();
  await page.getByLabel('Tìm phòng').fill('101');
  await expect(page.locator('tbody tr')).toHaveCount(1);

  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('ADMIN V3 captures the human-review screens at their required desktop viewports', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  let authenticated = false;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (authenticated && message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await login(page);
  authenticated = true;
  for (const [route, name, width, height] of primaryScreenshots) {
    await page.setViewportSize({ width, height });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.admin-page').first()).toBeVisible();
    await waitForRouteData(page);
    await page.screenshot({
      caret: 'initial',
      path: `output/playwright/admin-v3/primary/${name}-${width}.png`,
      fullPage: true,
    });
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
