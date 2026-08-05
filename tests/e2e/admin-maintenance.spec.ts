import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates a maintenance block', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/maintenance');
  await page.getByRole('button', { name: 'Tạo bảo trì' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Lý do').fill('Repair');
  await dialog.getByLabel('Bắt đầu').fill('2027-02-01T10:00');
  await dialog.getByLabel('Kết thúc').fill('2027-02-01T12:00');
  await dialog.getByRole('button', { name: 'Tạo bảo trì' }).click();
  await expect(page.getByText('Đã tạo bảo trì: Repair.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Repair', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hủy bảo trì' }).click();
  await expect(page.getByText('Đã hủy bảo trì.', { exact: true })).toBeVisible();
});
