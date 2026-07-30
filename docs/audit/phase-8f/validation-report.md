# Phase 8F Validation Report

## Implementation baseline

- Starting HEAD: `3267f58270b7474c11e1654c412e6d2ad9843a97`
- Branch: `phase5-booking-hold-guest-access`
- Database schema: `phase-8d-client-acceptance-v1`
- Validation date: 2026-07-29

## Repository-owned checks

```text
pnpm check:providers=PASS
pnpm check:google-oauth=PASS
pnpm check:features=PASS
pnpm check:i18n-critical=PASS
pnpm check:endpoints=PASS
pnpm check:openapi=PASS
pnpm lint=PASS
pnpm typecheck=PASS
pnpm test:unit=PASS
pnpm build=PASS
pnpm db:check=PASS
pnpm db:status=PASS
pnpm db:test=PASS (22 files, 165 tests)
pnpm audit --prod --audit-level=high=PASS (0 high; 1 moderate, 1 low reported)
pnpm demo:preflight=PASS
pnpm demo:lifecycle-test=PASS (15/15)
pnpm demo:smoke=PASS (22/22)
```

## Deterministic browser acceptance

The reported 69-test claim was audited against the actual repository. The main Playwright configuration currently contains 68 tests. The package command additionally runs the separate unavailable-API configuration with 1 test. Both package runs used one worker, zero retries, loopback-only provider simulators, and released ports `3090`, `3100`, `3101`, `3102`, and `3420` afterward.

```text
DETERMINISTIC_PLAYWRIGHT_RUN_1=68 passed main + 1 passed unavailable, exit 0, duration 83.826s
DETERMINISTIC_PLAYWRIGHT_RUN_2=68 passed main + 1 passed unavailable, exit 0, duration 85.893s
DETERMINISTIC_PROVIDER_NETWORK_CALLS=0
PLAYWRIGHT_SECRET_LEAKS=0
```

## Live acceptance readiness

The commands were intentionally invoked only as configuration guards. They made no public-provider request and stopped before a manual checkpoint.

```text
GOOGLE_CODE_READINESS=PASS
GOOGLE_LIVE_LOCAL=BLOCKED_MISSING_USER_CREDENTIALS
MOMO_CODE_READINESS=PASS
MOMO_SANDBOX_LIVE=BLOCKED_MISSING_MERCHANT_CREDENTIALS
VNPAY_CODE_READINESS=PASS
VNPAY_SANDBOX_LIVE=BLOCKED_MISSING_MERCHANT_CREDENTIALS
SMTP_CODE_READINESS=PASS
SMTP_LIVE=BLOCKED_MISSING_SMTP_CREDENTIALS
PUBLIC_CALLBACK_CODE_READINESS=PASS
PUBLIC_HTTPS_CALLBACK=EXTERNAL_BLOCKED
PHASE_8F_PROVIDER_ACTIVATION_READY=PASS
PHASE_8F_LIVE_EXTERNAL_ACCEPTANCE=BLOCKED
PRODUCTION_READINESS=NO
```

## External blockers

- Google Cloud credentials, exact callback registration, and a manual sign-in checkpoint are not configured.
- MoMo sandbox merchant credentials and stable public HTTPS return/IPN callbacks are not configured.
- VNPAY sandbox merchant credentials and stable public HTTPS return/IPN callbacks are not configured.
- A provider-backed SMTP identity and dedicated synthetic test recipient are not configured.
- Production remains blocked on provider accounts, public TLS infrastructure, deployment, monitoring, backup/restore, and operational security approval.
