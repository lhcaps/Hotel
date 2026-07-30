import { expect, test, type Page } from '@playwright/test';

/**
 * Stage M — focused Playwright identity vertical.
 *
 * This file focuses on the parts of the customer identity surface that
 * can be exercised end-to-end without a real Google OAuth round-trip:
 *
 *   - The customer login page renders the configured CUSTOMER sign-in
 *     affordance (Google when NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true,
 *     otherwise the deterministic test-oidc control) and the "guest
 *     access" fallback.
 *   - Unauthenticated navigation to /account/profile surfaces a
 *     friendly login prompt instead of leaking server errors.
 *
 * The Google OAuth happy path is covered by the deterministic OAuth
 * integration suite (apps/api/test/integration/customer-oauth.*.test.ts);
 * running the full Better Auth HTTP roundtrip through Chromium without
 * a real Google session is not safe, so we keep the live Playwright
 * assertions scoped to the static and unauthenticated UI.
 *
 * The Playwright global setup enables the deterministic test-oidc
 * switch so the authenticated browser vertical
 * (`customer-identity-browser.spec.ts`) can sign in without real
 * Google credentials; in that configuration the login page surfaces
 * the `test-identity-button` instead of the Google button. This file
 * accepts either affordance so the same assertions run against both
 * configurations.
 */

const PRIMARY_AFFORDANCE_BUTTON = 'Đăng nhập bằng Google';
const TEST_AFFORDANCE_TESTID = 'test-identity-button';

async function expectPrimaryAffordance(page: Page): Promise<void> {
  const googleButton = page.getByRole('button', { name: PRIMARY_AFFORDANCE_BUTTON });
  const testButton = page.getByTestId(TEST_AFFORDANCE_TESTID);
  const googleVisible = await googleButton.isVisible().catch(() => false);
  if (googleVisible) {
    await expect(googleButton).toBeVisible();
  } else {
    await expect(testButton).toBeVisible();
  }
}

test.describe('customer identity — login surface', () => {
  test('login page renders CUSTOMER sign-in affordance and guest fallback', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Đăng nhập khách hàng' })).toBeVisible();
    await expectPrimaryAffordance(page);
    await expect(page.getByRole('button', { name: 'Truy cập đặt phòng của tôi' })).toBeVisible();
  });

  test('unauthenticated /account/profile surfaces the login prompt', async ({ page }) => {
    await page.goto('/account/profile');
    await expect(page.getByText(/đăng nhập/i).first()).toBeVisible();
  });

  test('root account index redirects to bookings page', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account\/bookings$/);
  });
});
