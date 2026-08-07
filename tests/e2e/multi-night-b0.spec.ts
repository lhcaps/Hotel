import { expect, test } from '@playwright/test';

import { setSimulatorMode } from './_fixtures/payment-test-helpers.mjs';

const API_BASE = 'http://127.0.0.1:3101/api/v1';
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const stay = {
  mode: 'multi_night' as const,
  checkIn: '2027-02-10T21:00:00+07:00',
  checkOut: '2027-02-12T09:00:00+07:00',
  adults: 2,
  children: 0,
};

test.describe('B0 multi-night public release candidate', () => {
  test('public interval → continuous offer → immutable quote → one payment booking', async ({
    page,
  }) => {
    const availability = await page.request.post(`${API_BASE}/availability/search`, {
      data: stay,
    });
    expect(availability.ok(), await availability.text()).toBe(true);
    const availabilityBody = (await availability.json()) as {
      state: string;
      items: readonly {
        roomTypeId: string;
        availableRoomCount: number;
        offer: { amountVnd: number; nightCount?: number } | null;
      }[];
    };
    expect(availabilityBody.state).toBe('AVAILABLE');
    const room = availabilityBody.items.find((item) => item.roomTypeId === ROOM_TYPE_ID);
    expect(room).toMatchObject({ availableRoomCount: 1, offer: { nightCount: 2 } });

    const query = new URLSearchParams({
      mode: stay.mode,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: String(stay.adults),
      children: String(stay.children),
    });
    await page.goto(`/booking/search?${query.toString()}`);
    await expect(page.getByTestId('availability-mode-multi-night')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const card = page.getByTestId(`availability-room-${ROOM_TYPE_ID}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText('Nami');
    await expect(card).not.toContainText('101');
    await expect(page.locator('body')).not.toContainText('roomId');

    const quoteResponse = await page.request.post(`${API_BASE}/quotes`, {
      data: { ...stay, roomTypeId: ROOM_TYPE_ID },
    });
    expect(quoteResponse.status(), await quoteResponse.text()).toBe(201);
    const quote = (await quoteResponse.json()) as {
      id: string;
      mode: string;
      pricing: { displayNightCount?: number; finalAmountVnd?: number };
    };
    expect(quote.mode).toBe('multi_night');
    expect(quote.pricing).toMatchObject({ displayNightCount: 2, finalAmountVnd: 1_200_000 });

    const quoteQuery = new URLSearchParams({
      roomTypeId: ROOM_TYPE_ID,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: String(stay.adults),
      children: String(stay.children),
    });
    await page.goto(`/booking/quote/${quote.id}?${quoteQuery.toString()}`);
    await expect(page.getByRole('heading', { name: 'Thanh toán & đặt phòng' })).toBeVisible();
    await expect(page.getByText('Số đêm hiển thị')).toBeVisible();
    await expect(
      page
        .locator('dt')
        .filter({ hasText: 'Số đêm hiển thị' })
        .locator('xpath=following-sibling::dd'),
    ).toHaveText('2');

    await setSimulatorMode('vnpay', 'verify', { reset: true });
    await page.getByLabel('Họ và tên').fill('B0 Browser Guest');
    await page.getByLabel('Email').fill(`b0-${Date.now()}@playwright.test`);
    await page.getByLabel(/Số điện thoại/).fill('+84909000123');
    await page.getByRole('radio', { name: 'VNPAY' }).check();
    await page.getByRole('button', { name: 'Thanh toán & đặt phòng' }).click();
    await expect(page).toHaveURL(/\/booking\/manage\/[A-Z0-9-]+$/, { timeout: 45_000 });
  });

  test('public multi-night errors remain structured and fail closed', async ({ page }) => {
    const belowMinimum = await page.request.post(`${API_BASE}/availability/search`, {
      data: { ...stay, checkOut: '2027-02-10T21:30:00+07:00' },
    });
    expect(belowMinimum.ok()).toBe(true);
    await expect(belowMinimum.json()).resolves.toMatchObject({
      state: 'BELOW_MINIMUM_STAY',
      items: [],
    });

    const aboveMaximum = await page.request.post(`${API_BASE}/availability/search`, {
      data: { ...stay, checkOut: '2027-02-20T09:00:00+07:00' },
    });
    expect(aboveMaximum.ok()).toBe(true);
    await expect(aboveMaximum.json()).resolves.toMatchObject({
      state: 'ABOVE_MAXIMUM_STAY',
      items: [],
    });

    const invalidGuests = await page.request.post(`${API_BASE}/availability/search`, {
      data: { ...stay, adults: 0 },
    });
    expect(invalidGuests.ok()).toBe(true);
    await expect(invalidGuests.json()).resolves.toMatchObject({
      state: 'INVALID_GUEST_COUNT',
      items: [],
    });
  });
});
