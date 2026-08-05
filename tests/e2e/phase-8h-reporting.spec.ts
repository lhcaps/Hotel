import { expect, test } from '@playwright/test';

import { playwrightAdminEmail, playwrightAdminPassword } from './admin-credentials';

test('ADMIN reads the authoritative operational report and applies a date range', async ({
  page,
}) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(playwrightAdminEmail);
  await page.getByLabel('Mật khẩu').fill(playwrightAdminPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const report = page.getByRole('main');
  await expect(report.getByText('Doanh thu gộp')).toBeVisible();
  await expect(
    report.getByText(
      'Doanh thu còn phải thu chưa có cho đến khi hệ thống hỗ trợ thanh toán một phần.',
    ),
  ).toBeVisible();
  await page.getByLabel('Từ ngày').fill('2026-07-01');
  await page.getByRole('textbox', { name: 'Đến ngày' }).fill('2026-07-31');
  await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect(
    page
      .getByText(/Không có đặt phòng nào khớp với khoảng thời gian này.|Doanh thu theo ngày/)
      .first(),
  ).toBeVisible();
});
