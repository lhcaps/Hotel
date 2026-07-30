// scripts/demo/rehearse.mjs
//
// Phase 6F human-visible browser rehearsal. Runs a small subset of the
// existing Playwright specs against the live demo (3100/3101) so a
// presenter can see the browser render before the deadline demo.
//
// Flags:
//   --headed            : run Playwright in headed mode (default in
//                         this script; --headless disables it)
//   --workers=<n>       : forwarded to Playwright
//   --grep=<pattern>    : forwarded to Playwright
//   --slowmo=<ms>       : forwarded to Playwright (cosmetic only; does
//                         not alter assertions)
//
// The script never invokes video or trace by default. Screenshots are
// taken at major milestones via the existing specs (Playwright config
// retains `trace: off` here).
//
// Module-load gate repair: `tests/e2e/admin-credentials.ts` and several
// OIDC-coupled specs read `PLAYWRIGHT_ADMIN_PASSWORD` and
// `PLAYWRIGHT_TEST_OIDC_BASE_URL` at module-load time. The standard
// Playwright `globalSetup` injects those values, but the rehearse
// config deliberately omits globalSetup because the demo is already up.
// Without these env vars, the specs throw at import time even when the
// caller's `--grep` would have excluded them. To keep `pnpm demo:rehearse`
// loadable and exit 0, we inject placeholder env vars at module-load time
// here. The actual spec selection happens via Playwright's `--grep`; the
// placeholders only unblock module import so the rehearsal can run.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WINDOWS = process.platform === 'win32';

const args = process.argv.slice(2);
const headed = !args.includes('--headless');
// Strip both `--headed` and `--headless` so they don't reach the
// Playwright CLI; `--headless` is not a Playwright option (the default
// is already headless), and `--headed` is added explicitly below when
// the presenter wants to see the browser.
const filtered = args.filter((a) => !['--headed', '--headless'].includes(a));

// Resolve the demo's per-run admin password from the manifest the
// orchestrator writes (Phase 6F start.mjs). Without this, the
// `admin-credentials.ts` module-level guard throws at import time even
// for specs the user did not select via `--grep`. We mirror
// `scripts/demo/smoke.mjs`'s discovery: read the manifest, validate the
// password filename shape, and require the file mtime to be at least as
// recent as the manifest (so a previous demo's password cannot leak).
const MANIFEST_FILENAME = 'room-management-demo-state.json';
const MANIFEST_PATH = process.env.DEMO_STATE_FILE ?? join(tmpdir(), MANIFEST_FILENAME);
const PASSWORD_PATTERN = /^room-management-demo-admin-[a-f0-9]{16}\.txt$/;

function resolveAdminPassword() {
  if (!existsSync(MANIFEST_PATH)) return '';
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return '';
  }
  const passwordPath =
    manifest && typeof manifest === 'object' && typeof manifest.passwordPath === 'string'
      ? manifest.passwordPath
      : '';
  if (!passwordPath) return '';
  const basename = passwordPath.split(/[\\/]/).pop() ?? '';
  if (!PASSWORD_PATTERN.test(basename)) return '';
  if (!existsSync(passwordPath)) return '';
  try {
    if (statSync(passwordPath).mtimeMs < statSync(MANIFEST_PATH).mtimeMs - 5000) {
      return '';
    }
  } catch {
    return '';
  }
  try {
    return readFileSync(passwordPath, 'utf8').trim();
  } catch {
    return '';
  }
}

const adminPassword = resolveAdminPassword();

// Always preserve demo contracts. `PAYMENT_TEST_ADMIN_EMAIL` mirrors the
// production-time defaults in `payment-test-helpers.mjs` so any
// accidentally-included admin spec still resolves a recipient.
const env = {
  ...process.env,
  PLAYWRIGHT_TEST_BASE_URL: 'http://127.0.0.1:3100',
  // Module-load gates. The values are placeholders: `admin-credentials.ts`
  // only checks for presence/length, and the OIDC specs only dereference
  // the URL inside test bodies (which the presenter's `--grep` should
  // skip anyway).
  PLAYWRIGHT_ADMIN_PASSWORD: adminPassword || 'demo-rehearse-placeholder-password',
  PLAYWRIGHT_TEST_OIDC_BASE_URL:
    process.env.PLAYWRIGHT_TEST_OIDC_BASE_URL ?? 'http://127.0.0.1:3420',
  PAYMENT_TEST_ADMIN_EMAIL: 'admin.demo@example.local',
};

const commandArgs = [
  'exec',
  'playwright',
  'test',
  '--config=playwright.rehearse.config.ts',
  ...(headed ? ['--headed'] : []),
  ...filtered,
];

const executable = WINDOWS ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const finalArgs = WINDOWS ? ['/d', '/s', '/c', 'pnpm', ...commandArgs] : commandArgs;

const child = spawn(executable, finalArgs, { env, stdio: 'inherit', windowsHide: true });
child.once('exit', (code) => process.exit(code ?? 1));
