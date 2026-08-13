import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates a price tier and sees it after reload', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/price-tiers');
  await page.getByRole('button', { name: 'Thêm hạng giá' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#price-tier-code').fill('premium');
  await dialog.locator('#price-tier-name').fill('Premium');
  await dialog.locator('#price-tier-sort').fill('1');
  await dialog.getByRole('button', { name: 'Thêm hạng giá' }).click();
  await expect(page.getByRole('cell', { name: 'Premium', exact: true })).toBeVisible();
  await page.reload();
  const premiumRow = page.locator('tbody tr', { hasText: 'Premium' });
  await expect(premiumRow).toBeVisible();
  await premiumRow.locator('[data-slot="dropdown-menu-trigger"]').click();
  await page.getByRole('menuitem', { name: 'Lưu trữ' }).click();
  const archiveDialog = page.getByRole('alertdialog');
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole('button', { name: 'Lưu trữ' }).click();
  await expect(premiumRow.getByRole('cell', { name: 'Tạm ngưng', exact: true })).toBeVisible();
});
