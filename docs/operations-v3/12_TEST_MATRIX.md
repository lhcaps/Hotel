# Concrete Phase B0 test matrix

## Historical Phase A evidence (initial run; date/status retained)

This historical block is retained for audit context. Initial database
integration was `BLOCKED` because `TEST_DATABASE_URL` was missing; the failure
was not evidence of a passing database gate.

| Phase/date context               | Evidence/status                                                                |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Phase A historical database gate | `BLOCKED`: missing `TEST_DATABASE_URL`; database-backed PASS was not inferred. |

## Historical B0.1 and B0.2 evidence (retained)

The table below is retained as earlier phase evidence. It is not the final B0
verdict; the fresh hardening gate results are recorded after it.

| Phase/date context           | Evidence/status                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| B0.1 current loopback guard  | `PASS`                                                                                              |
| B0.1 current DB naming guard | `PASS`: generated `room_management_test_<uuid>` naming guard.                                       |
| B0.1 current schema check    | `PASS`: `pnpm db:check`.                                                                            |
| B0.1 current PostgreSQL gate | `PASS`: guarded disposable PostgreSQL integration, 3 files / 18 tests.                              |
| B0.2 migration preflight     | `PASS`: journal tail was 0028; new forward migration is 0029 only; prior migrations unchanged.      |
| B0.2 fresh PostgreSQL gate   | `PASS`: `pricing-policy-release-migration.test.ts`, 45 tests = 40 schema/invariant + 5 concurrency. |
| B0.2 upgrade PostgreSQL gate | `PASS`: `pricing-policy-migration-upgrade.test.ts`, 1 guarded 0028 -> 0029 upgrade test.            |
| B0.2 schema/type/lint gates  | `PASS`: `pnpm db:check`, database typecheck, and database lint.                                     |
| B0.2 change scope            | Historical catalog-only boundary; superseded by the current local B0 implementation.                |

## Current B0 hardening matrix (local only)

| Gate                  | Fresh local evidence                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Policy/migration      | 0029 additive release, matching snapshot/journal/provenance, fresh and upgrade disposable PostgreSQL tests                              |
| Pricing/availability  | Composer exact coverage, same-room full interval, maintenance/conflict rejection, structured errors                                     |
| Transaction/lifecycle | One quote/HOLD/booking/payment/block, concurrent final-room HOLD race, cancellation release, access revocation, final checkout/turnover |
| Browser               | Canonical flows, B0 feature-gated flow, structured unavailable flow, UI responsive/accessibility coverage                               |
| Release hygiene       | Formatting, lint, typecheck, unit, build, OpenAPI, endpoints, i18n, secret scan, `pnpm verify`                                          |

All evidence is local/disposable. No production migration, configuration,
catalog bootstrap, data write, deployment, commit, or push is implied.

No B0.2 public runtime reader/composer, production migration, production write,
deployment, commit, or push evidence is claimed here.

## Historical acceptance cases and original test plan (retained)

The table below is retained as the original phase plan. The current B0
hardening evidence above supersedes its `Missing` and `Partially covered`
labels; those labels are not current release verdicts.

| Requirement                                  | Test layer and exact proposed file                                                                                                                    | Fixture/assertion/concurrency/external dependency                       | Current status                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| One night V1 unchanged                       | API `apps/api/test/pricing-engine.test.ts`; web `apps/web/test/public-homepage.test.tsx`; E2E `tests/e2e/phase-8b1-stay-time-recommendations.spec.ts` | Existing candidate/result remains identical; no external provider       | Existing coverage; must extend regression after B0 |
| Two and three nights                         | API `apps/api/test/pricing-cheapest.test.ts`; integration `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts`                         | Exact duration and component total                                      | Missing                                            |
| Cross-month/year/leap day                    | API `apps/api/test/stay-policy.test.ts`; DB `packages/database/test/integration/booking-constraints.test.ts`                                          | Property timezone and instant arithmetic                                | Missing                                            |
| Exact maximum and one minute above           | API stay-policy/pricing tests; DB booking constraints                                                                                                 | Policy max accepted; above rejected with explicit code                  | Missing; current pricing cap is 1,440              |
| Same room for complete interval              | DB `packages/database/test/integration/inventory-overlap.test.ts`; booking `packages/booking/src/services/create-booking-hold.test.ts`                | `booking.room_id` remains one id; full `[)` block                       | Partially covered for short intervals              |
| Room free only part of interval              | DB inventory-overlap and API availability integration                                                                                                 | No candidate/room if any middle segment conflicts                       | Missing                                            |
| Maintenance in a middle night                | DB `apps/api/test/integration/maintenance.integration.test.ts` and inventory-overlap                                                                  | Active maintenance block rejects full interval                          | Missing multi-night case                           |
| Booking conflict in a middle night           | DB inventory-overlap/availability integration                                                                                                         | No room stitching or split                                              | Missing                                            |
| Touching interval                            | DB inventory-overlap                                                                                                                                  | `[a,b)` and `[b,c)` coexist                                             | Existing invariant; add explicit assertion         |
| Concurrent HOLD and exactly one winner       | Booking `packages/booking/src/services/create-booking-hold.retry.test.ts`; DB/API `apps/api/test/integration/gate-b9-race-matrix.integration.test.ts` | Two transactions, one exclusion winner, one retry/conflict              | Existing race family; add multi-night fixture      |
| One quote, HOLD, booking, payment aggregate  | API `quote.integration.test.ts`, `public-booking.integration.test.ts`, `momo-payment.integration.test.ts`                                             | One ids/row/amount; no nightly records                                  | Partially covered                                  |
| Exact pricing coverage/no gap/no overlap     | API pricing tests                                                                                                                                     | Component union equals requested interval                               | Missing                                            |
| Repeated overnight only when catalog permits | API pricing tests and rate-plan integration                                                                                                           | Explicit catalog flag/rule; otherwise reject                            | Missing                                            |
| Extra before/after                           | API pricing tests                                                                                                                                     | Component boundaries cover requested interval exactly                   | Missing                                            |
| Lowest valid total                           | API `pricing-cheapest.test.ts`                                                                                                                        | Invalid candidates excluded before price comparison                     | Existing one-component only                        |
| Equal total fewer components                 | API pricing test                                                                                                                                      | Deterministic component-count tie-break                                 | Missing                                            |
| Stable deterministic result                  | API pricing/engine tests                                                                                                                              | Same catalog/input produces same candidate id/reason                    | Existing stable plan tie-break; extend             |
| Missing price/inactive component             | API `pricing-cheapest.test.ts`; integration rate-plan tests                                                                                           | Fail closed; no client fallback                                         | Existing error families; extend                    |
| Effective-date crossing                      | DB/API pricing integration                                                                                                                            | Snapshot uses effective catalog at quote time                           | Missing                                            |
| Quote/HOLD expiry/idempotency                | `quote.integration.test.ts`; booking HOLD tests                                                                                                       | Expired quote cannot create; repeated same contact returns same booking | Existing; extend multi-night                       |
| Customer list/detail                         | API customer module tests; web `customer-bookings.a11y.test.tsx`                                                                                      | One interval/booking; no physical room code                             | Existing shape; extend fields                      |
| Admin list/detail                            | API `admin-booking-lifecycle.integration.test.ts`; E2E `phase-7g-admin-booking-operations.spec.ts`                                                    | Full interval/selection snapshot and authorized room data               | Existing; extend fields                            |
| Whole-booking cancellation                   | `packages/booking/src/cancellation-policy.test.ts`; customer/lifecycle integration                                                                    | One cancellation, one release, snapshot unchanged                       | Existing HOLD/CONFIRMED; retain                    |
| Partial-night/shorten/extend                 | Customer service tests                                                                                                                                | Must remain preview/deferred until business decision                    | Current alteration is preview-only                 |
| No nightly checkout                          | lifecycle integration; E2E booking flow                                                                                                               | No intermediate state/task/block                                        | Missing explicit multi-night                       |
| One final checkout/release/turnover          | lifecycle integration; `apps/worker/test/process-housekeeping-reminders.test.ts`                                                                      | One `CHECKED_OUT`, one release, one DIRTY, one TURNOVER                 | Existing implementation; add idempotency assertion |
| Duplicate checkout                           | lifecycle integration                                                                                                                                 | Second call rejects; no duplicate task/release                          | Missing explicit assertion                         |
| Continuous access                            | `apps/api/test/booking/booking-access-pass.service.test.ts`, customer/detail tests                                                                    | Expiry equals final checkout + grace; version/revocation honored        | Existing pass; extend multi-night                  |
| T-30 provider flow                           | Later provider integration test                                                                                                                       | External provider required; not a B0 PASS                               | NOT_SUPPORTED/DEFERRED                             |
| Payment webhook/browser return               | payment adapter/IPN tests, return controller tests                                                                                                    | Verified callback only; browser return no mutation                      | Existing; regression required                      |
| ROOM_STATUS_VIEWER allow/deny                | `packages/auth/test/permissions.test.ts`, `apps/web/test/admin-navigation.test.tsx`, `tests/e2e/room-status-viewer.spec.ts`                           | Exact seven grants and denied booking/payments/accounts/audit/mutations | Existing accepted behavior                         |
| Worker compatibility                         | `apps/worker/src/scheduler/worker-scheduler.test.ts`, `worker-runner.test.ts`                                                                         | Existing four jobs; no nightly job/split                                | Existing; add no-split assertions                  |

All database cases require a disposable PostgreSQL `TEST_DATABASE_URL`; never a persistent or production database. External payment/access providers remain separately gated.

## Historical B0.2 catalog-release plan (retained)

The migration/invariant cases below document the earlier catalog-only plan.
The current local B0 implementation and fresh hardening evidence cover the
application, pricing-composer, public-gated, and multi-night cases as well;
production exposure remains dark until release approval.

### PostgreSQL and migration tests

| Area                       | Proposed test/evidence                                               | Required assertion                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft policy creation/edit | `apps/api/test/integration/pricing-policy-draft.integration.test.ts` | Authorized draft creation/edit works; direct SQL cannot bypass ownership or lifecycle rules.                                                                           |
| Atomic publication         | `pricing-policy-publication.integration.test.ts`                     | Complete root/components/prices/edges validate and publish in one transaction; failed validation publishes nothing.                                                    |
| Effective schedule         | `pricing-policy-effective-period.integration.test.ts`                | Same-property published overlap is rejected; `[a,b)` touching `[b,c)` is accepted; basis consistency is enforced separately.                                           |
| Supersession closure       | `pricing-policy-supersession.integration.test.ts`                    | Old PUBLISHED policy remains selectable before cutover, successor is selectable at cutover, and closure never retires prematurely.                                     |
| Immutable releases         | `pricing-policy-immutability.integration.test.ts`                    | UPDATE/DELETE of PUBLISHED or RETIRED root/components/prices/edges fails; only approved closure and lifecycle metadata transitions are allowed.                        |
| Cancellation               | `pricing-policy-release-migration.test.ts`                           | DRAFT -> CANCELLED succeeds; cancelled rows are immutable; PUBLISHED -> CANCELLED is rejected by migration 0029 and deferred for a future typed-snapshot/no-gap phase. |
| Basis consistency          | `pricing-policy-basis.integration.test.ts`                           | First publication establishes one property basis; another published basis fails, including through direct SQL.                                                         |
| Draft clone                | `pricing-policy-draft-clone.integration.test.ts`                     | New draft copies published contents with a new monotonic version and leaves the source release unchanged.                                                              |
| Ownership                  | `pricing-policy-ownership.integration.test.ts`                       | Component, price, and edge composite FKs reject cross-policy and cross-property substitution.                                                                          |
| Price completeness         | `pricing-policy-price-validation.integration.test.ts`                | Missing tier price, duplicate tier price, non-positive VND, unsafe integer, and fallback price all fail.                                                               |
| Coverage/billing checks    | `pricing-policy-field-shape.integration.test.ts`                     | Invalid fixed/local/boundary field combinations, boundary placement, occurrence bounds, and billing fields fail validation.                                            |
| Existing invariants        | `migration-readiness.test.ts` plus generated snapshot check          | Existing room GiST exclusion, audit append-only trigger, booking immutability, and migration journal remain unchanged.                                                 |

### Application and pricing tests

| Area                        | Proposed test/evidence                                        | Required assertion                                                                                                                            |
| --------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview/complete validation | `apps/api/test/pricing-policy-validation.test.ts`             | Unreachable components, impossible edges, missing restrictions schema, duplicate tie-breaks, and candidate-line overflow fail closed.         |
| Local-window conversion     | `apps/api/test/pricing-policy-coverage.test.ts`               | 0/1 local-day offsets resolve exact instants in the property timezone; no UTC-date subtraction.                                               |
| DST behavior                | Same coverage test with a DST-observing IANA zone             | Nonexistent/ambiguous boundaries reject; 23/25-hour elapsed intervals are charged from exact instants, not assumed 24 hours.                  |
| Billing                     | `apps/api/test/pricing-policy-billing.test.ts`                | Fixed occurrence and started-unit quantities are exact; `ceil` is applied only after coverage; unsupported exact-unit model rejects.          |
| Repetition/graph            | `apps/api/test/pricing-policy-graph.test.ts`                  | Self-edge with occurrence limit 1 rejects; bounded self-repeat accepts; arbitrary multi-node cycle rejects; search ordering is deterministic. |
| Exact coverage              | `apps/api/test/pricing-policy-composer.test.ts`               | No gap, overlap, double charge, cursor movement, or remainder after requested checkout.                                                       |
| Ranking                     | Same composer test                                            | Lowest valid total wins, then fewer lines, complexity, tie-break rank, code, UUID, and digest.                                                |
| Snapshot provenance         | `packages/contracts/test/pricing-snapshot-provenance.test.ts` | Release id/number, component source/digest, exact intervals, semantics, quantities, totals, and rationale survive catalog changes.            |
| V1 compatibility            | Existing pricing/quote/booking contract suites                | Existing hourly/overnight result and legacy snapshots remain readable with no repricing/backfill.                                             |
| Public boundary             | Existing availability/quote/web contract tests                | No public `multi_night` request/offer, policy component internals, physical room data, or availability fact is exposed by B0.2.               |

### Mandatory V3 PostgreSQL scenarios

The following cases are the acceptance mapping for the implemented migration;
the focused suite reports 40 schema/invariant scenarios and 5 concurrency
scenarios. Graph-wide multi-node cycle validation and candidate path selection
remain application gates and are not claimed by the migration.

1. Future cutover leaves the old policy selectable before cutover.
2. Future successor is not selectable before cutover.
3. Successor is selectable exactly at cutover.
4. Old policy is not selectable at or after cutover.
5. Old policy remains PUBLISHED after future schedule closure.
6. Premature retirement before effective end is rejected.
7. Retirement after effective end succeeds without interval mutation.
8. Immediate cutover remains gap-free.
9. Failed future cutover preserves the old open-ended policy.
10. Concurrent future cutovers produce one winner.
11. Published mixed applicability bases for one property are rejected.
12. First published policy establishes the property basis.
13. Same-basis future policies are allowed when intervals do not overlap.
14. Direct SQL cannot bypass basis enforcement.
15. LEADING component with multiple approved successors is valid.
16. TRAILING component with multiple approved predecessors is valid.
17. Candidate still chooses only one boundary path.
18. Unapproved boundary adjacency is rejected.
19. DRAFT and CANCELLED policies do not block interval schedules.
20. Historical RETIRED intervals remain immutable and exclusion-protected.

### Mandatory V3 application scenarios

Application tests must additionally cover:

- `QUOTE_INSTANT` policy lookup;
- `STAY_START` policy lookup;
- lookup before, at, and after a scheduled cutover;
- explicit property basis resolution;
- no client-controlled basis;
- no multi-policy candidate;
- no multi-basis candidate;
- deterministic supersession;
- leading extra plus local-window base;
- local-window base plus trailing extra;
- leading plus repeated base plus trailing;
- exact coverage and no rounded-time extension;
- public multi-night exposure is server-gated and defaults OFF; gate-off
  responses fail closed without pricing or physical-room data.

Each case also asserts that occurrence count is distinct from billing-unit
quantity and that no candidate includes room, availability, or physical
inventory data.

The release tests must also assert the three non-negotiable invariants at the
future integration boundary: one stay becomes one booking, one booking retains
one room for the full interval, and price ranking happens only after validity
and convenience/continuity gates defined by their owning phases.
