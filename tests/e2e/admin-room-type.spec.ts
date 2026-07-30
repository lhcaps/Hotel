import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates a room type', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/amenities');
  await page.getByLabel('Mã tiện nghi').fill('wifi-suite');
  await page.locator('#amenity-name').fill('Wi-Fi Suite');
  await page.getByRole('button', { name: 'Thêm tiện nghi' }).click();
  await expect(page.getByText('WIFI-SUITE', { exact: true })).toBeVisible();
  await page.goto('/admin/room-types');
  await page.getByLabel('Mã loại phòng').fill('suite');
  await page.locator('#room-type-name').fill('Suite');
  await page.getByRole('button', { name: 'Thêm loại phòng' }).click();
  const suiteRow = page.getByTestId('room-type-row-SUITE');
  await expect(suiteRow).toBeVisible();
  await expect(suiteRow.locator('input[id^="edit-name-"]')).toHaveValue('Suite');
  await page.locator('#room-type-assign-amenity').selectOption({ label: 'Wi-Fi Suite' });
  await page.getByRole('button', { name: 'Gán tiện nghi' }).click();
  await expect(page.getByText('Đã gán tiện nghi cho loại phòng.')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu trữ Suite' }).click();
  await expect(page.getByRole('cell', { name: 'INACTIVE', exact: true })).toBeVisible();
});
