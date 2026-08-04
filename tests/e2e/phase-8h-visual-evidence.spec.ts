import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

async function captureOnce(page: Page, path: string) {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
  }
}

test('captures Phase 8H server-backed operations evidence', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await expect(page.getByText('Doanh thu gộp')).toBeVisible();
  await captureOnce(page, 'output/playwright/phase-8h-operational-report-desktop.png');

  await page.goto('/admin/rooms');
  await expect(page.locator('#room-board-heading')).toBeVisible();
  await captureOnce(page, 'output/playwright/phase-8h-room-operations-desktop.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.room-board-list > li').first()).toBeVisible();
  await captureOnce(page, 'output/playwright/phase-8h-room-operations-mobile.png');
});
