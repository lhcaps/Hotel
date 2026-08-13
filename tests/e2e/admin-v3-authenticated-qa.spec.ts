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
  '/admin/operational-reviews/10000000-0000-4000-8000-000000000741',
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
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'tablet-1024', width: 1024, height: 768 },
] as const;

const narrowSafetyViewports = [
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
] as const;

const narrowSafetyRoutes = [
  '/admin',
  '/admin/rooms',
  '/admin/property',
  '/admin/price-tiers',
  '/admin/pricing-policies',
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

const closureScreenshots = [
  ['/admin', 'dashboard'],
  ['/admin/profile', 'profile'],
  ['/admin/bookings', 'bookings'],
  ['/admin/bookings/PW-UAT-CONFIRMED-20270711', 'booking-detail'],
  ['/admin/scanner', 'scanner'],
  ['/admin/room-operations', 'room-operations'],
  ['/admin/housekeeping', 'housekeeping'],
  ['/admin/rooms', 'rooms'],
  ['/admin/rooms/new', 'room-create'],
  ['/admin/rooms/10000000-0000-4000-8000-000000000301', 'room-detail'],
  ['/admin/maintenance', 'maintenance'],
  ['/admin/payments', 'payments'],
  ['/admin/payments/__from-list__', 'payment-detail'],
  ['/admin/operational-reviews', 'operational-reviews'],
  ['/admin/operational-reviews/10000000-0000-4000-8000-000000000741', 'operational-review-detail'],
  ['/admin/room-types', 'room-types'],
  ['/admin/amenities', 'amenities'],
  ['/admin/property', 'property'],
  ['/admin/price-tiers', 'price-tiers'],
  ['/admin/rate-plans', 'rate-plans'],
  ['/admin/pricing-policies', 'pricing-policies'],
  ['/admin/coupons', 'coupons'],
  ['/admin/coupons/new', 'coupon-create'],
  ['/admin/coupons/10000000-0000-4000-8000-000000000801', 'coupon-detail'],
  ['/admin/payment-providers', 'payment-providers'],
  ['/admin/accounts', 'accounts'],
  ['/admin/customer-accounts', 'customer-accounts'],
  ['/admin/departments', 'departments'],
  ['/admin/audit', 'audit'],
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

for (const viewport of viewports) {
  test(`ADMIN V3 renders all accessible protected routes without errors or page overflow at ${viewport.name}`, async ({
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
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      let actualRoute: string = route;
      if (route === '/admin/payments/__from-list__') {
        await page.goto('/admin/payments', { waitUntil: 'domcontentloaded' });
        const paymentDetailRoute = await page
          .locator('a[href^="/admin/payments/"]')
          .first()
          .getAttribute('href');
        expect(paymentDetailRoute).toBeTruthy();
        if (!paymentDetailRoute) {
          throw new Error('Expected a payment detail route from the payments list');
        }
        actualRoute = paymentDetailRoute;
      }
      await page.goto(actualRoute, { waitUntil: 'domcontentloaded' });
      await expect(
        page.locator('.admin-page').first(),
        `${actualRoute} failed to render`,
      ).toBeVisible();
      await waitForRouteData(page);
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${actualRoute} overflows at ${viewport.name}`).toBeLessThanOrEqual(
        viewport.width,
      );
    }
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
}

test('ADMIN V3 keeps core workflows reachable at narrow safety viewports', async ({ page }) => {
  await login(page);

  for (const viewport of narrowSafetyViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(page.locator('[data-slot="sidebar-trigger"]')).toBeVisible();

    for (const route of narrowSafetyRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.admin-page').first(), `${route} failed to render`).toBeVisible();
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${route} overflows at ${viewport.name}`).toBeLessThanOrEqual(
        viewport.width,
      );
    }
  }
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

test('ADMIN V3 keeps the selected tab indicator inside its tab list', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/accounts', { waitUntil: 'domcontentloaded' });

  const tabSystem = page.locator('.admin-tabs-system').first();
  const tabList = tabSystem.locator('[data-slot="tabs-list"]');
  const indicator = tabSystem.locator('.admin-tabs-system__indicator');
  await expect(tabSystem).toHaveAttribute('data-indicator-ready', 'true');
  await expect(tabList).toBeVisible();
  await expect(indicator).toBeVisible();

  const [tabListBox, indicatorBox] = await Promise.all([
    tabList.boundingBox(),
    indicator.boundingBox(),
  ]);
  expect(tabListBox).not.toBeNull();
  expect(indicatorBox).not.toBeNull();
  expect(indicatorBox!.y).toBeGreaterThanOrEqual(tabListBox!.y - 2);
  expect(indicatorBox!.y + indicatorBox!.height).toBeLessThanOrEqual(
    tabListBox!.y + tabListBox!.height + 2,
  );
});

test('ADMIN V3 routes price tier archival through secondary actions and an explicit confirmation', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/price-tiers', { waitUntil: 'domcontentloaded' });

  const row = page.locator('tbody tr').filter({ hasText: 'Đang hoạt động' }).first();
  await expect(row).toBeVisible();
  await row.locator('[data-slot="dropdown-menu-trigger"]').click();
  const archiveAction = page.getByRole('menuitem', { name: 'Lưu trữ' });
  await expect(archiveAction).toBeEnabled();
  await archiveAction.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('ADMIN V3 rejects an invalid property stay range before saving', async ({ page }) => {
  await login(page);
  await page.goto('/admin/property', { waitUntil: 'domcontentloaded' });

  await page.locator('#property-min-stay').fill('120');
  await page.locator('#property-max-stay').fill('60');
  await page.locator('form').getByRole('button').click();

  await expect(page.locator('[data-slot="field-error"]')).toBeVisible();
  await expect(page.locator('#property-min-stay')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#property-max-stay')).toHaveAttribute('aria-invalid', 'true');
});

test('ADMIN V3 closes the pricing-policy setup sheet before opening a new draft editor', async ({
  page,
}) => {
  await login(page);
  await page.goto('/admin/pricing-policies', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'Tạo draft', exact: true }).click();
  const createSheet = page.getByRole('dialog');
  await expect(createSheet).toBeVisible();
  await createSheet.locator('#pricing-policy-create-name').fill(`QA draft ${Date.now()}`);
  await createSheet.locator('#pricing-policy-create-from').fill('2027-02-10T00:00');
  await createSheet.getByRole('button', { name: 'Tạo draft' }).click();

  await expect(page.getByRole('heading', { name: 'Chỉnh sửa chính sách' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('ADMIN V3 compacts an empty daily-revenue panel instead of reserving chart height', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });

  const revenuePanel = page.locator('.overview-revenue-chart');
  await expect(revenuePanel).toBeVisible();
  await expect(revenuePanel).toContainText('Không có đặt phòng nào khớp với khoảng thời gian này.');
  const box = await revenuePanel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThan(220);
});

test('ADMIN V3 opens operational-review actions from the shared row menu', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/operational-reviews', { waitUntil: 'domcontentloaded' });

  const row = page.locator('tbody tr').filter({ hasText: 'PW-UAT-CANCELLED-20270713' });
  await expect(row).toBeVisible();
  await row.locator('[data-slot="dropdown-menu-trigger"]').click();
  await expect(page.locator('[data-slot="dropdown-menu-content"]')).toBeVisible();
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

test('ADMIN V3 captures every protected route contract at the closure viewport', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  let authenticated = false;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (authenticated && message.type() === 'error') {
      const location = message.location();
      consoleErrors.push(`${message.text()} @ ${location.url || '<inline>'}`);
    }
  });

  await login(page);
  authenticated = true;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/payments', { waitUntil: 'domcontentloaded' });
  const paymentDetailRoute = await page
    .locator('a[href^="/admin/payments/"]')
    .first()
    .getAttribute('href');
  expect(paymentDetailRoute).toBeTruthy();
  for (const [route, name] of closureScreenshots) {
    const actualRoute = route === '/admin/payments/__from-list__' ? paymentDetailRoute! : route;
    await page.goto(actualRoute, { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('.admin-page').first(),
      `${actualRoute} failed to render`,
    ).toBeVisible();
    await waitForRouteData(page);
    await page.screenshot({
      caret: 'initial',
      path: `output/playwright/admin-v3/routes/${name}-1440.png`,
      fullPage: true,
    });
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
