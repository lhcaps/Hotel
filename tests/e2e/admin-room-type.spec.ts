import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN creates a room type', async ({ page }) => {
  const suffix = Date.now().toString(36);
  const amenityCode = `wifi-suite-${suffix}`;
  const amenityName = `Wi-Fi Suite ${suffix}`;
  const roomTypeCode = `suite-${suffix}`;
  const roomTypeName = `Suite ${suffix}`;

  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/amenities');
  await page.getByRole('button', { name: 'Thêm tiện nghi' }).click();
  const amenityDialog = page.getByRole('dialog');
  await amenityDialog.locator('#amenity-code').fill(amenityCode);
  await amenityDialog.locator('#amenity-name').fill(amenityName);
  await amenityDialog.getByRole('button', { name: 'Thêm tiện nghi' }).click();
  await expect(page.getByText(amenityCode.toUpperCase(), { exact: true })).toBeVisible();
  await page.goto('/admin/room-types');
  await page.getByRole('button', { name: 'Thêm loại phòng' }).click();
  const createDialog = page.getByRole('dialog');
  await createDialog.locator('#room-type-code').fill(roomTypeCode);
  await createDialog.locator('#room-type-name').fill(roomTypeName);
  await createDialog.getByRole('button', { name: 'Thêm loại phòng' }).click();
  const suiteRow = page.getByTestId(`room-type-row-${roomTypeCode.toUpperCase()}`);
  await expect(suiteRow).toBeVisible();
  await suiteRow.getByRole('button', { name: 'Lưu thay đổi' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.locator('#room-type-edit-name')).toHaveValue(roomTypeName);
  await editDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByRole('button', { name: 'Gán tiện nghi' }).first().click();
  const amenitySheet = page.getByRole('dialog');
  await amenitySheet.getByRole('combobox', { name: 'Tiện nghi' }).click();
  await page.getByRole('option', { name: amenityName }).click();
  await amenitySheet.getByRole('button', { name: 'Gán tiện nghi' }).click();
  await expect(page.getByText('Đã gán tiện nghi cho loại phòng.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(suiteRow).toContainText('Đang hoạt động');
  await suiteRow.getByRole('button', { name: /Lưu trữ/ }).click();
  const archiveMessage = page.locator('p[role="alert"]');
  await expect
    .poll(async () => (await archiveMessage.textContent())?.trim() ?? '')
    .toMatch(/Đã lưu trữ|gói giá đang hoạt động/);
  const archiveText = (await archiveMessage.textContent())?.trim() ?? '';
  if (archiveText.includes('Đã lưu trữ')) {
    await expect(suiteRow).toContainText('Ngừng hoạt động');
  } else {
    await expect(archiveMessage).toContainText('gói giá đang hoạt động');
    await expect(suiteRow).toContainText('Đang hoạt động');
  }
});
