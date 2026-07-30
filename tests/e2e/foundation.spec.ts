import { expect, test } from '@playwright/test';

test('public booking entry and health endpoints are available', async ({ page, request }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Trải nghiệm lưu trú tiện nghi, linh hoạt' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tìm phòng' })).toBeVisible();
  await expect(page.getByText(/Phase 1|Nền tảng kỹ thuật|Kết nối API/i)).toHaveCount(0);

  const webHealth = await request.get('/health');
  const apiLive = await request.get('http://127.0.0.1:3101/api/v1/health/live');
  const apiReady = await request.get('http://127.0.0.1:3101/api/v1/health/ready', {
    headers: { 'x-correlation-id': 'playwright-smoke' },
  });

  expect(webHealth.ok()).toBe(true);
  expect(apiLive.ok()).toBe(true);
  expect(apiReady.ok()).toBe(true);
  expect(apiReady.headers()['x-request-id']).toBeTruthy();
  expect(apiReady.headers()['x-correlation-id']).toBe('playwright-smoke');
  expect(pageErrors).toEqual([]);
});
