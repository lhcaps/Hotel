import { expect, test } from '@playwright/test';

test('public catalog renders persisted room types without physical-room operations data', async ({
  page,
}) => {
  await page.goto('/rooms');

  await expect(page.getByRole('heading', { name: 'Deluxe' })).toBeVisible();
  await expect(page.getByText('Wi-Fi').first()).toBeVisible();
  await expect(page.getByText(/101|room id|housekeeping|maintenance/i)).toHaveCount(0);
  await page.screenshot({
    path: 'output/playwright/phase-8i/14-public-room-catalog.png',
    fullPage: true,
  });

  await page
    .locator('article', { has: page.getByRole('heading', { name: 'Deluxe' }) })
    .getByRole('link', { name: 'Chi tiết hạng phòng' })
    .click();
  await expect(page.getByRole('heading', { name: 'Deluxe' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tiện nghi' })).toBeVisible();
});
