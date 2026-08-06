import { expect, test, type Page } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.locator('input[type="password"]').fill(playwrightAdminPassword);
  await page.locator('button.admin-login-submit').click();
  await expect(page).toHaveURL(/\/admin$/);
}

function isAdminBookingListResponse(response: import('@playwright/test').Response): boolean {
  try {
    const url = new URL(response.url());
    return url.pathname.endsWith('/api/v1/admin/bookings') && response.request().method() === 'GET';
  } catch {
    return false;
  }
}

test.describe('ADMIN booking date filter contract', () => {
  test('serializes date-only values, resets page, and survives hard refresh', async ({ page }) => {
    await loginAsAdmin(page);
    const initialResponse = page.waitForResponse(isAdminBookingListResponse);
    await page.goto('/admin/bookings');
    const initialBody = (await (await initialResponse).json()) as {
      items: readonly { checkIn: string }[];
    };
    const knownDate = initialBody.items[0]?.checkIn.slice(0, 10);
    expect(knownDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);

    const secondPage = page.getByRole('button', { name: '2', exact: true });
    if (await secondPage.isVisible().catch(() => false)) {
      const secondPageResponse = page.waitForResponse(isAdminBookingListResponse);
      await secondPage.click();
      await secondPageResponse;
      expect(new URL(page.url()).searchParams.get('page')).toBe('2');
    }

    await page.locator('#admin-booking-check-in-from').fill(knownDate!);
    await page.locator('#admin-booking-check-in-to').fill(knownDate!);
    const filteredResponse = page.waitForResponse(isAdminBookingListResponse);
    await page.getByRole('button', { name: /Áp dụng|Apply/ }).click();
    const response = await filteredResponse;
    const requestUrl = new URL(response.request().url());
    expect(response.ok()).toBe(true);
    expect(requestUrl.searchParams.get('checkInFrom')).toBe(knownDate);
    expect(requestUrl.searchParams.get('checkInTo')).toBe(knownDate);
    expect(requestUrl.searchParams.get('page')).toBe('1');
    expect(new URL(page.url()).searchParams.get('checkInFrom')).toBe(knownDate);
    expect(new URL(page.url()).searchParams.get('checkInTo')).toBe(knownDate);

    await page.reload();
    await expect(page.locator('#admin-booking-check-in-from')).toHaveValue(knownDate);
    await expect(page.locator('#admin-booking-check-in-to')).toHaveValue(knownDate);
    expect(new URL(page.url()).searchParams.get('checkInFrom')).toBe(knownDate);

    await page.getByRole('button', { name: /Đặt lại|Reset/ }).click();
    expect(new URL(page.url()).searchParams.get('checkInFrom')).toBeNull();
    await page.goBack();
    await expect(page.locator('#admin-booking-check-in-from')).toHaveValue(knownDate);
    await expect(page.locator('#admin-booking-check-in-to')).toHaveValue(knownDate);
  });

  test('reversed date range shows one Vietnamese validation state without an API call', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/bookings');
    await page.waitForLoadState('domcontentloaded');
    let filteredRequestCount = 0;
    const requestListener = (request: import('@playwright/test').Request) => {
      if (request.url().includes('checkInFrom=')) filteredRequestCount += 1;
    };
    page.on('request', requestListener);
    await page.locator('#admin-booking-check-in-from').fill('2026-08-07');
    await page.locator('#admin-booking-check-in-to').fill('2026-08-06');
    await page.getByRole('button', { name: /Áp dụng|Apply/ }).click();
    await expect(
      page.getByText(/Ngày bắt đầu không được sau ngày kết thúc|start date must be/i),
    ).toHaveCount(1);
    expect(filteredRequestCount).toBe(0);
    await expect(page.getByText(/Chưa có đặt phòng phù hợp|No matching bookings/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Trang trước|Previous page/ })).toHaveCount(0);
    page.off('request', requestListener);
  });

  test('clamps an out-of-range page to the last valid page', async ({ page }) => {
    await loginAsAdmin(page);
    const responsePromise = page.waitForResponse(isAdminBookingListResponse);
    await page.goto('/admin/bookings?page=999');
    const response = await responsePromise;
    const body = (await response.json()) as { page: number; pageSize: number; totalItems: number };
    const expectedPage = Math.max(1, Math.ceil(body.totalItems / body.pageSize));

    await expect
      .poll(() => new URL(page.url()).searchParams.get('page'))
      .toBe(expectedPage === 1 ? null : String(expectedPage));
  });

  test('API failure shows one error state, no empty state, and no stale pagination', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    let fail = true;
    await page.route('**/api/v1/admin/bookings*', async (route) => {
      if (fail) {
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'service-unavailable',
            title: 'Unavailable',
            status: 503,
            detail: 'Booking list unavailable for test.',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
      });
    });
    await page.goto('/admin/bookings');
    await expect(page.locator('.admin-error-state')).toHaveCount(1);
    await expect(
      page.getByText(/Không thể tải danh sách đặt phòng|booking list could not be loaded/i),
    ).toHaveCount(1);
    await expect(page.getByText(/Chưa có đặt phòng phù hợp|No matching bookings/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Trang trước|Previous page/ })).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: /Thử lại|Try again/ }).click();
    await expect(page.locator('.admin-error-state')).toHaveCount(0);
    await expect(page.getByText(/Chưa có đặt phòng phù hợp|No matching bookings/i)).toHaveCount(1);
    await page.unroute('**/api/v1/admin/bookings*');
  });

  test('valid zero result shows only the empty state and no pagination', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('**/api/v1/admin/bookings*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
      });
    });
    await page.goto('/admin/bookings');
    await expect(page.getByText(/Chưa có đặt phòng phù hợp|No matching bookings/i)).toHaveCount(1);
    await expect(page.locator('.admin-error-state')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Trang trước|Previous page/ })).toHaveCount(0);
    await page.unroute('**/api/v1/admin/bookings*');
  });
});
