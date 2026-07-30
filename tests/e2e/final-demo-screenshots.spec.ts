import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

const OIDC_BASE_URL = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;

if (OIDC_BASE_URL === undefined) {
  throw new Error(
    'PLAYWRIGHT_TEST_OIDC_BASE_URL is not set; global setup did not start the OIDC server',
  );
}

const OUTPUT_DIR = 'output/playwright/final-demo';

async function capture(page: Page, name: string): Promise<void> {
  const path = `${OUTPUT_DIR}/${name}.png`;
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: true, caret: 'initial' });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    window: window.innerWidth,
  }));
  expect(widths.document, JSON.stringify(widths)).toBe(widths.window);
  expect(widths.body, JSON.stringify(widths)).toBe(widths.window);
}

test('captures final demo landing exact and nearby screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Trải nghiệm lưu trú tiện nghi, linh hoạt' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'landing-exact-1440');

  await page.route('**/api/v1/availability/nearby', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            checkIn: '2030-12-31T11:00:00.000Z',
            checkOut: '2030-12-31T14:00:00.000Z',
            shiftMinutes: 0,
            roomTypes: [
              {
                id: '10000000-0000-4000-8000-000000000201',
                name: 'Deluxe',
                description: 'Phòng Deluxe thoải mái với ban công nhìn ra thành phố.',
                maxAdults: 2,
                maxChildren: 1,
                maxOccupancy: 3,
                priceTierCode: 'STANDARD',
                availableRoomCount: 1,
                lowestPlan: {
                  code: 'THREE_HOUR_COMBO',
                  label: 'Combo 3 giờ',
                  amountVnd: 300000,
                },
              },
            ],
          },
          {
            checkIn: '2030-12-31T11:30:00.000Z',
            checkOut: '2030-12-31T14:30:00.000Z',
            shiftMinutes: 30,
            roomTypes: [
              {
                id: '10000000-0000-4000-8000-000000000201',
                name: 'Deluxe',
                description: 'Phòng Deluxe thoải mái với ban công nhìn ra thành phố.',
                maxAdults: 2,
                maxChildren: 1,
                maxOccupancy: 3,
                priceTierCode: 'STANDARD',
                availableRoomCount: 1,
                lowestPlan: {
                  code: 'LUNCH_COMBO',
                  label: 'Combo bữa trưa',
                  amountVnd: 359000,
                },
              },
            ],
          },
        ],
      }),
    }),
  );
  await page.route('**/api/v1/availability/search', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );
  await page.getByLabel('Nhận phòng').fill('2030-12-31T11:00');
  await page.getByLabel('Trả phòng').fill('2030-12-31T14:00');
  await page.getByLabel('Người lớn').fill('2');
  await page.getByRole('button', { name: 'Tìm phòng' }).click();
  await expect(page.getByText('Không còn phòng đúng thời gian bạn chọn')).toBeVisible();
  await expect(page.getByText('Phòng Deluxe')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'landing-nearby-1440');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await capture(page, 'landing-nearby-390');
});

test('captures final demo room detail screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/rooms/10000000-0000-4000-8000-000000000201');
  await expect(page.getByRole('heading', { name: 'Deluxe' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'room-detail-1440');
});

test('captures final demo admin login screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('header.public-header')).toHaveCount(0);
  await expect(page.locator('aside.admin-nav, [class*="admin-sidebar"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'admin-login-1440');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await capture(page, 'admin-login-390');

  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectNoHorizontalOverflow(page);
  await capture(page, 'admin-dashboard-1440');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await capture(page, 'admin-mobile-390');
});

test('captures final demo admin room type editor screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/room-types');
  await expect(page.getByRole('heading', { name: 'Loại phòng' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'admin-room-type-edit-1440');
});

test('captures responsive overflow measurements for all required viewports', async ({ page }) => {
  const sizes = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Trải nghiệm lưu trú tiện nghi, linh hoạt' }),
  ).toBeVisible();
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await expectNoHorizontalOverflow(page);
  }

  await page.route('**/api/v1/availability/nearby', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            checkIn: '2030-12-31T11:00:00.000Z',
            checkOut: '2030-12-31T14:00:00.000Z',
            shiftMinutes: 0,
            roomTypes: [
              {
                id: '10000000-0000-4000-8000-000000000201',
                name: 'Deluxe',
                description: 'Phòng Deluxe thoải mái với ban công nhìn ra thành phố.',
                maxAdults: 2,
                maxChildren: 1,
                maxOccupancy: 3,
                priceTierCode: 'STANDARD',
                availableRoomCount: 1,
                lowestPlan: {
                  code: 'THREE_HOUR_COMBO',
                  label: 'Combo 3 giờ',
                  amountVnd: 300000,
                },
              },
            ],
          },
        ],
      }),
    }),
  );
  await page.route('**/api/v1/availability/search', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByLabel('Nhận phòng').fill('2030-12-31T11:00');
  await page.getByLabel('Trả phòng').fill('2030-12-31T14:00');
  await page.getByLabel('Người lớn').fill('2');
  await page.getByRole('button', { name: 'Tìm phòng' }).click();
  await expect(page.getByText('Không còn phòng đúng thời gian bạn chọn')).toBeVisible();
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await expectNoHorizontalOverflow(page);
  }

  await page.goto('/rooms/10000000-0000-4000-8000-000000000201');
  await expect(page.getByRole('heading', { name: 'Deluxe' })).toBeVisible();
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await expectNoHorizontalOverflow(page);
  }

  await page.goto('/admin/login');
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await expectNoHorizontalOverflow(page);
  }

  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await expectNoHorizontalOverflow(page);
  }
});
