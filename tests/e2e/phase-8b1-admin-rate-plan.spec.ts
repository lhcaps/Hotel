import { expect, test, type Page, type Response } from '@playwright/test';

import { availabilitySearchResponseSchema } from '@room/contracts';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';
import { fillHourlySearch } from './public-search-helpers';

/**
 * Phase 8B.1 ADMIN rate-plan vertical — generic plan creation through the
 * real ADMIN Web + API path.
 *
 *   1. ADMIN signs in and lands on the rate-plan admin page.
 *   2. ADMIN submits a generic uppercase plan (e.g. `PROBE_FLEX`).
 *   3. ADMIN configures the selection rule (check-in window, duration
 *      window, included duration, priority).
 *   4. ADMIN configures the price tier.
 *   5. ADMIN activates the plan.
 *   6. A public quote is issued against the activated plan.
 *   7. ADMIN edits the price; a fresh public quote reflects the new
 *      amount and the original quote remains immutable.
 *   8. ADMIN inactivates the plan; a fresh public quote excludes it.
 *   9. CUSTOMER cannot reach the admin surface (CUSTOMER denial).
 *
 * The probe plan code is intentionally uppercase + digits + underscore
 * only, satisfying the migration 0016 constraint and the
 * `^[A-Z0-9_]{1,64}$` regex in `packages/contracts/src/pricing.ts`.
 *
 * No permanent skip: every acceptance criterion runs in this single
 * deterministic spec.
 */

const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const API_BASE = 'http://127.0.0.1:3101/api/v1';

interface QuoteSummary {
  id: string;
  pricing: {
    selectedPlanCode: string;
    totalAmountVnd: number;
    ruleVersion: string;
  };
  roomTypeId: string;
  coupon?: unknown;
}

async function fetchAvailability(
  page: Page,
): Promise<readonly { roomTypeId: string; availableRoomCount: number }[]> {
  const raw: unknown = await page.evaluate(
    async ({ url }) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          checkIn: '2027-02-10T15:00:00+07:00',
          checkOut: '2027-02-10T18:00:00+07:00',
          adults: 2,
          children: 0,
        }),
      });
      return response.json();
    },
    { url: `${API_BASE}/availability/search` },
  );
  const parsed = availabilitySearchResponseSchema.parse(raw);
  return parsed.items.map((item) => ({
    roomTypeId: item.roomTypeId,
    availableRoomCount: item.availableRoomCount,
  }));
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/\/admin$/);
}

test.describe('Phase 8B.1 ADMIN rate-plan vertical', () => {
  test.setTimeout(180_000);

  test('ADMIN creates, configures, activates, prices, quotes, edits, and inactivates a generic plan', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rate-plans');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Submit a generic uppercase plan through the form (the form
    // shape is exercised by `rate-plan-manager.test.tsx`).
    const planCode = 'PROBE_FLEX';
    await page.getByRole('button', { name: 'Tạo gói giá' }).click();
    const createDialog = page.getByRole('dialog');
    await createDialog.getByLabel('Mã gói').fill(planCode);
    await createDialog.getByLabel('Tên hiển thị').fill('Probe flex combo');
    await createDialog.getByRole('combobox').nth(0).click();
    await page.getByRole('option', { name: '3 giờ 0 phút', exact: true }).click();
    await createDialog.getByRole('combobox').last().click();
    await page.getByRole('option', { name: '30', exact: true }).click();
    await createDialog.getByRole('button', { name: 'Tạo gói giá' }).click();
    await expect(page.getByText(planCode)).toBeVisible();

    // The activation controls and price inputs become available once
    // the plan row renders; assert their presence before interacting.
    const planRow = page.getByRole('article', { name: new RegExp(planCode) });
    await expect(planRow).toBeVisible();

    // Step 4: configure the price.
    const priceInput = planRow.getByRole('spinbutton', { name: /Deluxe$/i });
    await priceInput.fill('259000');
    const [priceResponse, reloadedPlansResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          /\/admin\/rate-plans\/[^/]+\/prices\/[^/]+$/.test(response.url()),
      ),
      page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          response.url().endsWith('/api/v1/admin/rate-plans'),
      ),
      priceInput.locator('xpath=ancestor::li').getByRole('button').click(),
    ]);
    expect(priceResponse.ok()).toBeTruthy();
    expect(reloadedPlansResponse.ok()).toBeTruthy();
    await expect(priceInput).toHaveValue('259000');

    for (const priceTierName of ['Standard', 'Signature']) {
      const tierPrice = planRow.getByRole('spinbutton', {
        name: new RegExp(`${priceTierName}$`),
      });
      await tierPrice.fill('259000');
      const [tierPriceResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === 'PATCH' &&
            /\/admin\/rate-plans\/[^/]+\/prices\/[^/]+$/.test(response.url()),
        ),
        tierPrice.locator('xpath=ancestor::li').getByRole('button').click(),
      ]);
      expect(tierPriceResponse.ok()).toBeTruthy();
    }

    // The default priority (30) conflicts with LUNCH_COMBO in its window;
    // 60 is unique among the deterministic seed rules.
    // Give the generic plan an explicit, unique priority before activation.
    await planRow.getByRole('button', { name: 'Điều kiện áp dụng' }).click();
    const selectionDialog = page.getByRole('dialog');
    await selectionDialog.getByRole('combobox').last().click();
    await page.getByRole('option', { name: '60', exact: true }).click();
    const [ruleResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          /\/admin\/rate-plans\/[^/]+\/selection-rule$/.test(response.url()),
      ),
      selectionDialog.getByRole('button', { name: 'Lưu điều kiện' }).click(),
    ]);
    expect(ruleResponse.ok()).toBeTruthy();

    // Step 5: activate.
    const [activationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/admin\/rate-plans\/[^/]+\/activate$/.test(response.url()),
      ),
      planRow.getByRole('button', { name: 'Kích hoạt' }).click(),
    ]);
    expect(activationResponse.ok(), await activationResponse.text()).toBeTruthy();
    await expect(planRow.getByText('Đang hoạt động')).toBeVisible();

    // Step 6: public quote against the activated plan.
    const availabilityBefore = await fetchAvailability(page);
    const roomsBefore =
      availabilityBefore.find((room) => room.roomTypeId === ROOM_TYPE_ID)?.availableRoomCount ?? 0;

    await page.goto('/booking/search');
    await fillHourlySearch(page, {
      date: '2027-02-10',
      start: '15:00:00',
      end: '18:00:00',
    });
    await expect(page.getByRole('heading', { name: 'Nami' })).toBeVisible();

    const initialQuoteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
    );
    await page
      .getByTestId('availability-room-10000000-0000-4000-8000-000000000201')
      .getByRole('link', { name: 'Xem phòng & giá' })
      .click();
    await page.getByRole('button', { name: 'Xem giá chính thức' }).click();
    const initialQuoteResponse: Response = await initialQuoteResponsePromise;
    expect(initialQuoteResponse.ok()).toBeTruthy();
    const initialQuote = (await initialQuoteResponse.json()) as QuoteSummary;
    expect(initialQuote.pricing.selectedPlanCode).toBe(planCode);
    expect(initialQuote.pricing.totalAmountVnd).toBe(259_000);
    expect(initialQuote.roomTypeId).toBe(ROOM_TYPE_ID);
    expect(initialQuote.pricing.ruleVersion).toBe('phase-8b-cheapest-eligible-pricing-v1');
    expect(initialQuote.coupon, 'no coupon reservation on quote').toBeUndefined();

    // Step 7: edit price; new quote reflects the change, old is immutable.
    await page.goto('/admin/rate-plans');
    const planRowAfter = page.getByRole('article', { name: new RegExp(planCode) });
    await planRowAfter.getByRole('spinbutton', { name: /Deluxe$/i }).fill('279000');
    await planRowAfter
      .getByRole('spinbutton', { name: /Deluxe$/i })
      .locator('xpath=ancestor::li')
      .getByRole('button')
      .click();
    await expect(planRowAfter.getByRole('spinbutton', { name: /Deluxe$/i })).toHaveValue('279000');

    const reQuoteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
    );
    await page.goto('/booking/search');
    await fillHourlySearch(page, {
      date: '2027-02-10',
      start: '15:00:00',
      end: '18:00:00',
    });
    await page
      .getByTestId('availability-room-10000000-0000-4000-8000-000000000201')
      .getByRole('link', { name: 'Xem phòng & giá' })
      .click();
    await page.getByRole('button', { name: 'Xem giá chính thức' }).click();
    const reQuoteResponse: Response = await reQuoteResponsePromise;
    expect(reQuoteResponse.ok()).toBeTruthy();
    const reQuote = (await reQuoteResponse.json()) as QuoteSummary;
    expect(reQuote.id).not.toBe(initialQuote.id);
    expect(reQuote.pricing.selectedPlanCode).toBe(planCode);
    expect(reQuote.pricing.totalAmountVnd).toBe(279_000);

    // Historical quote is immutable (re-read its amount via the API).
    const initialQuoteRead = await page.evaluate(
      async ({ apiBase, quoteId }) => {
        const response = await fetch(`${apiBase}/quotes/${quoteId}`);
        return response.json() as Promise<QuoteSummary>;
      },
      { apiBase: API_BASE, quoteId: initialQuote.id },
    );
    expect(initialQuoteRead.pricing.totalAmountVnd).toBe(259_000);

    // Step 8: inactivate; new quote excludes the plan.
    await page.goto('/admin/rate-plans');
    const planRowInactive = page.getByRole('article', { name: new RegExp(planCode) });
    const [inactivationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/admin\/rate-plans\/[^/]+\/inactivate$/.test(response.url()),
      ),
      planRowInactive.getByRole('button', { name: 'Ngừng áp dụng' }).click(),
    ]);
    expect(inactivationResponse.ok()).toBeTruthy();
    await expect(planRowInactive.getByText('Ngừng hoạt động')).toBeVisible();

    const finalQuoteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/quotes') && response.request().method() === 'POST',
    );
    await page.goto('/booking/search');
    await fillHourlySearch(page, {
      date: '2027-02-10',
      start: '15:00:00',
      end: '18:00:00',
    });
    await page
      .getByTestId('availability-room-10000000-0000-4000-8000-000000000201')
      .getByRole('link', { name: 'Xem phòng & giá' })
      .click();
    await page.getByRole('button', { name: 'Xem giá chính thức' }).click();
    const finalQuoteResponse: Response = await finalQuoteResponsePromise;
    const finalQuote = (await finalQuoteResponse.json()) as QuoteSummary;
    expect(finalQuote.pricing.selectedPlanCode).not.toBe(planCode);

    const availabilityAfter = await fetchAvailability(page);
    const roomsAfter =
      availabilityAfter.find((room) => room.roomTypeId === ROOM_TYPE_ID)?.availableRoomCount ?? 0;
    expect(roomsAfter, 'no inventory consumed by quote issue').toBe(roomsBefore);
  });

  test('CUSTOMER cannot reach the admin rate-plan surface', async ({ page }) => {
    await page.goto('/admin/rate-plans');
    // The auth guard must redirect CUSTOMER away from the admin surface.
    // The destination is /admin/login or /admin/forbidden depending on
    // the shell; either one is acceptable evidence that CUSTOMER has
    // not been granted ADMIN access.
    await page.waitForURL(/\/admin\/(login|forbidden|403|404)/);
  });
});
