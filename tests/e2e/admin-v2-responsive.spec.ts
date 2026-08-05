import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop-small', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
] as const;

const stableAdminRoutes = [
  '/admin',
  '/admin/bookings',
  '/admin/scanner',
  '/admin/payments',
  '/admin/operational-reviews',
  '/admin/room-operations',
  '/admin/rooms',
  '/admin/maintenance',
  '/admin/room-types',
  '/admin/amenities',
  '/admin/property',
  '/admin/price-tiers',
  '/admin/rate-plans',
  '/admin/coupons',
  '/admin/payment-providers',
  '/admin/accounts',
  '/admin/customer-accounts',
  '/admin/departments',
  '/admin/audit',
  '/admin/profile',
] as const;

test('ADMIN V2 Vietnamese shell and operational routes remain responsive', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/admin/room-operations');
    await page.waitForTimeout(150);
    await expect(page.locator('main.admin-page h1', { hasText: 'Tình trạng phòng' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Làm mới bảng' })).toBeVisible();
    await expect(
      page.getByText('Bạn đang ở chế độ chỉ đọc theo dõi tình trạng phòng.'),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: `output/playwright/admin-v2/${viewport.name}-room-operations.png`,
      fullPage: true,
    });

    for (const route of stableAdminRoutes) {
      await page.goto(route);
      await expect(page.locator('.admin-page').first()).toBeVisible();
      await expect(page.locator('.admin-page h1, .admin-page h2').first()).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      const routeDocumentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(routeDocumentWidth, `${route} overflows at ${viewport.name}`).toBeLessThanOrEqual(
        viewport.width,
      );
    }
  }

  for (const endpoint of ['accounts', 'customer-accounts', 'departments']) {
    const response = await page.request.get(`http://127.0.0.1:3101/api/v1/admin/${endpoint}`);
    expect(response.status(), `${endpoint} endpoint status`).toBe(200);
  }
});
