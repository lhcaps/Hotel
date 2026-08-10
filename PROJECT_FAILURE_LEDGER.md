# Project failure ledger

This append-only ledger records every discovered failure, its evidence-based
root-cause investigation, corrective change, and regression proof. A passing
rerun does not erase the original failure record.

## FAIL-CI-E2E-001

| Field             | Value                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DISCOVERED_AT     | 2026-08-10                                                                                                                                                                                                     |
| AREA              | Customer edge: public coupon / guest OTP / mobile                                                                                                                                                              |
| SEVERITY          | P1 / BLOCKER_PUBLIC                                                                                                                                                                                            |
| SYMPTOM           | Hosted CI run `31343502129` failed `tests/e2e/phase6d-public-coupon.spec.ts:581` after 167 tests passed. After clicking `Gửi mã xác nhận`, the generic acknowledgement was not visible within 10 seconds.      |
| ROOT_CAUSE_STATUS | CONFIRMED — the assertion targets text owned by the request panel; a fast successful response can replace the panel with verification state before the assertion observes it.                                  |
| DEPENDENCIES      | Guest OTP request panel, manage-page state transition, mobile E2E flow                                                                                                                                         |
| BLOCKS_WHAT       | Hosted E2E, hosted full pipeline, release-candidate readiness                                                                                                                                                  |
| PLANNED_WAVE      | Wave 2 — Customer Edge / OTP / Booking                                                                                                                                                                         |
| RESOLUTION        | Attempt 1 of 3: retain the generic, non-enumerating acknowledgement in the mounted verification state after successful OTP request. No timeout/retry/skip/assertion weakening.                                 |
| VERIFICATION      | `apps/web/test/otp-panels.test.tsx`: 14/14 PASS; focused mobile coupon/OTP Playwright: 1/1 PASS; `tests/e2e/phase6d-public-coupon.spec.ts`: 3/3 PASS; hosted CI run `31381175837`: full pipeline and E2E PASS. |

## FAIL-LOCAL-ENV-001

| Field             | Value                                                                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DISCOVERED_AT     | 2026-08-10                                                                                                                                                                                                                                                                     |
| AREA              | Local guarded integration environment                                                                                                                                                                                                                                          |
| SEVERITY          | P2 / OPERATIONS                                                                                                                                                                                                                                                                |
| SYMPTOM           | `pnpm test:catalog` failed before test setup because the worktree has no `.env`, hence `TEST_DATABASE_URL` was absent. Starting this worktree's Compose PostgreSQL also failed because loopback port 5432 was already occupied by the existing local Room Management topology. |
| ROOT_CAUSE_STATUS | CONFIRMED — local setup prerequisites were absent, not a product assertion failure.                                                                                                                                                                                            |
| DEPENDENCIES      | Loopback PostgreSQL and disposable test-database guard                                                                                                                                                                                                                         |
| BLOCKS_WHAT       | Local integration verification when invoked without explicit local environment                                                                                                                                                                                                 |
| PLANNED_WAVE      | Wave 7 — Operations / readiness documentation                                                                                                                                                                                                                                  |
| RESOLUTION        | Used invocation-scoped loopback/demo environment values and the existing local PostgreSQL only through guarded disposable `room_management_test_*` databases; no `.env`, Compose topology, or persistent data was altered.                                                     |
| VERIFICATION      | `pnpm test:catalog`: 28 files, 178 tests PASS.                                                                                                                                                                                                                                 |

## FAIL-CI-FORMAT-001

| Field             | Value                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| DISCOVERED_AT     | 2026-08-10                                                                                                                             |
| AREA              | Hosted CI formatting gate                                                                                                              |
| SEVERITY          | P1 / RELEASE_BLOCKER                                                                                                                   |
| SYMPTOM           | Hosted CI run `31380187869` stopped at `pnpm format:check`; all subsequent gates were skipped.                                         |
| ROOT_CAUSE_STATUS | CONFIRMED - `apps/web/test/otp-panels.test.tsx`, added for `FAIL-CI-E2E-001`, was not Prettier-formatted before the Wave 2 checkpoint. |
| DEPENDENCIES      | Wave 2 OTP component test and repository-wide Prettier gate                                                                            |
| BLOCKS_WHAT       | Hosted E2E retry and candidate pipeline                                                                                                |
| PLANNED_WAVE      | Wave 2 - Customer Edge / OTP / Booking                                                                                                 |
| RESOLUTION        | Attempt 1 of 3: apply the repository formatter to the exact test file, then run the full formatter check locally before pushing.       |
| VERIFICATION      | Local `pnpm format:check` PASS; hosted CI run `31381175837` formatting gate and full pipeline PASS.                                    |

## FAIL-DB-PROVENANCE-001

| Field             | Value                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DISCOVERED_AT     | 2026-08-10                                                                                                                                                                                 |
| AREA              | Database migration release integrity                                                                                                                                                       |
| SEVERITY          | P1 / RELEASE_BLOCKER                                                                                                                                                                       |
| SYMPTOM           | `pnpm db:test` rejected new migration `0030_good_malcolm_colcord.sql` because the immutable migration-provenance manifest had no matching journal/SQL identity entry.                      |
| ROOT_CAUSE_STATUS | CONFIRMED - a forward migration must be deliberately added to the provenance manifest; auto-generation updates the journal and snapshot but does not release the immutable manifest entry. |
| DEPENDENCIES      | Migration journal, SQL SHA-256 provenance manifest, historical migration identity tests                                                                                                    |
| BLOCKS_WHAT       | Database test gate and release manifest generation                                                                                                                                         |
| PLANNED_WAVE      | Wave 5 - Housekeeping lifecycle                                                                                                                                                            |
| RESOLUTION        | Used the repository's append-only provenance refresh script without rewrite permission, then labeled only the new entry as Operations V3 housekeeping accountability.                      |
| VERIFICATION      | Guarded `pnpm db:test`: 25 files, 223 tests PASS.                                                                                                                                          |

## FAIL-W5-HOUSEKEEPING-ASSIGNMENT-001

| Field             | Value                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DISCOVERED_AT     | 2026-08-10                                                                                                                                                              |
| AREA              | Housekeeping operations lifecycle                                                                                                                                       |
| SEVERITY          | P0 / ORIGINAL_REQUIREMENT_GAP                                                                                                                                           |
| SYMPTOM           | The new atomic lifecycle test could not assign a cleaner: task assignment, assignee/assigner attribution, and versioned conflict control did not exist.                 |
| ROOT_CAUSE_STATUS | CONFIRMED - the prior model advanced a room-level status but had no accountable assignment command or task-level optimistic concurrency boundary.                       |
| DEPENDENCIES      | Existing `housekeeping_tasks`, catalog transaction, audit writer, admin catalog permission                                                                              |
| BLOCKS_WHAT       | Original Wave 5 assign/reassign acceptance and accountable operational audit                                                                                            |
| PLANNED_WAVE      | Wave 5 - Housekeeping lifecycle                                                                                                                                         |
| RESOLUTION        | Added forward migration 0030, task actor/version fields, active-user checked assignment API, transaction-scoped audit event, and compare-and-swap version precondition. |
| VERIFICATION      | `apps/api/test/integration/rooms.integration.test.ts`: 4/4 PASS; API/contracts typecheck, API/contracts lint, OpenAPI integrity, and guarded database suite PASS.       |

## FAIL-W5-HOUSEKEEPING-VERIFICATION-001

| Field             | Value                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DISCOVERED_AT     | 2026-08-10                                                                                                                                                         |
| AREA              | Housekeeping operations lifecycle                                                                                                                                  |
| SEVERITY          | P0 / ORIGINAL_REQUIREMENT_GAP                                                                                                                                      |
| SYMPTOM           | After task completion, no verification or reopen command existed; a room could not be safely returned to DIRTY for remedial turnover.                              |
| ROOT_CAUSE_STATUS | CONFIRMED - the task model ended at DONE and held no verifier/reopen audit fields or versioned state transitions.                                                  |
| DEPENDENCIES      | Versioned housekeeping task, catalog transaction, immutable audit trail                                                                                            |
| BLOCKS_WHAT       | Original Wave 5 verification/reopen acceptance and next-booking readiness recovery                                                                                 |
| PLANNED_WAVE      | Wave 5 - Housekeeping lifecycle                                                                                                                                    |
| RESOLUTION        | Added forward migration 0031, verification/reopen actor fields, versioned commands, audit events, and atomic reopen that resets the task to DUE and room to DIRTY. |
| VERIFICATION      | `apps/api/test/integration/rooms.integration.test.ts`: 4/4 PASS; guarded `pnpm db:test`: 25 files, 224 tests PASS.                                                 |

## FAIL-CI-E2E-002

| Field             | Value                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DISCOVERED_AT     | 2026-08-10                                                                                                                                                                                                                           |
| AREA              | Hosted ADMIN V2 and booking-operations E2E regression coverage                                                                                                                                                                       |
| SEVERITY          | P1 / RELEASE_BLOCKER                                                                                                                                                                                                                 |
| SYMPTOM           | Hosted CI run `31382442211` passed 25 mandatory gates but full E2E failed after 166 tests: the responsive route sweep waited for a generic heading that is not a route invariant, and a NO_SHOW assertion matched two visible nodes. |
| ROOT_CAUSE_STATUS | CONFIRMED — both failures are test-selector defects: the sweep's actual invariant is a visible localized `.admin-page` without overflow, and the NO_SHOW state is intentionally rendered in more than one visible region.            |
| DEPENDENCIES      | ADMIN V2 route sweep, booking lifecycle presentation, Playwright strict locator semantics                                                                                                                                            |
| BLOCKS_WHAT       | Hosted full E2E and release-candidate readiness                                                                                                                                                                                      |
| PLANNED_WAVE      | Wave 2 — hosted CI closure                                                                                                                                                                                                           |
| RESOLUTION        | Attempt 1 of 3: retain the route/page, locale, and responsive assertions while removing the non-contractual heading requirement; retain a scoped NO_SHOW visibility assertion and remove the duplicate unscoped strict locator.      |
| VERIFICATION      | Local isolated Playwright: `admin-v2-responsive.spec.ts` 1/1 PASS (all six viewports and route sweep); `phase-7g-admin-booking-operations.spec.ts --grep NO_SHOW` 1/1 PASS. Hosted full-pipeline rerun pending.                      |
