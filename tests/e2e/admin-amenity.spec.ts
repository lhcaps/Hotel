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
  const parkingRow = page.locator('tbody tr', { hasText: 'PARKING' });
  await expect(parkingRow).toBeVisible();
  await parkingRow.locator('[data-slot="dropdown-menu-trigger"]').click();
  await page.getByRole('menuitem', { name: 'Lưu trữ' }).click();
  const archiveDialog = page.getByRole('alertdialog');
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole('button', { name: 'Lưu trữ' }).click();
  await expect(parkingRow.getByRole('cell', { name: 'Tạm ngưng', exact: true })).toBeVisible();
});
