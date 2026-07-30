import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN updates the current property and sees the persisted value after reload', async ({
  page,
}) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/property');
  await expect(page.getByLabel('Mã cơ sở')).toHaveValue('PLAYWRIGHT');
  await page.getByLabel('Tên cơ sở').fill('Playwright Hotel Updated');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Tên cơ sở')).toHaveValue('Playwright Hotel Updated');
});
