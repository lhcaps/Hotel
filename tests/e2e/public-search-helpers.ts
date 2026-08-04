import type { Page } from '@playwright/test';

export async function fillHourlySearch(
  page: Page,
  input: {
    readonly date: string;
    readonly start: string;
    readonly end: string;
    readonly adults?: string;
    readonly children?: string;
  },
) {
  await page.getByTestId('availability-mode-hourly').click();
  await page.getByTestId('availability-hourly-date').fill(input.date);
  await page.getByTestId('availability-hourly-start').fill(input.start);
  await page.getByTestId('availability-hourly-end').fill(input.end);
  await page.getByTestId('availability-adults').fill(input.adults ?? '2');
  await page.getByTestId('availability-children').fill(input.children ?? '0');
  await page.getByTestId('availability-submit').click();
}

export async function fillOvernightSearch(
  page: Page,
  input: { readonly date: string; readonly window?: '21-09' | '22-10'; readonly adults?: string },
) {
  await page.getByTestId('availability-mode-overnight').click();
  await page.getByTestId('availability-overnight-date').fill(input.date);
  await page
    .getByRole('button', { name: input.window === '22-10' ? /22:00.*10:00/ : /21:00.*09:00/ })
    .click();
  await page.getByTestId('availability-adults').fill(input.adults ?? '2');
  await page.getByTestId('availability-children').fill('0');
  await page.getByTestId('availability-submit').click();
}
