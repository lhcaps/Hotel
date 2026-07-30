import { expect, test } from '@playwright/test';

test('anonymous visitor searches availability and receives a non-reserving quote', async ({
  page,
}) => {
  await page.goto('/booking/search');
  await page.getByLabel('Nhận phòng').fill('2027-01-10T11:00');
  await page.getByLabel('Trả phòng').fill('2027-01-10T14:00');
  await page.getByLabel('Người lớn').fill('2');
  await page.getByRole('button', { name: 'Tìm phòng' }).click();
  await expect(page.getByRole('heading', { name: 'Deluxe' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem phòng & giá' })).toBeVisible();
  await expect(page.getByText(/101|room id/i)).toHaveCount(0);
  await page.getByRole('link', { name: 'Xem phòng & giá' }).click();
  await expect(page.getByRole('heading', { name: 'Deluxe' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem giá chính thức' }).click();
  await expect(page).toHaveURL(/\/booking\/quote\//);
  await expect(page.getByRole('heading', { name: 'Hoàn tất giữ chỗ' })).toBeVisible();
});
