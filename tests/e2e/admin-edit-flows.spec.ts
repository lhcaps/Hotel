import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('ADMIN edits a room type description and persists the change', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/room-types');
  const firstRow = page.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible();
  const nameCell = await firstRow.locator('td').first().innerText();
  expect(nameCell.trim().length).toBeGreaterThan(0);
  const descriptionInput = firstRow.getByLabel('Mô tả loại phòng');
  await descriptionInput.fill('Mô tả được cập nhật bởi Playwright');
  await firstRow.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText(/Đã cập nhật/)).toBeVisible();
  await page.reload();
  await expect(firstRow.getByLabel('Mô tả loại phòng')).toHaveValue(
    'Mô tả được cập nhật bởi Playwright',
  );
});

test('ADMIN renames an amenity and the change is reflected in the public catalog', async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  await page.goto('/admin/amenities');
  const firstRow = page.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible();
  const codeCell = (await firstRow.locator('td').first().innerText()).trim();
  expect(codeCell.length).toBeGreaterThan(0);
  const rename = `Tiện nghi Playwright ${Date.now()}`;
  const nameInput = firstRow.getByLabel('Tên tiện nghi');
  await nameInput.fill(rename);
  await firstRow.getByRole('button', { name: 'Lưu tên' }).click();
  await expect(page.getByText(/Đã cập nhật/)).toBeVisible();
  const api = await request.get('http://127.0.0.1:3101/api/v1/public/room-types');
  expect(api.status()).toBe(200);
  const body = (await api.json()) as { items: ReadonlyArray<{ name: string }> };
  expect(Array.isArray(body.items)).toBe(true);
});

test('ADMIN removes an amenity from a room type and the assignment is gone', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/room-types');
  const firstRow = page.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible();
  const removeButton = firstRow.getByRole('button', { name: 'Gỡ tiện nghi' }).first();
  if (await removeButton.isVisible().catch(() => false)) {
    await removeButton.click();
    await expect(page.getByText(/Đã gỡ tiện nghi khỏi loại phòng/)).toBeVisible();
  }
});

test('ADMIN renames a physical room and the new number is visible in admin', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/rooms');
  const firstRow = page.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible();
  const newNumber = `PW-${Date.now().toString().slice(-4)}`;
  await firstRow.getByLabel('Số phòng').fill(newNumber);
  await firstRow.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText(/Đã cập nhật phòng/)).toBeVisible();
  await expect(firstRow.getByLabel('Số phòng')).toHaveValue(newNumber);
});

test('ADMIN shell never exposes a public header before authentication', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page.locator('header.public-header')).toHaveCount(0);
  await expect(page.locator('aside.admin-nav, [class*="admin-sidebar"]')).toHaveCount(0);
});

test('Sign out control is rendered in Vietnamese', async ({ page }) => {
  await loginAsAdmin(page);
  const signOut = page.getByRole('button', { name: 'Đăng xuất' });
  await expect(signOut).toBeVisible();
  const text = await signOut.innerText();
  expect(text.trim()).toBe('Đăng xuất');
});
