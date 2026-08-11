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
    // Global setup normally provides the isolated URL.
  }
  return (
    process.env.PLAYWRIGHT_TEST_DATABASE_URL ??
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

const databaseRequire = createRequire(join(process.cwd(), 'packages', 'database', 'package.json'));
const { Pool } = databaseRequire('pg') as {
  readonly Pool: new (config: Record<string, unknown>) => TestDatabasePool;
};
const databasePool = new Pool({
  connectionString: resolveDatabaseUrl(),
  max: 1,
  application_name: 'room-management-playwright-room-viewer',
});

// Matches the property seeded by playwright-global-setup.ts (seedPlaywrightCatalog).
const PLAYWRIGHT_PROPERTY_ID = '10000000-0000-4000-8000-000000000001';

async function setViewerRole(role: 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER'): Promise<void> {
  await databasePool.query(`UPDATE users SET role = $1 WHERE lower(email) = lower($2)`, [
    role,
    playwrightAdminEmail,
  ]);
  await databasePool.query(
    `UPDATE admin_memberships
        SET role = $1
      WHERE user_id = (SELECT id FROM users WHERE lower(email) = lower($2))
        AND status = 'ACTIVE'`,
    [role, playwrightAdminEmail],
  );
  if (role === 'ROOM_STATUS_VIEWER') {
    // Non-SUPER_ADMIN roles require an explicit property membership row —
    // the bootstrap admin user is created after migration 0034's backfill
    // runs, so it has none by default.
    await databasePool.query(
      `INSERT INTO admin_property_memberships (user_id, property_id, status)
       SELECT id, $1::uuid, 'ACTIVE' FROM users WHERE lower(email) = lower($2)
       ON CONFLICT DO NOTHING`,
      [PLAYWRIGHT_PROPERTY_ID, playwrightAdminEmail],
    );
  }
  await databasePool.query(
    `DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE lower(email) = lower($1))`,
    [playwrightAdminEmail],
  );
}

async function loginAsViewer(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/\/admin\/room-operations$/);
  await page.waitForLoadState('domcontentloaded');
}

test.describe('ROOM_STATUS_VIEWER_CONTEXT', () => {
  test.afterAll(async () => {
    await setViewerRole('SUPER_ADMIN');
    await databasePool.end();
  });

  test('has only read-only room status navigation and API authority', async ({ page }) => {
    await setViewerRole('ROOM_STATUS_VIEWER');
    try {
      await loginAsViewer(page);
      await expect(page.locator('.admin-content .admin-page h1')).toBeVisible();
      await expect(page.locator('nav a[href="/admin/room-operations"]')).toBeVisible();
      await expect(page.locator('nav a[href="/admin/payments"]')).toHaveCount(0);
      await expect(page.locator('nav a[href="/admin/accounts"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Refresh board|Làm mới bảng/ })).toBeVisible();

      await page.goto('/admin/payments');
      await page.waitForURL(/\/admin\/room-operations$/);

      const cookies = await page.context().cookies('http://127.0.0.1:3100');
      const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
      const apiBase = 'http://127.0.0.1:3101/api/v1';
      const readResponse = await page.request.get(
        `${apiBase}/admin/room-operations?from=2027-02-10T00:00:00.000Z&to=2027-02-10T08:00:00.000Z`,
        { headers: { cookie: cookieHeader } },
      );
      expect(readResponse.status()).toBe(200);
      const readBody = await readResponse.text();
      expect(readBody).not.toMatch(/bookingCode/);

      const mutationResponse = await page.request.patch(
        `${apiBase}/admin/rooms/10000000-0000-0000-0000-000000000301`,
        {
          headers: { cookie: cookieHeader, 'content-type': 'application/json' },
          data: { roomNumber: 'viewer-must-not-write' },
        },
      );
      expect(mutationResponse.status()).toBe(403);
    } finally {
      await setViewerRole('SUPER_ADMIN');
    }
  });
});
