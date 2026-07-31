import { test, expect } from '@playwright/test';
import path from 'node:path';
import process from 'node:process';

const BASE = 'http://localhost:3000';
const ADMIN_EMAIL = 'demo-verify@room.local';
const ADMIN_PASSWORD = 'Aa1-KnownVerifyPass-1234';
const SCREENSHOT_DIR = path.resolve(process.cwd(), '.toolcache');

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test(`screenshots at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(BASE + '/admin/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[name=email]', ADMIN_EMAIL);
    await page.fill('input[name=password]', ADMIN_PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/admin/, { timeout: 10_000 }).catch(() => null);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `screenshot-${vp.name}-admin.png`),
      fullPage: false,
    });
    await page.goto(BASE + '/admin/rooms');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `screenshot-${vp.name}-rooms.png`),
      fullPage: false,
    });
  });
}
