import { expect, test } from '@playwright/test';

const API_BASE = 'http://127.0.0.1:3101/api/v1';
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';

async function createQuote(checkIn: string, checkOut: string): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomTypeId: ROOM_TYPE_ID,
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
    }),
  });
  if (!response.ok) throw new Error(`Quote creation failed: ${response.status}`);
  return (await response.json()) as { id: string };
}

for (const provider of [
  {
    label: 'MoMo',
    name: 'MoMo',
    checkIn: '2027-03-10T04:00:00.000Z',
    checkOut: '2027-03-10T07:00:00.000Z',
  },
  {
    label: 'VNPAY',
    name: 'VNPAY',
    checkIn: '2027-03-11T04:00:00.000Z',
    checkOut: '2027-03-11T07:00:00.000Z',
  },
] as const) {
  test(`one-step ${provider.name} demo checkout starts without a visible hold step and returns to booking access`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const navigatedOrigins: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigatedOrigins.push(new URL(frame.url()).origin);
    });
    const quote = await createQuote(provider.checkIn, provider.checkOut);
    await page.goto(`/booking/quote/${quote.id}`);

    await expect(page.getByRole('heading', { name: 'Thanh toán & đặt phòng' })).toBeVisible();
    await page.getByRole('radio', { name: provider.label }).check();
    await page.getByLabel('Họ và tên').fill('Payment QR Browser');
    await page.getByLabel('Email').fill(`payment-qr-${Date.now()}@playwright.test`);
    await page.getByLabel(/Số điện thoại/).fill('+84909000077');

    await Promise.all([
      page.waitForURL((url) => url.host === '127.0.0.1:3090'),
      page.getByRole('button', { name: 'Thanh toán & đặt phòng' }).click(),
    ]);
    await expect(page).toHaveURL(/\/booking\/manage\/[A-Z0-9-]+$/, { timeout: 30_000 });
    expect(navigatedOrigins).toContain('http://127.0.0.1:3090');
  });
}
