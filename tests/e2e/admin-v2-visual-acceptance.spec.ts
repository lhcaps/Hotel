import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-small-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-wide-1920', width: 1920, height: 1080 },
] as const;

const routes = [
  ['/admin', 'overview'],
  ['/admin/profile', 'profile'],
  ['/admin/bookings', 'bookings'],
  ['/admin/bookings/PW-UAT-CONFIRMED-20270711', 'booking-detail'],
  ['/admin/scanner', 'scanner'],
  ['/admin/room-operations', 'room-operations'],
  ['/admin/rooms', 'rooms'],
  ['/admin/rooms/new', 'room-new'],
  ['/admin/rooms/10000000-0000-4000-8000-000000000301', 'room-detail'],
  ['/admin/maintenance', 'maintenance'],
  ['/admin/payments', 'payments'],
  ['/admin/payments/__from-list__', 'payment-detail'],
  ['/admin/operational-reviews', 'operational-reviews'],
  ['/admin/room-types', 'room-types'],
  ['/admin/amenities', 'amenities'],
  ['/admin/property', 'property'],
  ['/admin/price-tiers', 'price-tiers'],
  ['/admin/rate-plans', 'rate-plans'],
  ['/admin/coupons', 'coupons'],
  ['/admin/coupons/new', 'coupon-new'],
  ['/admin/coupons/10000000-0000-4000-8000-000000000801', 'coupon-detail'],
  ['/admin/payment-providers', 'payment-providers'],
  ['/admin/accounts', 'accounts'],
  ['/admin/customer-accounts', 'customer-accounts'],
  ['/admin/departments', 'departments'],
  ['/admin/audit', 'audit'],
] as const;

const capturePass = process.env.ADMIN_V2_CAPTURE_PASS ?? 'initial';

test('ADMIN V2 captures every required route at the acceptance widths', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/payments');
  await page.waitForLoadState('networkidle');
  const paymentDetailRoute = await page
    .locator('a[href^="/admin/payments/"]')
    .first()
    .getAttribute('href');
  expect(paymentDetailRoute, 'payments list did not expose a detail route').toBeTruthy();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const [route, name] of routes) {
      const actualRoute = route === '/admin/payments/__from-list__' ? paymentDetailRoute! : route;
      await page.goto(actualRoute);
      await page.waitForTimeout(150);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(100);
      await expect(
        page.locator('.admin-page').first(),
        `${actualRoute} did not render`,
      ).toBeVisible();

      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(
        documentWidth,
        `${actualRoute} overflows at ${viewport.name}: ${documentWidth}px`,
      ).toBeLessThanOrEqual(viewport.width);

      await page.screenshot({
        path: `output/playwright/admin-v2/acceptance/${capturePass}/${viewport.name}/${name}.png`,
        fullPage: true,
      });
    }
  }
});
