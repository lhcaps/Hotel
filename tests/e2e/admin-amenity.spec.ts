import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates an amenity and sees it after reload', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/amenities');
  await page.getByLabel('Mã tiện nghi').fill('parking');
  await page.locator('#amenity-name').fill('Parking');
  await page.getByRole('button', { name: 'Thêm tiện nghi' }).click();
  await expect(page.locator('#amenity-name')).toHaveValue('');
  await expect(page.getByText('PARKING', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('PARKING', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu trữ Parking' }).click();
  await expect(page.getByRole('cell', { name: 'Tạm ngưng', exact: true })).toBeVisible();
});
