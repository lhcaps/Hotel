# Project production-readiness reconciliation

**Date:** 2026-07-26  
**Baseline / final branch:** `phase5-booking-hold-guest-access`  
**Starting commit:** `3042c25fb8cbc41eaf280e2091f3147747187065`  
**Scope:** Phase 0 through 7C implemented-scope reconciliation. Phase 7C adds only provider-independent payment persistence and settlement; no real provider adapter/credential, checkout UI, customer Google identity, translation, SSL deployment, refund, or MANAGER role is implemented.

## Verdicts

| Verdict                         | Result                      | Basis                                                                                                                                     |
| ------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PHASE_7B_DELIVERY`             | `PASS`                      | Correctness, typing, integration and focused browser checks are now evidenced.                                                            |
| `IMPLEMENTED_SCOPE_QUALITY`     | `PASS_WITH_DOCUMENTED_DEBT` | Critical exercised paths pass; remaining production/deployment requirements are not claimed complete.                                     |
| `CUSTOMER_REQUIREMENT_COVERAGE` | `PARTIAL`                   | Booking/pricing/coupon core exists; payment, Google CUSTOMER identity, translation and deployment edge do not.                            |
| `PRODUCTION_READINESS`          | `NO`                        | No approved payment provider/webhook, production edge/TLS, deployment target, production secrets/SMTP proof, or backup/restore rehearsal. |

## Phase truth table

| Phase    | Intended scope                                                               | Current evidence                                                    | Verdict                |
| -------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- |
| 0–2      | Modular monolith, PostgreSQL authority, migrations                           | Governing docs, schema and `pnpm db:check`                          | `VERIFIED`             |
| 3–4      | Secure admin catalog; availability, integer-VND pricing and immutable quotes | API/web/unit/integration coverage; quote immutability integration   | `VERIFIED`             |
| 5        | Atomic HOLD, guest OTP, outbox worker                                        | Public booking vertical Playwright passes                           | `VERIFIED`             |
| 6 / 6D–F | Coupon core, public/admin flow, lifecycle tooling                            | Coupon E2E and full runner pass                                     | `VERIFIED`             |
| 7A       | Customer gap reconciliation                                                  | Current source still confirms payment/identity/i18n/deployment gaps | `PARTIAL`              |
| 7B       | Data-driven pricing selection                                                | Corrected matcher/configuration, migrations and UI/API vertical     | `VERIFIED`             |
| 7C       | Provider-independent payment aggregate, attempts and event settlement        | Local core and race coverage; no external provider integration      | `VERIFIED_LOCAL_CORE`  |
| 7D       | MoMo sandbox adapter, initiation, verified IPN and read-only return          | Deterministic local conformance and database settlement evidence    | `LIVE_SANDBOX_PENDING` |

## Corrected Phase 7B findings

1. Pricing configuration errors now share `PricingConfigurationError` while retaining stable subclass codes. Base-price absence produces `PRICING_PRICE_MISSING`; required `EXTRA_HOUR` absence produces `PRICING_EXTRA_PRICE_MISSING`.
2. Public calculation validates active base candidates and the selected winner only. Malformed inactive or draft plans no longer block unrelated quotes. Administrative mutation remains strict through the finite-grid validator.
3. Active-tier coverage is validated for every finite-grid winner from PostgreSQL-derived active room-type tier IDs; both base and required extra-hour prices must be positive safe integers.
4. Matcher metadata rejects unsafe priority, duration, window, pair/nullability and cross-midnight cases, including `includedDurationMinutes > maxDurationMinutesInclusive`.
5. Property timezone is supplied from `properties.timezone` by `QuoteRepository`; the matcher receives it explicitly. The development seed retains `Asia/Ho_Chi_Minh`.
6. The root TypeScript solution is an intentionally empty `files: []` project, eliminating TS18003 without globbing the monorepo.
7. Integration fixture drift after migration 0011 and a real Drizzle camelCase/raw-row mapper defect in rate-plan updates were fixed. The admin selection update path now returns normalized rate-plan data.

## Security and configuration

`SEC-CONFIG-001` is fixed. Worker production placeholder-secret validation no longer returns early for loopback SMTP. SMTP credentials remain required only for production non-loopback SMTP. Tests assert API/worker parity, safe field-only errors, production loopback rejection with placeholders, and non-production placeholder allowance.

## Migration and contract evidence

- Database status: `phase-7c-payment-core-v1` ready.
- `pnpm db:check`: pass; migrations 0000–0010 unchanged from `94e29d6`.
- Migration 0011 was not edited. `rate_plans_priority_ck` and `rate_plans_priority_safe_int_ck` are equivalent duplicate constraints: `REDUNDANT_NON_BLOCKING`; no 0012 migration is justified.
- OpenAPI check passes (admin 29 operations; public 9 operations).

## Quality gates

- API pricing unit tests: 27 passed; API unit: 136 passed; focused API integration: 14 passed.
- Config unit tests: 7 passed.
- Full root lint, typecheck, unit and build: passed. Existing React `act()` warnings remain non-failing test-harness noise.
- Playwright: 23 passed, 1 documented conditional skip; unavailable-API configuration: 1 passed. The shared disposable E2E database requires `workers: 1`; this removes session/data cross-test races.
- Dependency audit: zero high vulnerabilities (1 low, 1 moderate remain).

## Remaining customer gap matrix / roadmap

| Requirement                                                           | Status                                                                                              | Next dependency-aware phase                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Booking, availability, data-driven combo pricing, admin pricing rules | Implemented                                                                                         | Maintain with regression gates             |
| Coupons                                                               | Partial: quote/HOLD/admin core exists; verified-payment redemption and campaign distribution absent | 7F after payment core                      |
| MoMo / VNPAY                                                          | Missing                                                                                             | 7C payment core, then 7D MoMo and 7E VNPAY |
| Google CUSTOMER identity and profile                                  | Missing; local-password wording conflicts with Google-only wording                                  | 7G after customer decision                 |
| Vietnamese/English translation                                        | Missing and scope ambiguous                                                                         | 7H after a localisation decision           |
| SSL / CB / RP                                                         | Deployment-only; acronyms unresolved                                                                | 7I after approved deployment target        |

## Phase 7C production boundary

`PRODUCTION_READINESS` remains **NO**. Phase 7D supplies a sandbox-only MoMo adapter but does not prove live sandbox acceptance, production merchant activation, TLS/edge deployment, operations or reconciliation. Credentials remain environment-only and must never enter database rows, audit payloads or logs. Planned progression: 7E VNPAY, 7F client selection and ADMIN non-secret operations, 7G reconciliation.

## Issue register

| Severity | Finding                                                                                                                | Disposition                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| P1       | Phase 7B configuration hierarchy, active-tier validation, inactive-plan semantics, timezone ownership and root TS gate | Fixed                                                                  |
| P1       | `SEC-CONFIG-001` worker loopback SMTP bypass                                                                           | Fixed                                                                  |
| P1       | Rate-plan Drizzle row mapping and 0011 integration fixture drift                                                       | Fixed                                                                  |
| P2       | Production deployment/backup/SMTP/TLS/monitoring proof                                                                 | Roadmap; blocks production readiness, not local implemented-scope gate |
| P3       | Low/moderate dependency advisories; non-failing React test warnings                                                    | Documented debt                                                        |
