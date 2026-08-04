import { expect, test, type Page } from '@playwright/test';

import { fillHourlySearch } from './public-search-helpers';

const OIDC_BASE_URL = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;
const WEB_BASE_URL = 'http://127.0.0.1:3100';
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
] as const;

if (OIDC_BASE_URL === undefined) {
  throw new Error(
    'PLAYWRIGHT_TEST_OIDC_BASE_URL is not set; global setup did not start the OIDC server',
  );
}

async function searchFromRoot(
  page: Page,
  locale: 'vi' | 'en',
  stay: { checkIn: string; checkOut: string },
) {
  const labels =
    locale === 'vi'
      ? {
          checkIn: 'Nhận phòng',
          checkOut: 'Trả phòng',
          adults: 'Người lớn',
          search: 'Tìm phòng',
          room: 'Xem phòng & giá',
          quote: 'Xem giá chính thức',
        }
      : {
          checkIn: 'Check-in',
          checkOut: 'Check-out',
          adults: 'Adults',
          search: 'Search rooms',
          room: 'View room & price',
          quote: 'View official price',
        };
  await fillHourlySearch(page, {
    date: stay.checkIn.slice(0, 10),
    start: `${stay.checkIn.slice(11, 16)}:00`,
    end: `${stay.checkOut.slice(11, 16)}:00`,
  });
  const results = page.getByLabel(
    locale === 'vi' ? 'Hạng phòng còn trống' : 'Available room types',
  );
  await expect(results.getByRole('heading', { name: 'Nami' })).toBeVisible();
  await expect(
    results
      .getByTestId('availability-room-10000000-0000-4000-8000-000000000201')
      .getByRole('link', { name: labels.room }),
  ).toBeVisible();
  return labels;
}

async function assertResponsive(page: Page) {
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    submit: document.querySelector('form button')?.getBoundingClientRect().right ?? 0,
  }));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.submit).toBeLessThanOrEqual(metrics.viewport + 1);
}

test.describe('Phase 8D.3 real public entry', () => {
  test('anonymous Vietnamese root enters search, quote, and HOLD contact', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Trải nghiệm lưu trú tiện nghi, linh hoạt' }),
    ).toBeVisible();
    await expect(page.getByText(/Phase 1|Nền tảng kỹ thuật|Kết nối API/i)).toHaveCount(0);
    const labels = await searchFromRoot(page, 'vi', {
      checkIn: '2027-04-10T11:00',
      checkOut: '2027-04-10T14:00',
    });
    await page
      .getByLabel('Hạng phòng còn trống')
      .getByTestId('availability-room-10000000-0000-4000-8000-000000000201')
      .getByRole('link', { name: labels.room })
      .click();
    await page.waitForURL(/\/rooms\//);
    await expect(page.getByRole('button', { name: labels.quote })).toBeVisible();
    await page.getByRole('button', { name: labels.quote }).click();
    await page.waitForURL(/\/booking\/quote\//);
    await expect(page.getByRole('heading', { name: 'Thanh toán & đặt phòng' })).toBeVisible();
    await expect(page.getByLabel('Họ và tên')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('English locale persists from root search through reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { name: 'Comfortable stays, on your terms' }),
    ).toBeVisible();
    // The locale switch refreshes server components. Reload before entering
    // form state so this test exercises the persisted locale rather than a
    // transient client-refresh window.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { name: 'Comfortable stays, on your terms' }),
    ).toBeVisible();
    await searchFromRoot(page, 'en', {
      checkIn: '2027-04-11T11:00',
      checkOut: '2027-04-11T14:00',
    });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { name: 'Comfortable stays, on your terms' }),
    ).toBeVisible();
  });

  test('authenticated customer receives account navigation and can still search', async ({
    page,
  }) => {
    const response = await page.request.post(`${OIDC_BASE_URL}/test/set-next-user`, {
      data: {
        sub: 'phase-8d3-customer',
        email: 'phase-8d3-customer@playwright.test',
        name: 'Phase 8D3 Customer',
      },
    });
    expect(response.ok()).toBeTruthy();
    await page.goto(`${WEB_BASE_URL}/login`);
    await page.getByTestId('test-identity-button').click();
    await page.waitForURL(/\/account\/bookings$/);
    await page.goto('/');
    const publicHeader = page.getByRole('banner');
    await expect(publicHeader.getByRole('button', { name: 'Mở menu tài khoản' })).toBeVisible();
    await publicHeader.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await expect(page.getByRole('menuitem', { name: 'Hồ sơ', exact: true })).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Đặt phòng của tôi', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Cài đặt', exact: true })).toBeVisible();
    await searchFromRoot(page, 'vi', {
      checkIn: '2027-04-12T11:00',
      checkOut: '2027-04-12T14:00',
    });
  });

  test('root header and booking controls remain usable across required viewports', async ({
    page,
  }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Tìm phòng' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
      await assertResponsive(page);
    }
  });
});
