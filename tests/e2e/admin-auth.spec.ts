import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('bootstrap-created ADMIN signs in and receives a server session', async ({ page }) => {
  await page.goto('/admin/login');
  // Public chrome must not appear on the administrator sign-in page.
  await expect(page.locator('header.public-header')).toHaveCount(0);
  // Protected shell must not render before authentication.
  await expect(page.locator('aside.admin-nav, [class*="admin-sidebar"]')).toHaveCount(0);
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const result = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:3101/api/v1/admin/me', {
      credentials: 'include',
    });
    return { status: response.status, body: await response.text() };
  });
  expect(result.status, result.body).toBe(200);

  await page.getByRole('button', { name: 'Mở hồ sơ quản trị' }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  const afterLogout = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:3101/api/v1/admin/me', {
      credentials: 'include',
    });
    return response.status;
  });
  expect(afterLogout).toBe(401);
});
