import { expect, test } from '@playwright/test';

test('public search shows a safe unavailable-state without exposing configuration', async ({
  page,
}) => {
  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole('heading', { name: 'Trải nghiệm lưu trú tiện nghi, linh hoạt' }),
  ).toBeVisible();
  await page.getByLabel('Nhận phòng').fill('2027-01-10T11:00');
  await page.getByLabel('Trả phòng').fill('2027-01-10T14:00');
  await page.getByRole('button', { name: 'Tìm phòng' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Không tải được tình trạng phòng' }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText('3199');
  await expect(page.locator('body')).not.toContainText('DATABASE_URL');
});
