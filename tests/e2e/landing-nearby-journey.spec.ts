import { expect, test, type Page } from '@playwright/test';

async function goToLanding(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Trải nghiệm lưu trú tiện nghi, linh hoạt' }),
  ).toBeVisible();
}

test('Landing exact availability renders DB-backed room cards without navigating away', async ({
  page,
}) => {
  await goToLanding(page);
  await page.getByLabel('Nhận phòng').fill('2027-05-01T11:00');
  await page.getByLabel('Trả phòng').fill('2027-05-01T14:00');
  await page.getByLabel('Người lớn').fill('2');
  await page.getByRole('button', { name: 'Tìm phòng' }).click();
  await expect(page.getByLabel('Hạng phòng còn trống').first()).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('Landing exact-empty triggers exactly one nearby HTTP request', async ({ page }) => {
  const nearbyRequests: string[] = [];
  await page.route('**/api/v1/public/availability/nearby', (route) => {
    nearbyRequests.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        requestedCheckIn: '2030-12-31T11:00:00.000Z',
        requestedCheckOut: '2030-12-31T14:00:00.000Z',
        durationMinutes: 180,
        candidates: [],
      }),
    });
  });
  await page.route('**/api/v1/availability/search', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
      }),
    });
  });
  await goToLanding(page);
  await page.getByLabel('Nhận phòng').fill('2030-12-31T11:00');
  await page.getByLabel('Trả phòng').fill('2030-12-31T14:00');
  await page.getByLabel('Người lớn').fill('2');
  await page.getByRole('button', { name: 'Tìm phòng' }).click();
  await expect(page.getByText('Không còn phòng đúng thời gian bạn chọn')).toBeVisible();
  await page.waitForTimeout(800);
  expect(nearbyRequests.length).toBe(1);
});
