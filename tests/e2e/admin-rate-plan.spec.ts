import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

async function savePlanPrice(
  page: import('@playwright/test').Page,
  plan: import('@playwright/test').Locator,
  tierName: string,
  amount: number,
): Promise<void> {
  await plan.locator('[data-slot="dropdown-menu-trigger"]').click();
  await page.getByRole('menuitem', { name: 'Lưu giá' }).click();
  const sheet = page.getByRole('dialog');
  const input = sheet.getByRole('spinbutton', { name: new RegExp(`${tierName}$`, 'i') });
  await input.fill(String(amount));
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'PATCH' &&
        /\/admin\/rate-plans\/[^/]+\/prices\/[^/]+$/.test(candidate.url()),
    ),
    input
      .locator('xpath=ancestor::div[contains(@class, "admin-price-editor")]')
      .getByRole('button', { name: 'Lưu giá' })
      .click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(input).toHaveValue(String(amount));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

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
  await savePlanPrice(page, plan, 'Deluxe', 369000);
  await page.reload();
  await savePlanPrice(page, page.getByRole('article', { name: /Lunch combo/i }), 'Deluxe', 359000);
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
  await savePlanPrice(page, lunch, 'Deluxe', 200000);
  await lunch.locator('[data-slot="dropdown-menu-trigger"]').click();
  await page.getByRole('menuitem', { name: 'Điều kiện áp dụng' }).click();
  let selectionDialog = page.getByRole('dialog');
  const rules = selectionDialog.getByRole('combobox');
  await rules.nth(2).click();
  await page.getByRole('option', { name: '15:15' }).click();
  const saveSelection = selectionDialog.getByRole('button', { name: 'Lưu điều kiện' });
  await expect(saveSelection).toBeEnabled();
  const [firstRuleResponse] = await Promise.all([
    page.waitForResponse(/\/admin\/rate-plans\/.*\/selection-rule$/),
    saveSelection.click(),
  ]);
  expect(firstRuleResponse.ok()).toBeTruthy();
  await expect(firstRuleResponse.json()).resolves.toMatchObject({
    maxCheckInMinuteExclusive: 915,
  });

  const quoteA = await issueQuoteAt(page, '2027-01-12T08:00:00.000Z', 5);
  expect(quoteA.pricing).toMatchObject({ selectedPlanCode: 'LUNCH_COMBO' });

  await lunch.locator('[data-slot="dropdown-menu-trigger"]').click();
  await page.getByRole('menuitem', { name: 'Điều kiện áp dụng' }).click();
  selectionDialog = page.getByRole('dialog');
  await selectionDialog.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: '15:00' }).click();
  const secondSaveSelection = selectionDialog.getByRole('button', { name: 'Lưu điều kiện' });
  const [secondRuleResponse] = await Promise.all([
    page.waitForResponse(/\/admin\/rate-plans\/.*\/selection-rule$/),
    secondSaveSelection.click(),
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

  await savePlanPrice(page, lunch, 'Deluxe', 359000);
});
