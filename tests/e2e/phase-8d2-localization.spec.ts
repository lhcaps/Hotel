import { expect, test, type Page } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';
import { fillHourlySearch } from './public-search-helpers';

const OIDC_BASE_URL = process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL;
const WEB_BASE_URL = 'http://127.0.0.1:3100';
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
] as const;

const criticalVietnameseUiPhrases = [
  'Tìm phòng',
  'Nhận phòng',
  'Trả phòng',
  'Người lớn',
  'Đăng nhập',
  'Quản trị',
  'Gói giá',
  'Đối soát thanh toán',
] as const;

if (OIDC_BASE_URL === undefined) {
  throw new Error(
    'PLAYWRIGHT_TEST_OIDC_BASE_URL is not set; global setup did not start the OIDC server',
  );
}

async function switchToEnglish(page: Page): Promise<void> {
  if ((await page.locator('html').getAttribute('lang')) === 'en') return;
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}

async function expectEnglishCriticalUi(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const text = await page.locator('body').innerText();
  for (const phrase of criticalVietnameseUiPhrases) {
    expect(text, `unexpected Vietnamese UI phrase: ${phrase}`).not.toContain(phrase);
  }
}

async function expectResponsiveLayout(page: Page): Promise<void> {
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    clippedLabels: [...document.querySelectorAll('label')].filter((label) => {
      const rect = label.getBoundingClientRect();
      return rect.left < -1 || rect.right > window.innerWidth + 1;
    }).length,
    offscreenPrimaryActions: [...document.querySelectorAll('button, a')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const label = (element.textContent ?? '').trim();
      return (
        label.length > 0 &&
        rect.width > 0 &&
        element.closest('table') === null &&
        (rect.left < -1 || rect.right > window.innerWidth + 1)
      );
    }).length,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.clippedLabels).toBe(0);
  expect(layout.offscreenPrimaryActions).toBe(0);
}

async function queueOidcUser(page: Page, suffix: string): Promise<void> {
  const response = await page.request.post(`${OIDC_BASE_URL}/test/set-next-user`, {
    data: {
      sub: `phase-8d2-${suffix}`,
      email: `phase-8d2-${suffix}@playwright.test`,
      name: 'Phase 8D2 Customer',
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function signInCustomerInEnglish(page: Page): Promise<void> {
  await page.goto(`${WEB_BASE_URL}/login`);
  await switchToEnglish(page);
  await queueOidcUser(page, 'customer');
  await Promise.all([
    page.waitForURL(/\/account\/bookings$/),
    page.getByTestId('test-identity-button').click(),
  ]);
}

async function signInAdminInEnglish(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await switchToEnglish(page);
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Password').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('Phase 8D.2 localized critical browser acceptance', () => {
  test('keeps English through public search, keyboard locale control, and reload', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/booking/search');
    await page.getByRole('button', { name: 'English' }).focus();
    await expect(page.getByRole('button', { name: 'English' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Find a room' })).toBeVisible();
    await expectEnglishCriticalUi(page);

    await fillHourlySearch(page, {
      date: '2027-01-10',
      start: '11:00:00',
      end: '14:00:00',
    });
    await expect(page.getByRole('heading', { name: 'Nami' })).toBeVisible();
    await expect(
      page
        .getByTestId('availability-room-10000000-0000-4000-8000-000000000201')
        .getByRole('link', { name: 'View room & price' }),
    ).toBeVisible();
    await expectEnglishCriticalUi(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Find a room' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('keeps English through deterministic customer login, profile, bookings, and logout', async ({
    page,
  }) => {
    await signInCustomerInEnglish(page);
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
    await expectEnglishCriticalUi(page);

    await page.goto('/account/profile');
    await expect(page.getByRole('heading', { name: 'Customer profile' })).toBeVisible();
    await page.getByLabel('Address line 1').fill('42 English locale lane');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status')).toHaveText('Profile saved.');
    await page.reload();
    await expect(page.getByLabel('Address line 1')).toHaveValue('42 English locale lane');
    await expectEnglishCriticalUi(page);

    await page.request.post('http://127.0.0.1:3101/api/auth/sign-out');
    await page.goto('/account/bookings');
    await expect(page.getByRole('link', { name: 'Sign in to view your bookings.' })).toBeVisible();
  });

  test('keeps English through admin navigation and responsive critical page shells', async ({
    page,
  }) => {
    await signInAdminInEnglish(page);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const path of [
        '/admin/rate-plans',
        '/admin/coupons',
        '/admin/bookings',
        '/admin/operational-reviews',
        '/admin/payments',
      ]) {
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        await expectEnglishCriticalUi(page);
        await expectResponsiveLayout(page);
      }
    }
  });
});
