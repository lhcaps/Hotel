import { expect, test, type Page, type Response } from '@playwright/test';

import { availabilitySearchResponseSchema } from '@room/contracts';

const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const API_BASE = 'http://127.0.0.1:3101/api/v1';

const BASELINE_CHECK_IN = '2027-01-10T11:00:00+07:00';
const BASELINE_CHECK_OUT = '2027-01-10T14:00:00+07:00';

async function fetchAvailability(
  page: Page,
): Promise<readonly { roomTypeId: string; availableRoomCount: number }[]> {
  const raw: unknown = await page.evaluate(
    async ({ url }) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          checkIn: '2027-01-10T11:00:00+07:00',
          checkOut: '2027-01-10T14:00:00+07:00',
          adults: 2,
          children: 0,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          `Availability request failed (${response.status}): ${JSON.stringify(body)}`,
        );
      }
      return body;
    },
    { url: `${API_BASE}/availability/search` },
  );
  const parsed = availabilitySearchResponseSchema.parse(raw);
  return parsed.items.map((item) => ({
    roomTypeId: item.roomTypeId,
    availableRoomCount: item.availableRoomCount,
  }));
}

function attachQualityListeners(page: Page): {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
} {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      requestFailures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return { consoleErrors, pageErrors, requestFailures };
}

function expectNoQualityIssues(
  context: { consoleErrors: string[]; pageErrors: string[]; requestFailures: string[] },
  label: string,
): void {
  expect(
    context.consoleErrors,
    `${label} — console errors: ${context.consoleErrors.join('\n')}`,
  ).toHaveLength(0);
  expect(
    context.pageErrors,
    `${label} — page errors: ${context.pageErrors.join('\n')}`,
  ).toHaveLength(0);
  expect(
    context.requestFailures,
    `${label} — request failures / 5xx: ${context.requestFailures.join('\n')}`,
  ).toHaveLength(0);
}

test('visitor sees cheaper stay-time recommendations and reissues a quote', async ({ page }) => {
  test.setTimeout(120_000);
  const quality = attachQualityListeners(page);

  // The seed is deterministic: at 11:00 + 3h the cheapest plan is
  // THREE_HOUR_COMBO (300k). At -45 min the cheapest plan is
  // EARLY_BIRD_FLEX (200k) which is excluded from the exact 11:00
  // window by its [360, 660) check-in range. The panel must surface
  // that strictly cheaper alternative without any hold/inventory/coupon
  // side-effects.
  await page.goto('/booking/search');
  await page.getByLabel('Nhận phòng').fill('2027-01-10T11:00');
  await page.getByLabel('Trả phòng').fill('2027-01-10T14:00');
  await page.getByLabel('Người lớn').fill('2');
  await page.getByRole('button', { name: 'Tìm phòng' }).click();
  await expect(page.getByRole('heading', { name: 'Deluxe' })).toBeVisible();

  const initialQuoteResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
  );
  await page.getByRole('link', { name: 'Xem phòng & giá' }).click();
  await page.getByRole('button', { name: 'Xem giá chính thức' }).click();
  const initialQuoteResponse = await initialQuoteResponsePromise;
  expect(initialQuoteResponse.ok()).toBeTruthy();
  const initialQuote = (await initialQuoteResponse.json()) as { id: string };
  await page.waitForURL(new RegExp(`/booking/quote/${initialQuote.id}\\?`));
  const initialUrl = page.url();
  expect(initialUrl).toContain(`/booking/quote/${initialQuote.id}`);

  await expect(page.getByRole('heading', { name: 'Thanh toán & đặt phòng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Khung giờ thay thế rẻ hơn' })).toBeVisible();

  const recommendationsResponse: Response = await page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/recommendations/stay-times') &&
      response.request().method() === 'POST',
  );
  expect(recommendationsResponse.ok()).toBeTruthy();
  const recommendations = (await recommendationsResponse.json()) as {
    exactResult: { finalAmountVnd: number; pricing: { selectedPlanCode: string } };
    recommendations: ReadonlyArray<{
      checkIn: string;
      checkOut: string;
      shiftMinutes: number;
      finalAmountVnd: number;
      selectedPlanCode: string;
      availabilityStatus: string;
      savingsVnd: number;
    }>;
  };

  // Baseline assertion: the exact 11:00+3h interval picks THREE_HOUR_COMBO at 300k.
  expect(recommendations.exactResult.pricing.selectedPlanCode).toBe('THREE_HOUR_COMBO');
  expect(recommendations.exactResult.finalAmountVnd).toBe(300_000);

  // Deterministic reissue precondition: at least one candidate is strictly
  // cheaper than the baseline, AVAILABLE, and produced by a different plan.
  const cheaper = recommendations.recommendations.filter(
    (candidate) =>
      candidate.finalAmountVnd < recommendations.exactResult.finalAmountVnd &&
      candidate.selectedPlanCode !== recommendations.exactResult.pricing.selectedPlanCode,
  );
  expect(cheaper.length, 'expected a strictly cheaper candidate').toBeGreaterThan(0);
  for (const candidate of cheaper) {
    expect(candidate.availabilityStatus, 'candidate availability').toBe('AVAILABLE');
    expect(candidate.savingsVnd, 'candidate savings must be positive').toBeGreaterThan(0);
  }
  // The seed guarantees EARLY_BIRD_FLEX is the cheapest eligible plan in
  // the [10:00, 10:45] minute-of-day window (shiftMinutes -60..-15)
  // because its [360, 660) check-in range excludes 11:00 but admits
  // 10:00-10:45.
  const earlyBird = cheaper.find((candidate) => candidate.selectedPlanCode === 'EARLY_BIRD_FLEX');
  expect(earlyBird, 'EARLY_BIRD_FLEX must be present in cheaper candidates').toBeDefined();
  expect(earlyBird?.finalAmountVnd).toBe(200_000);
  // The cheapest available EARLY_BIRD_FLEX candidate is the closest
  // shifted check-in admitted by the [360, 660) window.
  expect(
    earlyBird?.shiftMinutes,
    'EARLY_BIRD_FLEX candidate must be in the -60..-15 minute window',
  ).toBeGreaterThanOrEqual(-60);
  expect(
    earlyBird?.shiftMinutes,
    'EARLY_BIRD_FLEX candidate must be in the -60..-15 minute window',
  ).toBeLessThanOrEqual(-15);

  // The advisory endpoint must not allocate physical rooms or reserve
  // a coupon: the public availability count must remain stable across
  // the search. The seed database has a single ACTIVE room (room 101).
  const availabilityBefore = await fetchAvailability(page);
  const roomsBefore =
    availabilityBefore.find((room) => room.roomTypeId === ROOM_TYPE_ID)?.availableRoomCount ?? 0;
  expect(roomsBefore, 'availability seeded for Deluxe').toBeGreaterThanOrEqual(1);

  // Reissue: click the EARLY_BIRD_FLEX candidate, intercept the fresh
  // POST /api/v1/quotes, and assert navigation to a different quote.
  // The EARLY_BIRD_FLEX card is selected via its proximity to the
  // customer-facing plan name inside the recommendation <ol>, so the test
  // does not leak the internal rate-plan code into the product UI.
  const earlyBirdCard = page
    .locator('ol > li')
    .filter({ has: page.getByText(/Ưu đãi đặt sớm/) })
    .first();
  await expect(earlyBirdCard).toBeVisible();
  const candidate = earlyBirdCard.getByRole('button', { name: 'Chọn khung giờ này' });
  await expect(candidate).toBeVisible();

  const reissueRequestPromise = page.waitForRequest(
    (request) => request.url().endsWith('/api/v1/quotes') && request.method() === 'POST',
  );
  const reissueResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
  );
  await candidate.click();
  const reissueRequest = await reissueRequestPromise;
  const reissueRequestBody = JSON.parse(reissueRequest.postData() ?? '{}') as Record<
    string,
    unknown
  >;
  // The first candidate is the closest shifted check-in (smallest
  // |shiftMinutes|) admitted by EARLY_BIRD_FLEX. Validate the body
  // shape without coupling the test to the exact minute pick.
  expect(reissueRequestBody.checkIn).toBe(earlyBird?.checkIn);
  expect(reissueRequestBody.checkOut).toBe(earlyBird?.checkOut);
  expect(reissueRequestBody.roomTypeId).toBe(ROOM_TYPE_ID);
  expect(reissueRequestBody.checkIn).not.toBe(BASELINE_CHECK_IN);
  expect(reissueRequestBody.checkOut).not.toBe(BASELINE_CHECK_OUT);

  const reissueResponse: Response = await reissueResponsePromise;
  expect(reissueResponse.status(), 'reissue POST /quotes status').toBe(201);
  const reissueQuote = (await reissueResponse.json()) as {
    id: string;
    roomTypeId: string;
    pricing: { selectedPlanCode: string; totalAmountVnd: number; ruleVersion: string };
    coupon?: unknown;
  };
  expect(reissueQuote.id).not.toBe(initialQuote.id);
  // Room identity: the reissued quote must reference the same room
  // type (no silent re-mapping to a different physical inventory).
  expect(reissueQuote.roomTypeId, 'reissue roomTypeId preserved').toBe(ROOM_TYPE_ID);
  expect(reissueQuote.pricing.selectedPlanCode).toBe(earlyBird?.selectedPlanCode);
  expect(reissueQuote.pricing.totalAmountVnd).toBe(earlyBird?.finalAmountVnd);
  expect(reissueQuote.pricing.ruleVersion).toBe('phase-8b-cheapest-eligible-pricing-v1');
  // Quote issuance is not a HOLD path; the reissued snapshot must not
  // carry a coupon reservation.
  expect(reissueQuote.coupon, 'no coupon reservation on reissue').toBeUndefined();

  await expect(page).not.toHaveURL(initialUrl);
  await expect(page).toHaveURL(/\/booking\/quote\/[^/]+\?/);
  expect(page.url()).toContain('roomTypeId=' + ROOM_TYPE_ID);
  const expectedShiftedCheckIn = encodeURIComponent(earlyBird?.checkIn ?? '');
  const expectedShiftedCheckOut = encodeURIComponent(earlyBird?.checkOut ?? '');
  expect(page.url()).toContain(`checkIn=${expectedShiftedCheckIn}`);
  expect(page.url()).toContain(`checkOut=${expectedShiftedCheckOut}`);
  expect(page.url()).toContain('adults=2');

  // The reissued quote page must render the fresh server-authoritative
  // plan and amount selected from the recommendation candidate.
  await expect(page.getByRole('heading', { name: 'Thanh toán & đặt phòng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ưu đãi đặt sớm' })).toBeVisible();
  await expect(
    page.getByText(
      new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
        earlyBird?.finalAmountVnd ?? 0,
      ),
      { exact: true },
    ),
  ).toBeVisible();

  // Post-reissue invariant: public availability is unchanged. The
  // advisory search and the reissue POST are both non-reserving, so no
  // physical room or coupon quota is consumed by the vertical.
  const availabilityAfter = await fetchAvailability(page);
  const roomsAfter =
    availabilityAfter.find((room) => room.roomTypeId === ROOM_TYPE_ID)?.availableRoomCount ?? 0;
  expect(roomsAfter, 'public availability unchanged after reissue').toBe(roomsBefore);

  expectNoQualityIssues(quality, 'phase-8b1-stay-time-recommendations');
});
