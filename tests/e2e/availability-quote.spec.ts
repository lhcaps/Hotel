import { expect, test } from '@playwright/test';
import { fillHourlySearch } from './public-search-helpers';

test('anonymous visitor searches availability and receives a non-reserving quote', async ({
  page,
}) => {
  await page.goto('/booking/search');
  await fillHourlySearch(page, {
    date: '2027-01-10',
    start: '11:00:00',
    end: '14:00:00',
  });
  await expect(page.getByRole('heading', { name: 'Nami' })).toBeVisible();
  const namiCard = page.getByTestId('availability-room-10000000-0000-4000-8000-000000000201');
  await expect(namiCard.getByRole('link', { name: 'Xem phòng & giá' })).toBeVisible();
  await expect(page.getByText(/101|room id/i)).toHaveCount(0);
  await namiCard.getByRole('link', { name: 'Xem phòng & giá' }).click();
  await expect(page.getByRole('heading', { name: 'Nami' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem giá chính thức' }).click();
  await expect(page).toHaveURL(/\/booking\/quote\//);
  await expect(page.getByRole('heading', { name: 'Thanh toán & đặt phòng' })).toBeVisible();
});
