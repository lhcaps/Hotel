const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

if (password === undefined || password.length === 0) {
  throw new Error('PLAYWRIGHT_ADMIN_PASSWORD is required for authenticated Playwright tests.');
}

export const playwrightAdminEmail = 'admin.playwright@example.test';
export const playwrightAdminPassword = password;
