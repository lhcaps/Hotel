import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

function resolveDatabaseUrl(): string {
  try {
    const value = readFileSync(join(tmpdir(), 'playwright-test-database-url.txt'), 'utf8').trim();
    if (value.length > 0) return value;
  } catch {
    // Fall through to the explicit test environment.
  }
  return (
    process.env.PLAYWRIGHT_TEST_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    'postgresql://room:room@127.0.0.1:5432/room_management_test_base'
  );
}

interface TestDatabasePool {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[] }>;
  end(): Promise<void>;
}

interface MailpitMessage {
  readonly ID: string;
  readonly To: readonly { readonly Address: string }[];
  readonly Subject: string;
}

const databaseRequire = createRequire(join(process.cwd(), 'packages', 'database', 'package.json'));
const { Pool } = databaseRequire('pg') as {
  readonly Pool: new (config: Record<string, unknown>) => TestDatabasePool;
};
const databasePool = new Pool({
  connectionString: resolveDatabaseUrl(),
  max: 1,
  application_name: 'room-management-playwright-phase-8d-coupon-delivery',
});

const MAILPIT_API = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025';
const PROPERTY_ID = '10000000-0000-4000-8000-000000000001';
const ROOM_TYPE_ID = '10000000-0000-4000-8000-000000000201';
const ROOM_ID = '10000000-0000-4000-8000-000000000301';

async function listMailpitMessages(): Promise<readonly MailpitMessage[]> {
  const response = await fetch(`${MAILPIT_API}/api/v1/messages`);
  if (!response.ok) throw new Error(`Mailpit messages request failed: ${response.status}`);
  const body = (await response.json()) as { messages?: readonly MailpitMessage[] };
  return body.messages ?? [];
}

async function readMailpitMessage(id: string): Promise<string> {
  const response = await fetch(`${MAILPIT_API}/api/v1/message/${id}`);
  if (!response.ok) throw new Error(`Mailpit message read failed: ${response.status}`);
  const body = (await response.json()) as { readonly Text?: string; readonly HTML?: string };
  return body.Text ?? body.HTML ?? '';
}

async function deleteMailpitMessage(id: string): Promise<void> {
  await fetch(`${MAILPIT_API}/api/v1/message/${id}`, { method: 'DELETE' });
}

async function waitForCouponEmail(recipient: string, couponCode: string): Promise<MailpitMessage> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const messages = await listMailpitMessages();
    const match = messages.find(
      (message) =>
        message.To.some((entry) => entry.Address === recipient) &&
        /coupons for booking/i.test(message.Subject),
    );
    if (match !== undefined) {
      const body = await readMailpitMessage(match.ID);
      if (body.includes(couponCode)) return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Mailpit did not receive coupon ${couponCode} for ${recipient}`);
}

test.describe('Phase 8D coupon delivery vertical', () => {
  test.afterAll(async () => {
    await databasePool.end();
  });

  test('ADMIN queues a coupon from booking detail and the worker delivers it to the stored contact', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const bookingId = randomUUID();
    const couponId = randomUUID();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const bookingCode = `8D-${suffix}`;
    const couponCode = `D8${suffix}`;
    const recipient = `coupon-${suffix.toLowerCase()}@playwright.test`;

    await databasePool.query(
      `INSERT INTO bookings
         (id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children,
          currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot, hold_expires_at)
       VALUES ($1, $2, $3, $4, $5, 'HOLD', date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 day', date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 day 3 hours',
               1, 0, 'VND', 359000, 0, 359000, '{"ratePlanCode":"LUNCH_COMBO"}'::jsonb,
               CURRENT_TIMESTAMP + interval '30 minutes')`,
      [bookingId, PROPERTY_ID, ROOM_TYPE_ID, ROOM_ID, bookingCode],
    );
    await databasePool.query(
      `INSERT INTO booking_contacts
         (booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
       VALUES ($1, 'Phase 8D Delivery', $2, '+84909000008',
               decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'))`,
      [bookingId, recipient],
    );
    await databasePool.query(
      `INSERT INTO room_inventory_blocks
         (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
       VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 day', date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 day 3 hours')`,
      [PROPERTY_ID, ROOM_ID, bookingId],
    );
    await databasePool.query(
      `INSERT INTO coupons
         (id, property_id, normalized_code, status, discount_type, fixed_amount_vnd,
          percentage_basis_points, maximum_discount_vnd, minimum_order_amount_vnd, valid_from, valid_until,
          applies_to_all_room_types, total_usage_limit, per_customer_limit)
       VALUES ($1, $2, $3, 'ACTIVE', 'FIXED', 10000, NULL, NULL, 0,
               CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP + interval '30 days', true, NULL, NULL)`,
      [couponId, PROPERTY_ID, couponCode],
    );

    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(playwrightAdminEmail);
    await page.locator('input[type="password"]').fill(playwrightAdminPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/);

    await page.goto(`/admin/bookings/${bookingCode}`);
    await expect(page.getByRole('heading', { name: `Đặt phòng ${bookingCode}` })).toBeVisible();
    const couponDelivery = page.locator('section[aria-labelledby="coupon-delivery-heading"]');
    await expect(couponDelivery).toBeVisible();
    await couponDelivery.getByRole('checkbox', { name: couponCode }).check();
    await couponDelivery
      .locator('label')
      .filter({ hasText: couponCode })
      .last()
      .locator('input')
      .check();

    const [deliveryResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith(`/admin/bookings/${bookingCode}/send-coupons`),
      ),
      couponDelivery.locator('button[type="submit"]').click(),
    ]);
    expect(deliveryResponse.status()).toBe(201);
    await expect(couponDelivery.getByRole('status')).toBeVisible();

    let mailpitMessage: MailpitMessage | undefined;
    try {
      mailpitMessage = await waitForCouponEmail(recipient, couponCode);
      const body = await readMailpitMessage(mailpitMessage.ID);
      expect(body).toContain(couponCode);
      expect(body).toContain(bookingCode);
      const delivery = await databasePool.query<{ status: string }>(
        'SELECT status FROM coupon_delivery_requests WHERE booking_id = $1',
        [bookingId],
      );
      expect(delivery.rows).toEqual([{ status: 'SENT' }]);
      const coupon = await databasePool.query<{ status: string }>(
        'SELECT status FROM coupons WHERE id = $1',
        [couponId],
      );
      expect(coupon.rows).toEqual([{ status: 'ACTIVE' }]);
    } finally {
      if (mailpitMessage !== undefined) await deleteMailpitMessage(mailpitMessage.ID);
    }
  });
});
