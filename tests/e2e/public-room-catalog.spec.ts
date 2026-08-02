import { expect, test } from '@playwright/test';

test('public catalog renders approved physical rooms without operations data', async ({ page }) => {
  await page.goto('/rooms');

  // This focused fixture exposes the Deluxe tier only. The physical-room
  // presentation must therefore show the approved Deluxe rooms, while the
  // nine-room mapping itself is covered by the content unit contract.
  await expect(page.getByRole('heading', { name: 'Nami' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sudal' })).toBeVisible();
  await expect(page.getByText('Wi-Fi').first()).toBeVisible();
  await expect(page.getByText(/101|room id|housekeeping|maintenance/i)).toHaveCount(0);
  await page.screenshot({
    path: 'output/playwright/phase-8i/14-public-room-catalog.png',
    fullPage: true,
  });

  await page
    .locator('article', { has: page.getByRole('heading', { name: 'Nami' }) })
    .getByRole('link', { name: 'Chi tiết hạng phòng' })
    .click();
  await expect(page.getByRole('heading', { name: 'Nami' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tiện nghi' })).toBeVisible();
});
