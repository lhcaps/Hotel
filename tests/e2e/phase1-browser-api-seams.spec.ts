import { expect, test, type Page, type Request } from '@playwright/test';

import { setSimulatorMode } from './_fixtures/payment-test-helpers.mjs';
import { createHoldsForUi, fetchOtpFor } from './_fixtures/booking-otp.mjs';
import { assertSafePaymentRedirect } from './_fixtures/payment-redirect-helper.mjs';
import { fillHourlySearch } from './public-search-helpers';

const OIDC_BASE_URL = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;

if (OIDC_BASE_URL === undefined) {
  throw new Error(
    'PLAYWRIGHT_TEST_OIDC_BASE_URL is not set; global setup did not start the OIDC server',
  );
}

const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const SIMULATOR_BASE = 'http://127.0.0.1:3090';

function urlPath(request: Request): string {
  const url = new URL(request.url());
  return url.pathname.replace(/^\/api\/v1/, '');
}

async function goToLanding(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Trải nghiệm lưu trú tiện nghi, linh hoạt' }),
  ).toBeVisible({ timeout: 15_000 });
}

async function driveOtpUi(page: Page, bookingCode: string, email: string): Promise<void> {
  await page.goto('/booking/manage', { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');

  await page.locator('input[name="bookingCode"]').fill(bookingCode);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('form button[type="submit"]').first().click();

  await expect(page.locator('input[name="otp"]')).toBeVisible({ timeout: 15_000 });
  const otp = await fetchOtpFor({ email });
  await page.locator('input[name="otp"]').fill(otp);
  await page.locator('form button[type="submit"]').last().click();

  await expect(page.locator('.payment-provider-options')).toBeVisible({ timeout: 30_000 });
}

test.describe('phase1 browser api seams', () => {
  test('A. EXACT EMPTY → NEARBY: hits /public/availability/nearby with localized interval', async ({
    page,
  }) => {
    const nearbyRequests: Array<{ method: string; path: string; body: unknown }> = [];
    const oldRouteRequests: string[] = [];

    await page.route('**/api/v1/public/availability/nearby', async (route) => {
      const req = route.request();
      nearbyRequests.push({
        method: req.method(),
        path: urlPath(req),
        body: (() => {
          try {
            return JSON.parse(req.postData() ?? '{}');
          } catch {
            return null;
          }
        })(),
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requestedCheckIn: '2027-05-01T11:00:00.000Z',
          requestedCheckOut: '2027-05-01T14:00:00.000Z',
          durationMinutes: 180,
          candidates: [
            {
              checkIn: '2027-05-01T10:15:00.000Z',
              checkOut: '2027-05-01T13:15:00.000Z',
              shiftMinutes: -45,
              roomTypes: [
                {
                  roomTypeId: ROOM_TYPE_ID,
                  roomTypeCode: 'DELUXE',
                  roomTypeName: 'Deluxe',
                  maxAdults: 2,
                  maxChildren: 1,
                  maxOccupancy: 3,
                  amenities: ['Wi-Fi'],
                  availableRoomCount: 1,
                  description: null,
                  offer: { planLabel: 'Early bird flex', amountVnd: 200000 },
                },
              ],
            },
          ],
        }),
      });
    });
    await page.route('**/api/v1/availability/search', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      }),
    );
    await page.route('**/api/v1/availability/nearby', (route) => {
      oldRouteRequests.push(urlPath(route.request()));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await goToLanding(page);
    await fillHourlySearch(page, {
      date: '2027-05-01',
      start: '11:00:00',
      end: '14:00:00',
    });

    await expect(page.getByText('Không còn phòng đúng thời gian bạn chọn')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(1_500);

    expect(oldRouteRequests, 'old /availability/nearby must never be called').toHaveLength(0);
    expect(nearbyRequests).toHaveLength(1);
    const req = nearbyRequests[0]!;
    expect(req.method).toBe('POST');
    expect(req.path).toBe('/public/availability/nearby');
    expect(req.body).toMatchObject({
      checkIn: '2027-05-01T11:00:00+07:00',
      checkOut: '2027-05-01T14:00:00+07:00',
      adults: 2,
      children: 0,
    });

    const nearbyCard = page.locator('[data-testid^="nearby-candidate-"]').first();
    await expect(nearbyCard).toBeVisible({ timeout: 15_000 });
    const intervalText = (await nearbyCard.locator('header p').innerText()).trim();
    expect(intervalText).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(intervalText).toMatch(/–/);
    expect(intervalText.toLowerCase()).toContain('2027');

    const offerText = (
      await nearbyCard.getByTestId(`availability-room-${ROOM_TYPE_ID}`).innerText()
    ).trim();
    expect(offerText.toLowerCase()).toMatch(/200|triệu|nghìn|₫|vnd/);
  });

  test('B. CROSS MIDNIGHT: hourly form helper sends next-day checkout via API', async ({
    page,
  }) => {
    const availabilityBodies: unknown[] = [];
    await page.route('**/api/v1/public/availability/nearby', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requestedCheckIn: '2027-07-31T16:00:00.000Z',
          requestedCheckOut: '2027-07-31T19:00:00.000Z',
          durationMinutes: 180,
          candidates: [],
        }),
      }),
    );
    await page.route('**/api/v1/availability/search', async (route) => {
      const req = route.request();
      try {
        availabilityBodies.push(JSON.parse(req.postData() ?? '{}'));
      } catch {
        availabilityBodies.push({});
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await goToLanding(page);
    await fillHourlySearch(page, {
      date: '2027-07-31',
      start: '23:00:00',
      end: '02:00:00',
    });

    await expect(page.getByText('Không còn phòng đúng thời gian bạn chọn')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(1_500);
    expect(availabilityBodies.length).toBeGreaterThanOrEqual(1);
    const body = availabilityBodies[0] as Record<string, unknown>;
    expect(body.checkIn).toBe('2027-07-31T23:00:00+07:00');
    expect(body.checkOut).toBe('2027-08-01T02:00:00+07:00');
  });

  test('D. MOMO BROWSER REDIRECT: clicking MoMo navigates to simulator origin', async ({
    page,
  }) => {
    // cancel mode prevents IPN settlement from accidentally promoting the
    // booking while the assertion-only tests are still in flight.
    await setSimulatorMode('momo', 'cancel');
    const [hold] = await createHoldsForUi({ count: 1 });
    await driveOtpUi(page, hold.bookingCode, hold.email);

    const navigation = page.waitForURL(
      (current) => {
        const url = new URL(current);
        return url.origin === SIMULATOR_BASE && url.pathname.startsWith('/momo-test/pay');
      },
      { timeout: 30_000 },
    );
    await page.locator('.payment-provider-option__button', { hasText: 'MoMo' }).click();
    await navigation;

    const navigated = new URL(page.url());
    expect(navigated.origin).toBe(SIMULATOR_BASE);
    expect(navigated.pathname).toBe('/momo-test/pay');
    expect(navigated.searchParams.get('orderId')).toBeTruthy();
  });

  test('E. VNPAY BROWSER REDIRECT: clicking VNPAY navigates to simulator origin', async ({
    page,
  }) => {
    await setSimulatorMode('vnpay', 'cancel');
    const [hold] = await createHoldsForUi({ count: 1 });
    await driveOtpUi(page, hold.bookingCode, hold.email);

    const navigation = page.waitForURL(
      (current) => {
        const url = new URL(current);
        return url.origin === SIMULATOR_BASE && url.pathname.startsWith('/vnpay-test/pay');
      },
      { timeout: 30_000 },
    );
    await page.locator('.payment-provider-option__button', { hasText: 'VNPAY' }).click();
    await navigation;

    const navigated = new URL(page.url());
    expect(navigated.origin).toBe(SIMULATOR_BASE);
    expect(navigated.pathname).toBe('/vnpay-test/pay');
    expect(navigated.searchParams.get('vnp_TxnRef')).toBeTruthy();
  });

  test('F. UNSAFE REDIRECT: external HTTP URL is rejected without navigation', async ({ page }) => {
    await setSimulatorMode('momo', 'cancel');
    const [hold] = await createHoldsForUi({ count: 1 });
    await driveOtpUi(page, hold.bookingCode, hold.email);

    await page.route('**/api/v1/public/bookings/*/payments/momo/attempts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          provider: 'MOMO',
          redirectUrl: 'http://evil.example/pay',
          status: 'PENDING',
        }),
      });
    });

    const manageOrigin = new URL(page.url()).origin;
    await page.locator('.payment-provider-option__button', { hasText: 'MoMo' }).click();

    // The contract is rejection without external navigation and restoration
    // of the actionable payment choice. Error-announcer markup is framework
    // detail and is covered by component tests rather than this browser seam.
    expect(new URL(page.url()).origin).toBe(manageOrigin);
    await expect(
      page.locator('.payment-provider-option__button', { hasText: 'MoMo' }),
    ).toBeEnabled();
  });

  test('G. PRODUCTION RUNTIME: helper rejects loopback HTTP', () => {
    expect(() =>
      assertSafePaymentRedirect('http://127.0.0.1:3090/momo-test/pay', 'production'),
    ).toThrow();
    expect(() =>
      assertSafePaymentRedirect('http://localhost:3090/vnpay-test/pay', 'production'),
    ).toThrow();
    expect(() =>
      assertSafePaymentRedirect('https://sandbox.example.test/pay', 'production'),
    ).not.toThrow();
  });
});
