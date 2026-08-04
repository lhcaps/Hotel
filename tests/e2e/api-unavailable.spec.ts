import { expect, test } from '@playwright/test';
import { fillHourlySearch } from './public-search-helpers';

test('public search shows a safe unavailable-state without exposing configuration', async ({
  page,
}) => {
  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await fillHourlySearch(page, {
    date: '2027-01-10',
    start: '11:00:00',
    end: '14:00:00',
  });

  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('3199');
  await expect(page.locator('body')).not.toContainText('DATABASE_URL');
});
