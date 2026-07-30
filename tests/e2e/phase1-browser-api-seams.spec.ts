import { expect, test, type Page, type Request } from '@playwright/test';

const OIDC_BASE_URL = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;

if (OIDC_BASE_URL === undefined) {
  throw new Error(
    'PLAYWRIGHT_TEST_OIDC_BASE_URL is not set; global setup did not start the OIDC server',
  );
}

const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';

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
    await page.getByLabel('Nhận phòng').fill('2027-05-01T11:00');
    await page.getByLabel('Trả phòng').fill('2027-05-01T14:00');
    await page.getByLabel('Người lớn').fill('2');
    await page.getByRole('button', { name: 'Tìm phòng' }).click();

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
          requestedCheckIn: '2026-07-31T16:00:00.000Z',
          requestedCheckOut: '2026-07-31T19:00:00.000Z',
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
    await page.getByLabel('Nhận phòng').fill('2026-07-31T23:00');
    await page.getByLabel('Trả phòng').fill('2026-08-01T02:00');
    await page.getByLabel('Người lớn').fill('2');
    await page.getByRole('button', { name: 'Tìm phòng' }).click();

    await expect(page.getByText('Không còn phòng đúng thời gian bạn chọn')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(1_500);
    expect(availabilityBodies.length).toBeGreaterThanOrEqual(1);
    const body = availabilityBodies[0] as Record<string, unknown>;
    expect(body.checkIn).toBe('2026-07-31T23:00:00+07:00');
    expect(body.checkOut).toBe('2026-08-01T02:00:00+07:00');
  });
});
