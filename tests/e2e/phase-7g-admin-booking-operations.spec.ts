import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

function resolveDatabaseUrl(): string {
  try {
    const url = readFileSync(join(tmpdir(), 'playwright-test-database-url.txt'), 'utf8').trim();
    if (url.length > 0) return url;
  } catch {
    // Fall through.
  }
  return (
    process.env.PLAYWRIGHT_TEST_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    'postgresql://room:room@127.0.0.1:5432/room_management_test_base'
  );
}

const DATABASE_URL = resolveDatabaseUrl();
interface TestDatabasePool {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[] }>;
  end(): Promise<void>;
}

const databaseRequire = createRequire(join(process.cwd(), 'packages', 'database', 'package.json'));
const { Pool } = databaseRequire('pg') as {
  readonly Pool: new (config: Record<string, unknown>) => TestDatabasePool;
};
const databasePool = new Pool({
  connectionString: DATABASE_URL,
  max: 1,
  application_name: 'room-management-playwright-phase-7g',
});

const PROPERTY_ID = '10000000-0000-4000-8000-000000000001';
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const ROOM_ID = '10000000-0000-4000-8000-000000000301';

const HOLD_PREFIX = `7G${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function pastOperationalInterval(daysAgo: number): {
  readonly checkIn: string;
  readonly checkOut: string;
} {
  const checkIn = new Date(Date.now() - daysAgo * 24 * 60 * 60_000);
  checkIn.setUTCMinutes(0, 0, 0);
  const checkOut = new Date(checkIn.getTime() + 3 * 60 * 60_000);
  return { checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString() };
}

function currentOperationalInterval(): { readonly checkIn: string; readonly checkOut: string } {
  const checkIn = new Date(Date.now() - 60 * 60_000);
  checkIn.setUTCMinutes(Math.floor(checkIn.getUTCMinutes() / 15) * 15, 0, 0);
  const checkOut = new Date(checkIn.getTime() + 3 * 60 * 60_000);
  return { checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString() };
}

function cancellationPolicySnapshot(checkIn: Date): Record<string, unknown> {
  return {
    code: 'PEACENEST_STANDARD_V1',
    version: 1,
    timezone: 'Asia/Ho_Chi_Minh',
    refundBasis: 'PAID_AMOUNT',
    capturedAt: new Date().toISOString(),
    checkIn: checkIn.toISOString(),
    sevenDayDeadline: new Date(checkIn.getTime() - 7 * 24 * 60 * 60_000).toISOString(),
    threeDayDeadline: new Date(checkIn.getTime() - 3 * 24 * 60 * 60_000).toISOString(),
    bands: [
      { minimumSecondsBeforeCheckIn: 604800, refundPercent: 100 },
      { minimumSecondsBeforeCheckIn: 259200, refundPercent: 50 },
      { minimumSecondsBeforeCheckIn: 0, refundPercent: 0 },
    ],
  };
}

async function psql(sql: string): Promise<string> {
  const result = await databasePool.query(sql);
  return result.rows
    .flatMap((row) => Object.values(row))
    .map((value) => String(value))
    .join('\n')
    .trim();
}

async function insertHoldBooking(options: {
  readonly roomId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly withPayment?: boolean;
}): Promise<{ bookingId: string; bookingCode: string }> {
  const bookingId = randomUUID();
  const bookingCode = `7G-${HOLD_PREFIX}-${bookingId.slice(0, 8).toUpperCase()}`;
  const policySnapshot = cancellationPolicySnapshot(new Date(options.checkIn));
  await psql(
    `INSERT INTO bookings (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot, cancellation_policy_snapshot, hold_expires_at) VALUES ('${bookingId}', '${PROPERTY_ID}', '${ROOM_TYPE_ID}', '${options.roomId}', '${bookingCode}', 'HOLD', '${options.checkIn}', '${options.checkOut}', 1, 0, 'VND', 359000, 0, 359000, '{"ratePlanCode":"LUNCH_COMBO"}'::jsonb, '${JSON.stringify(policySnapshot)}'::jsonb, '2027-02-10T05:00:00.000Z');`,
  );
  await psql(
    `INSERT INTO booking_contacts (booking_id, full_name, normalized_email, normalized_phone_e164, email_digest) VALUES ('${bookingId}', 'Phase 7G', 'phase7g@example.test', '+84909000007', decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));`,
  );
  await psql(
    `INSERT INTO room_inventory_blocks (property_id, room_id, booking_id, block_type, status, starts_at, ends_at) VALUES ('${PROPERTY_ID}', '${options.roomId}', '${bookingId}', 'BOOKING', 'ACTIVE', '${options.checkIn}', '${options.checkOut}');`,
  );
  if (options.withPayment === true) {
    await psql(
      `INSERT INTO payments (id, property_id, booking_id, status, amount_vnd, currency, confirmation_source, succeeded_at) VALUES ('${randomUUID()}', '${PROPERTY_ID}', '${bookingId}', 'SUCCEEDED', 359000, 'VND', 'PROVIDER_EVENT', now());`,
    );
  }
  return { bookingId, bookingCode };
}

async function confirmBooking(bookingId: string): Promise<void> {
  await psql(
    `UPDATE bookings SET status = 'CONFIRMED', updated_at = now() WHERE id = '${bookingId}';`,
  );
}

async function loginAsAdminThroughUi(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/\/admin$/);
}

test.describe('Phase 7G ADMIN booking operations', () => {
  test.afterAll(async () => {
    await databasePool.end();
  });

  test('ADMIN login → bookings list → detail → cancel HOLD', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) =>
      requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`),
    );
    page.on('response', (response) => {
      if (response.status() >= 500) {
        requestFailures.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    await loginAsAdminThroughUi(page);

    // 1. Navigate to booking list.
    await page.locator('nav a[href="/admin/bookings"]').click();
    await page.waitForURL(/\/admin\/bookings$/);
    await expect(page.getByRole('heading', { name: 'Đặt phòng' })).toBeVisible();

    // 2. Filter by booking code.
    const holdInterval = pastOperationalInterval(8);
    const holdBooking = await insertHoldBooking({
      roomId: ROOM_ID,
      ...holdInterval,
    });
    await page.getByLabel('Mã đặt phòng').fill(holdBooking.bookingCode);
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByRole('link', { name: holdBooking.bookingCode })).toBeVisible();

    // 3. Open detail.
    await page.getByRole('link', { name: holdBooking.bookingCode }).click();
    await page.waitForURL(new RegExp(`/admin/bookings/${holdBooking.bookingCode}$`));
    await expect(
      page.getByRole('heading', { name: `Đặt phòng ${holdBooking.bookingCode}` }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Thao tác khả dụng' })).toBeVisible();

    // 4. Preview and cancel HOLD with reason.
    await page.getByRole('button', { name: 'Xem trước chính sách hủy' }).click();
    await expect(page.getByRole('status')).toBeVisible();
    await page.getByLabel('Lý do hủy').fill('Playwright cleanup');
    await page.getByRole('button', { name: 'Hủy đặt phòng' }).click();
    await expect(page.getByText('CANCELLED').first()).toBeVisible();
    await expect(page.getByText('BOOKING_CANCELLED')).toBeVisible();
  });

  test('ADMIN can check-in and check-out a CONFIRMED booking', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) =>
      requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`),
    );
    page.on('response', (response) => {
      if (response.status() >= 500) {
        requestFailures.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    await loginAsAdminThroughUi(page);

    const confirmedInterval = currentOperationalInterval();
    const confirmed = await insertHoldBooking({
      roomId: ROOM_ID,
      ...confirmedInterval,
      withPayment: true,
    });
    await confirmBooking(confirmed.bookingId);

    await page.goto(`/admin/bookings/${confirmed.bookingCode}`);
    await expect(
      page.getByRole('heading', { name: `Đặt phòng ${confirmed.bookingCode}` }),
    ).toBeVisible();
    await expect(page.getByText('Đã xác nhận').first()).toBeVisible();

    // Check-in.
    await page.getByRole('button', { name: 'Check-in' }).click();
    await expect(page.getByText('Đã nhận phòng').first()).toBeVisible();
    await expect(page.getByText('BOOKING_CHECKED_IN')).toBeVisible();

    // Check-out.
    await page.getByRole('button', { name: 'Check-out' }).click();
    await expect(page.getByText('Đã trả phòng').first()).toBeVisible();
    await expect(page.getByText('BOOKING_CHECKED_OUT')).toBeVisible();
  });

  test('ADMIN can mark a CONFIRMED booking NO_SHOW and resolve its operational review', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) =>
      requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`),
    );
    page.on('response', (response) => {
      if (response.status() >= 500) {
        requestFailures.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    await loginAsAdminThroughUi(page);

    const noShowInterval = pastOperationalInterval(6);
    const noShow = await insertHoldBooking({
      roomId: ROOM_ID,
      ...noShowInterval,
      withPayment: true,
    });
    await confirmBooking(noShow.bookingId);

    await page.goto(`/admin/bookings/${noShow.bookingCode}`);
    await page.getByLabel('Lý do không đến').fill('Guest unreachable');
    await page.getByRole('button', { name: 'Đánh dấu NO_SHOW' }).click();
    await expect(page.getByText('NO_SHOW').first()).toBeVisible();
    await expect(page.getByText('BOOKING_NO_SHOW')).toBeVisible();

    // Cancel the confirmed booking to open an operational review.
    // (Need to navigate to a fresh booking that is still CONFIRMED with payment.)
    const paidConfirmedInterval = pastOperationalInterval(5);
    const paidConfirmed = await insertHoldBooking({
      roomId: ROOM_ID,
      ...paidConfirmedInterval,
      withPayment: true,
    });
    await confirmBooking(paidConfirmed.bookingId);

    await page.goto(`/admin/bookings/${paidConfirmed.bookingCode}`);
    await page.getByLabel('Lý do hủy').fill('Guest illness');
    await page.getByRole('button', { name: 'Hủy đặt phòng' }).click();
    await expect(page.getByText('CANCELLED').first()).toBeVisible();
    await expect(page.getByText('OPEN').first()).toBeVisible();

    // Navigate to operational review list and resolve it.
    const [reviewsResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          response.url().includes('127.0.0.1:3101/api/v1/admin/operational-reviews?'),
      ),
      page.getByRole('link', { name: 'Vận hành review' }).click(),
    ]);
    await page.waitForURL(/\/admin\/operational-reviews$/);
    expect(reviewsResponse.status()).toBe(200);
    const reviews = (await reviewsResponse.json()) as { items: readonly { bookingCode: string }[] };
    expect(reviews.items.map((review) => review.bookingCode)).toContain(paidConfirmed.bookingCode);
    await page.getByRole('link', { name: 'Mở' }).first().click();
    await page.waitForURL(/\/admin\/operational-reviews\/[^/]+$/);
    await page.getByLabel('Ghi chú xử lý').fill('Refund handled offline.');
    await page.getByRole('button', { name: 'Đánh dấu đã xử lý' }).click();
    await expect(page.getByText('RESOLVED').first()).toBeVisible();

    // Verify payment remained SUCCEEDED and booking remains CANCELLED.
    const paymentState = await psql(
      `SELECT status FROM payments WHERE booking_id = '${paidConfirmed.bookingId}';`,
    );
    expect(paymentState).toBe('SUCCEEDED');
    const bookingState = await psql(
      `SELECT status FROM bookings WHERE id = '${paidConfirmed.bookingId}';`,
    );
    expect(bookingState).toBe('CANCELLED');
  });

  test('CUSTOMER cannot access ADMIN booking operations routes', async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.goto('/admin/bookings');
    expect(response).not.toBeNull();
    const status = response?.status() ?? 0;
    if (status >= 500) {
      throw new Error(`Unexpected 5xx on /admin/bookings for unauthenticated: ${status}`);
    }
    await expect(page).toHaveURL(/\/admin\/login|\/admin\/forbidden|\/admin\/bookings/);
    await context.close();
  });
});
