import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN can read persisted catalog tables after signing in', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const roomsApi = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:3101/api/v1/admin/rooms', {
      credentials: 'include',
    });
    return { status: response.status, body: await response.text() };
  });
  expect(roomsApi.status, roomsApi.body).toBe(200);

  await page.goto('/admin/rooms');
  await expect(page.locator('table').first()).toBeVisible();
  await page.goto('/admin/room-types');
  await expect(page.locator('table').first()).toBeVisible();
  await page.goto('/admin/amenities');
  await expect(page.locator('table').first()).toBeVisible();
  await page.goto('/admin/price-tiers');
  await expect(page.locator('table').first()).toBeVisible();
});
