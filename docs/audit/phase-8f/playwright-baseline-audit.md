# Phase 8F Playwright Baseline Audit

## Scope

Audited `3267f58270b7474c11e1654c412e6d2ad9843a97` and the Phase 8F harness changes. The deterministic suite remains local-only: it starts a loopback OIDC server and a loopback payment simulator, uses a guarded disposable PostgreSQL database, Mailpit, and separate `.next-playwright` output.

## Findings

- `scripts/playwright-runtime.mjs` generates a 256-bit Better Auth secret and a policy-compliant ADMIN password in memory when values are omitted. Explicit valid values are preserved; invalid explicit values are rejected.
- `scripts/run-playwright.mjs` and `apps/api/test/playwright-global-setup.ts` now resolve the Node/Corepack pnpm executable and use `shell: false`, including Windows paths containing spaces.
- Runtime values are inherited by every setup child process and are not written to repository files or test artifacts.
- Playwright uses `.next-playwright`; demo uses `.next-demo`; both are ignored.
- The global setup creates only loopback OIDC and payment-simulator endpoints. No test configuration uses Google, MoMo, VNPAY, or SMTP public endpoints.
- The suite uses one worker and zero retries. Setup cleanup owns API `3101`, web `3100`, worker, OIDC `3420`, and simulator resources. It does not take ownership of port `3001`.
- The separate unavailable-API configuration is invoked through the same direct process boundary.

## Verdicts

```text
PLAYWRIGHT_BASELINE_AUDIT=PASS
DETERMINISTIC_EXTERNAL_NETWORK_CALLS=0
PLAYWRIGHT_SECRET_LEAKS=0
PLAYWRIGHT_RETRIES=0
PLAYWRIGHT_NEXT_OUTPUT=.next-playwright
DEMO_NEXT_OUTPUT=.next-demo
```

The full deterministic count and two final runs are recorded in `validation-report.md` after Phase 8F validation completes.
