import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Playwright database setup', () => {
  it('uses a guarded disposable database lifecycle outside API startup', () => {
    const config = readFileSync(new URL('../../../playwright.config.ts', import.meta.url), 'utf8');
    const setupUrl = new URL('./playwright-global-setup.ts', import.meta.url);

    expect(config).toContain("globalSetup: './apps/api/test/playwright-global-setup.ts'");
    expect(existsSync(setupUrl)).toBe(true);
    if (!existsSync(setupUrl)) {
      return;
    }
    const setup = readFileSync(setupUrl, 'utf8');
    expect(config).not.toMatch(/db:migrate|\/room_management(?:['"]|$)/);
    expect(setup).toContain('createPreparedGuardedTestDatabase');
    expect(setup).toContain('room_management_test_base');
    expect(setup).toContain('migrateTestDatabase(database.databaseUrl)');
    expect(setup).toContain('DATABASE_URL: databaseUrl');
    expect(setup).toContain('DATABASE_URL: database.databaseUrl');
    expect(setup).toContain('await database.dispose()');
    expect(setup).toMatch(/catch[\s\S]*cleanup[\s\S]*throw/);
    expect(setup).toContain('resolvePnpmInvocation');
    expect(setup).toContain('shell: false');
    expect(setup).not.toContain("shell: process.platform === 'win32'");
  });

  it('requires an ephemeral Playwright ADMIN password instead of a committed default', () => {
    const setupUrl = new URL('./playwright-global-setup.ts', import.meta.url);
    const packageUrl = new URL('../../../package.json', import.meta.url);
    const runnerUrl = new URL('../../../scripts/run-playwright.mjs', import.meta.url);
    const configUrl = new URL('../../../playwright.config.ts', import.meta.url);
    const runtimeUrl = new URL('../../../scripts/playwright-runtime.mjs', import.meta.url);
    const e2eDirectory = new URL('../../../tests/e2e/', import.meta.url);
    const committedDefaultPassword = ['Playwright', 'Admin', 'Password', '42'].join('-');
    const committedAuthSecret = [
      'playwright',
      'test',
      'secret',
      'that',
      'is',
      'never',
      'persisted',
      '1234',
    ].join('-');

    expect(readFileSync(packageUrl, 'utf8')).toContain('node scripts/run-playwright.mjs');
    expect(readFileSync(runnerUrl, 'utf8')).toContain('resolvePlaywrightRuntime(process.env)');
    expect(readFileSync(configUrl, 'utf8')).toContain('ensurePlaywrightRuntime()');
    expect(readFileSync(runtimeUrl, 'utf8')).toContain('PLAYWRIGHT_BETTER_AUTH_SECRET');
    expect(readFileSync(runtimeUrl, 'utf8')).toContain('PLAYWRIGHT_ADMIN_PASSWORD');
    expect(readFileSync(setupUrl, 'utf8')).toContain('process.env.PLAYWRIGHT_ADMIN_PASSWORD');
    expect(readFileSync(setupUrl, 'utf8')).toContain('process.env.PLAYWRIGHT_BETTER_AUTH_SECRET');
    expect(readFileSync(setupUrl, 'utf8')).not.toContain(committedDefaultPassword);
    expect(readFileSync(setupUrl, 'utf8')).not.toContain(committedAuthSecret);

    for (const filename of readdirSync(e2eDirectory)) {
      if (!filename.endsWith('.spec.ts')) continue;
      expect(readFileSync(new URL(filename, e2eDirectory), 'utf8')).not.toContain(
        committedDefaultPassword,
      );
    }
  });
});
