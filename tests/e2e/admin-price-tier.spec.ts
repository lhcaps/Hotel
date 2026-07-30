import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates a price tier and sees it after reload', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/price-tiers');
  await page.getByLabel('Mã hạng giá').fill('premium');
  await page.getByLabel('Tên hạng giá').fill('Premium');
  await page.getByLabel('Thứ tự').fill('1');
  await page.getByRole('button', { name: 'Thêm hạng giá' }).click();
  await expect(page.getByRole('cell', { name: 'Premium', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Premium', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu trữ Premium' }).click();
  await expect(page.getByRole('cell', { name: 'INACTIVE', exact: true })).toBeVisible();
});
