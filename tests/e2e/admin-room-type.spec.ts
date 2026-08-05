import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates a room type', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/amenities');
  await page.getByRole('button', { name: 'Thêm tiện nghi' }).click();
  const amenityDialog = page.getByRole('dialog');
  await amenityDialog.locator('#amenity-code').fill('wifi-suite');
  await amenityDialog.locator('#amenity-name').fill('Wi-Fi Suite');
  await amenityDialog.getByRole('button', { name: 'Thêm tiện nghi' }).click();
  await expect(page.getByText('WIFI-SUITE', { exact: true })).toBeVisible();
  await page.goto('/admin/room-types');
  await page.getByRole('button', { name: 'Thêm loại phòng' }).click();
  const createDialog = page.getByRole('dialog');
  await createDialog.locator('#room-type-code').fill('suite');
  await createDialog.locator('#room-type-name').fill('Suite');
  await createDialog.getByRole('button', { name: 'Thêm loại phòng' }).click();
  const suiteRow = page.getByTestId('room-type-row-SUITE');
  await expect(suiteRow).toBeVisible();
  await suiteRow.getByRole('button', { name: 'Lưu thay đổi' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.locator('#room-type-edit-name')).toHaveValue('Suite');
  await editDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  const amenitySelect = page.locator('#room-type-assign-amenity');
  await amenitySelect.click();
  await page.getByRole('option', { name: 'Wi-Fi Suite' }).click();
  await page.getByRole('button', { name: 'Gán tiện nghi' }).click();
  await expect(page.getByText('Đã gán tiện nghi cho loại phòng.')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu trữ Suite' }).click();
  await expect(suiteRow.getByRole('cell', { name: 'Đang hoạt động', exact: true })).toBeVisible();
});
