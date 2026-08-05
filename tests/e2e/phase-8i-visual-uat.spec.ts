import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';
import { fillHourlySearch } from './public-search-helpers';

const OIDC_BASE_URL = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;

if (OIDC_BASE_URL === undefined) {
  throw new Error(
    'PLAYWRIGHT_TEST_OIDC_BASE_URL is not set; global setup did not start the OIDC server',
  );
}

async function capture(page: Page, name: string): Promise<void> {
  const path = `output/playwright/phase-8i/${name}.png`;
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: true, caret: 'initial' });
}

async function switchToEnglish(page: Page): Promise<void> {
  if ((await page.locator('html').getAttribute('lang')) === 'en') return;
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}

async function signInAsCustomer(page: Page): Promise<void> {
  const response = await page.request.post(`${OIDC_BASE_URL}/test/set-next-user`, {
    data: {
      sub: 'phase-8i-customer',
      email: 'phase-8i-customer@example.test',
      name: 'Phase 8I Customer',
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto('/login');
  await switchToEnglish(page);
  await page.getByTestId('test-identity-button').click();
  await expect(page).toHaveURL(/\/account\/bookings$/);
}

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await switchToEnglish(page);
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Password').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('captures 13 Phase 8I client-UAT surfaces with isolated synthetic data', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await switchToEnglish(page);
  await expect(
    page.getByRole('heading', { name: 'Comfortable stays, on your terms' }),
  ).toBeVisible();
  await capture(page, '01-public-entry-desktop');

  await fillHourlySearch(page, {
    date: '2027-04-10',
    start: '11:00:00',
    end: '14:00:00',
  });
  const results = page.getByLabel('Available room types');
  await expect(results.getByRole('heading', { name: 'Nami' })).toBeVisible();
  await capture(page, '02-availability-results-desktop');

  await results
    .getByTestId('availability-room-10000000-0000-4000-8000-000000000201')
    .getByRole('link', { name: 'View room & price' })
    .click();
  await page.waitForURL(/\/rooms\//);
  await expect(page.getByRole('button', { name: 'View official price' })).toBeVisible();
  await page.getByRole('button', { name: 'View official price' }).click();
  await expect(page.getByRole('heading', { name: 'Pay & book' })).toBeVisible();
  await capture(page, '03-hold-contact-desktop');

  await signInAsCustomer(page);
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
  await capture(page, '04-customer-bookings-desktop');

  await page.goto('/account/profile');
  await expect(page.getByRole('heading', { name: 'Customer profile' })).toBeVisible();
  await capture(page, '05-customer-profile-desktop');

  await signInAsAdmin(page);
  await expect(page.getByText('Gross revenue')).toBeVisible();
  await page.getByLabel('From').fill('2027-07-10');
  await page.getByRole('textbox', { name: 'To' }).fill('2027-07-14');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('heading', { name: 'Daily revenue' })).toBeVisible();
  await capture(page, '06-admin-report-nonempty-desktop');

  await page.goto('/admin/rooms');
  await expect(
    page.getByRole('heading', { name: /Room operations board|Tình trạng phòng/ }),
  ).toBeVisible();
  await capture(page, '07-admin-room-operations-desktop');

  await page.goto('/admin/bookings');
  await expect(page.locator('main')).toBeVisible();
  await capture(page, '08-admin-bookings-desktop');

  await page.goto('/admin/payments');
  await expect(page.locator('main')).toBeVisible();
  await capture(page, '09-admin-payments-desktop');

  await page.goto('/admin/rate-plans');
  await expect(page.locator('main')).toBeVisible();
  await capture(page, '10-admin-rate-plans-desktop');

  await page.goto('/admin/operational-reviews');
  await expect(page.locator('main')).toBeVisible();
  await capture(page, '11-admin-operational-reviews-desktop');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/rooms');
  await expect(
    page.getByRole('heading', { name: /Room operations board|Tình trạng phòng/ }),
  ).toBeVisible();
  await capture(page, '12-admin-room-operations-mobile');

  await page.goto('/admin');
  await page.getByLabel('From').fill('2027-07-10');
  await page.getByRole('textbox', { name: 'To' }).fill('2027-07-14');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('heading', { name: 'Daily revenue' })).toBeVisible();
  await capture(page, '13-admin-report-nonempty-mobile');
});
