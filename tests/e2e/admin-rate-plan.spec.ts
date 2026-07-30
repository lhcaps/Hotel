import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

async function issueQuoteAt(
  page: import('@playwright/test').Page,
  checkIn: string,
  durationHours = 3,
) {
  const checkOut = new Date(
    new Date(checkIn).getTime() + durationHours * 60 * 60 * 1000,
  ).toISOString();
  const response = await page.request.post('http://127.0.0.1:3101/api/v1/quotes', {
    data: {
      roomTypeId: '10000000-0000-4000-8000-000000000201',
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test('ADMIN updates an active rate-plan price and sees the persisted value after reload', async ({
  page,
}) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.locator('input[type="password"]').fill(playwrightAdminPassword);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/rate-plans');
  const plan = page.getByRole('article', { name: /Lunch combo/i });
  const price = plan.getByRole('spinbutton', { name: /Lunch combo/i });
  await expect(price).toBeEnabled();
  await price.fill('369000');
  await price.locator('xpath=ancestor::li').getByRole('button').click();
  await expect(price).toHaveValue('369000');
  await page.reload();
  await expect(
    page
      .getByRole('article', { name: /Lunch combo/i })
      .getByRole('spinbutton', { name: /Lunch combo/i }),
  ).toHaveValue('369000');
  await price.fill('359000');
  await price.locator('xpath=ancestor::li').getByRole('button').click();
  await expect(price).toHaveValue('359000');
});

test('ADMIN changes the lunch boundary through the UI and historical quotes remain immutable', async ({
  page,
}) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.locator('input[type="password"]').fill(playwrightAdminPassword);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/rate-plans');
  const lunch = page.getByRole('article', { name: /Lunch combo/i });
  await expect(lunch).toBeVisible();
  const lunchPrice = lunch.getByRole('spinbutton', { name: /Lunch combo/i });
  await lunchPrice.fill('200000');
  const [priceResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/admin\/rate-plans\/[^/]+\/prices\/[^/]+$/.test(response.url()),
    ),
    lunchPrice.locator('xpath=ancestor::li').getByRole('button').click(),
  ]);
  expect(priceResponse.ok()).toBeTruthy();
  await expect(lunch.getByRole('spinbutton', { name: /Lunch combo/i })).toHaveValue('200000');
  const rules = lunch.getByRole('combobox');
  await rules.nth(2).selectOption('15:15');
  await expect(lunch.getByRole('button').nth(1)).toBeEnabled();
  const [firstRuleResponse] = await Promise.all([
    page.waitForResponse(/\/admin\/rate-plans\/.*\/selection-rule$/),
    lunch.getByRole('button').nth(1).click(),
  ]);
  expect(firstRuleResponse.ok()).toBeTruthy();
  await expect(firstRuleResponse.json()).resolves.toMatchObject({
    maxCheckInMinuteExclusive: 915,
  });

  const quoteA = await issueQuoteAt(page, '2027-01-12T08:00:00.000Z', 5);
  expect(quoteA.pricing).toMatchObject({ selectedPlanCode: 'LUNCH_COMBO' });

  await rules.nth(2).selectOption('15:00');
  const [secondRuleResponse] = await Promise.all([
    page.waitForResponse(/\/admin\/rate-plans\/.*\/selection-rule$/),
    lunch.getByRole('button').nth(1).click(),
  ]);
  expect(secondRuleResponse.ok()).toBeTruthy();
  await expect(secondRuleResponse.json()).resolves.toMatchObject({
    maxCheckInMinuteExclusive: 900,
  });
  const quoteB = await issueQuoteAt(page, '2027-01-12T08:00:00.000Z', 5);
  expect(quoteB.pricing).toMatchObject({ selectedPlanCode: 'FIVE_HOUR_COMBO' });

  const reread = await page.request.get(`http://127.0.0.1:3101/api/v1/quotes/${quoteA.id}`);
  expect(reread.ok()).toBeTruthy();
  await expect(reread.json()).resolves.toMatchObject({
    pricing: { selectedPlanCode: 'LUNCH_COMBO' },
  });

  const restoredLunchPrice = lunch.getByRole('spinbutton', { name: /Lunch combo/i });
  await restoredLunchPrice.fill('359000');
  const [restoreResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/admin\/rate-plans\/[^/]+\/prices\/[^/]+$/.test(response.url()),
    ),
    restoredLunchPrice.locator('xpath=ancestor::li').getByRole('button').click(),
  ]);
  expect(restoreResponse.ok()).toBeTruthy();
});
