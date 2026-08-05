import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.locator('input[type="password"]').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('ADMIN enables only non-secret MoMo and VNPAY operational settings', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/payment-providers');
  await expect(page.getByRole('heading', { name: 'Nhà cung cấp thanh toán' })).toBeVisible();
  await expect(
    page.getByText(/Bí mật kết nối chỉ được quản lý bằng cấu hình máy chủ/),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText('playwright-vnpay-secret');

  for (const [index, provider] of ['MOMO', 'VNPAY'].entries()) {
    const form = page.locator('form').nth(index);
    await expect(page.getByText(/Đã cấu hình/).nth(index)).toBeVisible();
    await form.getByRole('checkbox').check();
    await Promise.all([
      page.waitForResponse(new RegExp(`/api/v1/admin/payment-providers/${provider}$`)),
      form.getByRole('button', { name: 'Lưu cấu hình' }).click(),
    ]);
  }

  const publicProviders = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:3101/api/v1/public/payment-providers');
    return response.json();
  });
  expect(publicProviders).toEqual([
    expect.objectContaining({ provider: 'MOMO', displayName: 'MoMo' }),
    expect.objectContaining({ provider: 'VNPAY', displayName: 'VNPAY' }),
  ]);
});
