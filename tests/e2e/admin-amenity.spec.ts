import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates an amenity and sees it after reload', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/amenities');
  await page.getByRole('button', { name: 'Thêm tiện nghi' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#amenity-code').fill('parking');
  await dialog.locator('#amenity-name').fill('Parking');
  await dialog.getByRole('button', { name: 'Thêm tiện nghi' }).click();
  await expect(page.getByText('PARKING', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('PARKING', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu trữ Parking' }).click();
  await expect(page.getByRole('cell', { name: 'Tạm ngưng', exact: true })).toBeVisible();
});
