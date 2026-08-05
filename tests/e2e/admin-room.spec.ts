import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates a physical room', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/rooms/new');
  await page.getByLabel('Số phòng').fill('102');
  await page.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(page.getByText('Đã tạo phòng 102.')).toBeVisible();
  await page.goto('/admin/rooms');
  await expect(page.getByRole('cell', { name: '102', exact: true })).toBeVisible();
});
