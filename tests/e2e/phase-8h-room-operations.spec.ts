import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN reads and refreshes the server-backed room operations board', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/rooms');
  await expect(page.getByRole('heading', { name: 'Room operations board' })).toBeVisible();
  await expect(page.locator('.room-board-list > li').first()).toBeVisible();
  await page.getByRole('button', { name: 'Refresh board' }).click();
  await expect(page.locator('.room-board-list > li').first()).toBeVisible();
});
