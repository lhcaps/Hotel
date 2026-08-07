# PeaceNest Operations V3 - Phase A correction baseline

Date: 2026-08-07

## Current B0 local release state

B0 is complete in the current local worktree. The implementation includes the
additive 0029 pricing-policy release, V1-derived draft bootstrap, published
policy composer, same-room full-interval availability, quote V2 snapshot,
transactional HOLD/booking/payment/access/lifecycle compatibility, customer
and admin surfaces, and the multi-night whole-booking cancellation regression.
The public multi-night gate remains OFF by default. No production migration,
configuration change, data write, deployment, commit, or push was performed.

The remainder of this file preserves the earlier Phase A/B0.1 assessment as
historical evidence; it is not the current B0 capability verdict.

## Historical Phase A repository baseline

| Command                         | Sanitized faithful output                             |
| ------------------------------- | ----------------------------------------------------- |
| `git rev-parse HEAD`            | `f02d49a26d0972bc05a5c71da4400d2d62e6afb6`            |
| `git branch --show-current`     | `main`                                                |
| `git status --short`            | `?? docs/operations-v3.zip`; `?? docs/operations-v3/` |
| `git diff --name-only`          | empty                                                 |
| `git diff --cached --name-only` | empty                                                 |

The worktree is **not clean**: the existing Phase A documentation directory and an untracked `docs/operations-v3.zip` are preserved. No source, test, migration, journal, package, lockfile, production data, commit, push, or deployment was changed by this correction pass.

Production baseline supplied by the governing brief: `f02d49a26d0972bc05a5c71da4400d2d62e6afb6`. Admin V2 remains closed; no contradictory reproducible evidence was found.

## Authoritative material read

`AGENT_RULES.md`, `README.md`, `DESIGN.md`, `API_CONTRACT.md`, `AUTH_RBAC_POLICY.md`, `DB_MIGRATION_POLICY.md`, `TESTING_STRATEGY.md`, `RELEASE_CHECKLIST.md`, `OBSERVABILITY_POLICY.md`, `MCP_SECURITY_POLICY.md`, `FRONTEND_RULES.md`, relevant `docs/domain/**`, `docs/product/**`, `docs/engineering/**`, both supplied Phase A briefs, and the current `docs/operations-v3/**` packet were read before documentation changes.

## Repository-grounded authority map

- Database schema: `packages/database/src/schema.ts`.
- Contract authority: `packages/contracts/src/pricing.ts`, `packages/contracts/src/booking/hold.ts`, `packages/contracts/src/booking/booking-detail.ts`, `packages/contracts/src/customer.ts`, and `packages/contracts/src/admin.ts`.
- Public search: `apps/web/src/components/availability-search-form.tsx`, `apps/web/src/lib/booking-search-state.ts`, `apps/web/src/components/availability-search-results.tsx`, `apps/web/src/lib/admin-api.ts`.
- API policy/availability/pricing/quote: `apps/api/src/pricing/stay-policy.ts`, `availability.repository.ts`, `quote.repository.ts`, `selection-rule-matcher.ts`, and `cheapest-eligible-pricing.ts`.
- HOLD and allocation: `packages/booking/src/services/create-booking-hold.ts` and `packages/booking/src/repository/availability.ts`.
- Lifecycle: `apps/api/src/booking/services/admin-booking-lifecycle.service.ts` and `apps/api/src/customer/customer-booking.service.ts`.
- Payment authority: `packages/booking/src/payment/payment-service.ts`, `apps/api/src/payment/*webhook.controller.ts`, and read-only return controllers.
- Access: `apps/api/src/booking/services/booking-access-pass.service.ts` and `booking-detail.service.ts`.
- Worker: `apps/worker/src/scheduler/worker-scheduler.ts`, `worker-runner.ts`, `main.ts`, and the four current jobs.
- Auth/RBAC: `packages/auth/src/permissions.ts`, `apps/api/src/auth/auth.providers.ts`, `admin-permission.guard.ts`, and `packages/auth/test/permissions.test.ts`.

## Current schema facts

`properties` has timezone and stay-policy columns. `quotes` and `bookings` store one immutable interval and JSON pricing snapshots. `bookings` has one `room_id`, one optional `quote_id`, one cancellation snapshot, one access-pass version/revocation pair, and a 31-day check constraint. `room_inventory_blocks` has booking/maintenance source checks, half-open interval values, one booking unique index, and the historical `room_inventory_blocks_active_overlap_excl` GiST exclusion constraint from `0001_custom_invariants.sql`. `payments` has a unique `(property_id, booking_id)` aggregate. `housekeeping_tasks` has `ARRIVAL_PREP` and `TURNOVER`, with unique `(booking_id, type)`. `audit_events` is append-only through a trigger.

## Historical Phase A capability summary

- Interval parsing: **PARTIALLY_SUPPORTED**; contracts and DB permit up to 31 days, but client hourly construction caps at 24 hours and overnight policy is exact one-night.
- Full-interval availability and same-room HOLD allocation: **SUPPORTED_ALREADY** for intervals accepted by policy; both use the complete requested interval.
- Multi-night pricing: **NOT_SUPPORTED** beyond 1,440 minutes; the current engine is one base plan plus optional extra-hour units.
- Quote/HOLD/booking/payment: **PARTIALLY_SUPPORTED** as one aggregate chain; upstream multi-night pricing and contract metadata are missing.
- Access: **PARTIALLY_SUPPORTED**; one on-demand HMAC QR pass expires at checkout plus one hour, with no T-30 scheduled issuance.
- Checkout/turnover: **SUPPORTED_ALREADY** for one final checkout and one idempotent final `TURNOVER` task; no nightly transition is present.
- RBAC: **PARTIALLY_SUPPORTED**; actual profiles are only `SUPER_ADMIN` and `ROOM_STATUS_VIEWER`.

Local database observations in this historical section are
`LOCAL_DEVELOPMENT_EVIDENCE_ONLY`; they do not establish production inventory
or production configuration.

Fresh focused correction-pass evidence: API 6 files/59 tests PASS; web 3
files/16 tests PASS; auth 5 files/23 tests PASS; worker scheduler/runner 2
files/24 tests PASS. The full selected worker command remains PARTIAL because
the housekeeping reminder fixture requires `TEST_DATABASE_URL`. Selected
database integration remains BLOCKED at setup for the same missing variable;
`pnpm db:status` reports the local schema version as
`booking-access-pass-v1`, matching the expected version. These results are
local evidence only and do not establish external provider or production
readiness.

## B0.1 historical evidence addendum

B0.1 is now present only as an additive contract and stay-policy foundation in
the six tracked files listed by the B0.1 handoff. Fresh local evidence for that
foundation is:

- guarded PostgreSQL integration: **PASS**, 3 files / 18 tests;
- `pnpm db:check`: **PASS**;
- public `multi_night` request/offer paths remain dark and fail closed;
- no schema, migration, journal, snapshot, package, lockfile, production data,
  commit, push, or deployment was changed by B0.1.

These are local-development observations only and do not rewrite production
facts or convert the historical `DB_INTEGRATION_STATUS` boundary into a
production readiness claim.

## Historical B0.2 catalog gate

B0.2 was historically blocked before pricing composition. The current catalog had
`rate_plans` fields for status, priority, `is_base_plan`, included duration,
selection duration bounds, and check-in windows; `rate_plan_prices` has
price-tier amounts in integer VND. It does not authoritatively express whether
a component is repeatable, which component pairs may combine before/after one
another, effective start/end instants, or an immutable rule/version identity.
Known plan codes and labels are not permission to infer those semantics.

The historical checkpoint therefore did not include a multi-night composer,
quote change, availability change, HOLD change, booking change, public UI/API
exposure, schema change, or migration. That statement is retained as a dated
historical boundary and does not describe the current local B0 release.

Phase A correction was design-only, B0.1 was foundation-only, and the current
local B0 pass has since implemented the approved additive runtime boundary.
