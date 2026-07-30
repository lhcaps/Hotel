# Phase 8E.1 Validation Report

## Baseline

- Branch: `phase5-booking-hold-guest-access`
- Starting HEAD: `db670bd4c411eb4849cb5691f2cc3f2e4f2c3ebb`
- Schema: `phase-8d-client-acceptance-v1`
- Protected port 3001: `FREE` before and after demo acceptance

## Runtime and Harness Closure

- Playwright credentials are resolved per process by `scripts/playwright-runtime.mjs`. Missing `PLAYWRIGHT_BETTER_AUTH_SECRET` and `PLAYWRIGHT_ADMIN_PASSWORD` are generated securely and are not committed defaults.
- Direct and package-script Playwright execution share the same runtime resolver.
- Playwright and demo Next.js outputs are isolated as `.next-playwright` and `.next-demo`.
- Process launchers use direct executable and argument-array invocations; the repository-owned `shell: true` API integration harness was removed.
- Demo lifecycle distinguishes `FREE` from `OCCUPIED(pid)` and verifies protected port 3001 stays unchanged.
- `/api/v1/customer/profile/session` is documented as a public session probe and removes anonymous-profile 401 console noise without exposing profile data.

## Executed Acceptance

- `node scripts/playwright-runtime.test.mjs`: passed
- `node scripts/demo/protected-port-state.test.mjs`: passed
- `pnpm --filter @room/api exec vitest run test/playwright-database-setup.test.ts`: passed
- `pnpm --filter @room/api exec vitest run test/integration/vertical-api.integration.test.ts`: 1 file / 4 tests passed
- `pnpm test:unit`: 15/15 tasks, 50 API files / 301 tests passed
- `pnpm db:test`: 22 files / 165 tests passed
- `pnpm lint`: 9/9 tasks passed
- `pnpm typecheck`: 9/9 tasks passed
- `pnpm build`: 9/9 tasks passed
- `pnpm check:endpoints`: passed after OpenAPI regeneration for the session probe
- `pnpm check:openapi`: 36 ADMIN and 18 public operations validated
- `pnpm check:i18n-critical`: 73 critical source files scanned, 0 direct Vietnamese copy findings
- `pnpm check:features`: core booking, SMTP Mailpit, and worker ready; external providers disabled
- `pnpm demo:preflight`: passed with reconciled `phase-8d-client-acceptance-v1` schema evidence
- `pnpm demo:lifecycle-test`: 15/15 passed; internal demo smoke 22/22 passed; 3100/3101 released; owned PIDs, database, password file, and manifest cleaned up
- `pnpm demo:smoke`: executed sequentially after lifecycle acceptance
- `pnpm test:e2e` pass 1: 68 main tests plus 1 unavailable-API test passed
- `pnpm test:e2e` pass 2: 68 main tests plus 1 unavailable-API test passed

## Known External Limits

Live Google OAuth, payment-provider sandbox, production SMTP, and public-domain callback acceptance remain external-environment concerns because non-production provider credentials and public HTTPS callback infrastructure are not present locally. These providers are intentionally disabled by local feature configuration and do not block deterministic repository acceptance.

## Verdict

Phase 8E.1 deterministic local acceptance is complete. Playwright passed twice, demo lifecycle passed with cleanup verification, the protected port state is preserved, and static, unit, database, OpenAPI, build, and product diagnostics are green.
