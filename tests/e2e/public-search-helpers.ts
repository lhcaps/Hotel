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
  await page.getByTestId('availability-check-in-date').fill(input.date);
  await page.getByTestId('availability-check-in-time').fill(toInputTime(input.start));
  await page
    .getByTestId('availability-check-out-date')
    .fill(input.end > input.start ? input.date : nextDay(input.date));
  await page.getByTestId('availability-check-out-time').fill(toInputTime(input.end));
  await page.getByTestId('availability-adults').fill(input.adults ?? '2');
  await page.getByTestId('availability-children').fill(input.children ?? '0');
  await page.getByTestId('availability-submit').click();
}

export async function fillOvernightSearch(
  page: Page,
  input: { readonly date: string; readonly window?: '21-09' | '22-10'; readonly adults?: string },
) {
  const window = input.window ?? '21-09';
  const [checkInTime, checkOutTime] = window === '22-10' ? ['22:00', '10:00'] : ['21:00', '09:00'];
  await page.getByTestId('availability-check-in-date').fill(input.date);
  await page.getByTestId('availability-check-in-time').fill(checkInTime);
  await page.getByTestId('availability-check-out-date').fill(nextDay(input.date));
  await page.getByTestId('availability-check-out-time').fill(checkOutTime);
  await page.getByTestId('availability-adults').fill(input.adults ?? '2');
  await page.getByTestId('availability-children').fill('0');
  await page.getByTestId('availability-submit').click();
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function toInputTime(value: string): string {
  return value.slice(0, 5);
}
