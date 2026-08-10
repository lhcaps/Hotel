# Original requirements completion plan

## Planning boundary

This is a roadmap only. It does not authorize implementation, migration,
production mutation, public-feature enablement, PR merge, or deployment.
It preserves the completed stabilization controls (manifest/attestation/topology
guard, A/B rollback rehearsal, dependency-security closure, CI hardening and
secret-scanning model) unless a later source-backed defect requires change.

## Critical path

`W2 OTP root cause -> W3 payment/email authority verification -> W4 lifecycle
constraints -> W5 housekeeping/access -> W6 property/catalog/pricing -> W8
golden E2E -> W9 candidate/reconciliation -> W10 approved canary`.

## Wave 2 — customer identity, OTP and booking correctness

### W2-001

| Field                  | Value                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| TASK_ID                | W2-001                                                                                             |
| SOURCE_REQUIREMENT_ID  | ORIG-H-004, ORIG-X-006                                                                             |
| TITLE                  | Diagnose `FAIL-CI-E2E-001` without timing workarounds                                              |
| TYPE / SEVERITY        | IMPLEMENTATION_DEFECT / P1                                                                         |
| DEPENDENCIES           | Hosted run 31343502129 log and deterministic Playwright fixture                                    |
| CURRENT_STATE          | Hosted mobile OTP/coupon assertion failed; focused local run passed, indicating timing sensitivity |
| TARGET_STATE           | Causal UI/API synchronization contract is tested locally and hosted CI is green                    |
| FILES/SERVICES         | Public booking manage page, OTP panels, E2E fixture only if evidence requires                      |
| DB/API/FRONTEND IMPACT | TBD by root cause / no contract weakening / likely frontend flow only                              |
| TESTS_REQUIRED         | Focused unit/component and deterministic Playwright regression                                     |
| E2E_REQUIRED           | Yes, focused then full suite                                                                       |
| PRODUCTION_CANARY      | No                                                                                                 |
| ROLLBACK               | Revert one bounded commit if regression evidence fails                                             |
| ACCEPTANCE_CRITERIA    | No timeout/retry/skip/weakening; one hosted run executes E2E successfully                          |

## Wave 3 — payment authority, reconciliation and notification assurance

### W3-001

| Field                  | Value                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| TASK_ID                | W3-001                                                                                                   |
| SOURCE_REQUIREMENT_ID  | ORIG-X-003, ORIG-H-001                                                                                   |
| TITLE                  | Reconcile payment, callback, outbox and guest-notification proof with the golden flow                    |
| TYPE / SEVERITY        | VERIFICATION_GAP / P1                                                                                    |
| DEPENDENCIES           | W2-001                                                                                                   |
| CURRENT_STATE          | Settlement core and simulator tests exist; full original lifecycle trace is incomplete                   |
| TARGET_STATE           | Signed callback, duplicate, late-payment, amount-binding and outbox evidence map to each flow transition |
| FILES/SERVICES         | payment modules, worker outbox, contracts, tests/docs                                                    |
| DB/API/FRONTEND IMPACT | None unless a confirmed gap is found                                                                     |
| TESTS_REQUIRED         | Unit + guarded integration                                                                               |
| E2E_REQUIRED           | Payment-to-confirmed segment                                                                             |
| PRODUCTION_CANARY      | No                                                                                                       |
| ROLLBACK               | Documentation/test-only unless confirmed defect requires bounded fix                                     |
| ACCEPTANCE_CRITERIA    | Browser return remains non-authoritative; signed settlement is single path                               |

## Wave 4 — lifecycle integrity and concurrency

### W4-001

| Field                  | Value                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| TASK_ID                | W4-001                                                                                         |
| SOURCE_REQUIREMENT_ID  | ORIG-X-001, ORIG-X-002, ORIG-H-001                                                             |
| TITLE                  | Refresh one-booking/one-room continuous-stay and release concurrency proof                     |
| TYPE / SEVERITY        | VERIFICATION_GAP / P0                                                                          |
| DEPENDENCIES           | W3-001                                                                                         |
| CURRENT_STATE          | Schema constraints and B0 foundation exist; final original acceptance trace is incomplete      |
| TARGET_STATE           | One quote/HOLD/booking/payment and same physical room are proven across multi-night boundaries |
| FILES/SERVICES         | database, booking, pricing-policy, API and E2E suites                                          |
| DB/API/FRONTEND IMPACT | Tests first; source only for confirmed defect                                                  |
| TESTS_REQUIRED         | Concurrency, cross-month/year, cancellation and inventory-release tests                        |
| E2E_REQUIRED           | Full multi-night customer flow                                                                 |
| PRODUCTION_CANARY      | No                                                                                             |
| ROLLBACK               | No migration without separate compatibility plan                                               |
| ACCEPTANCE_CRITERIA    | No stitched rooms, no double allocation, no historical snapshot mutation                       |

## Wave 5 — room operations, access and housekeeping

### W5-001

| Field                  | Value                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| TASK_ID                | W5-001                                                                                       |
| SOURCE_REQUIREMENT_ID  | ORIG-B-001..005, ORIG-C-001..007                                                             |
| TITLE                  | Deliver auditable housekeeping lifecycle and derived room state                              |
| TYPE / SEVERITY        | MISSING_FEATURE / P0                                                                         |
| DEPENDENCIES           | Approved Phase A model, W4-001                                                               |
| CURRENT_STATE          | Scheduling/reminder foundation only; no accountable transition model                         |
| TARGET_STATE           | Atomic checkout-to-dirty, assignment, work, verification/reopen, minimized APIs/UI and audit |
| FILES/SERVICES         | database, contracts, auth, API, worker, admin web                                            |
| DB/API/FRONTEND IMPACT | Additive migration, new commands, protected screens                                          |
| TESTS_REQUIRED         | Unit, guarded DB concurrency, API permission/redaction and audit tests                       |
| E2E_REQUIRED           | Checkout through ready flow                                                                  |
| PRODUCTION_CANARY      | Later, synthetic only                                                                        |
| ROLLBACK               | Backward-compatible schema; tasks stay auditable/interpretable                               |
| ACCEPTANCE_CRITERIA    | Repeated checkout creates no duplicate task; every transition audited                        |

### W5-002

| Field                  | Value                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| TASK_ID                | W5-002                                                                                   |
| SOURCE_REQUIREMENT_ID  | ORIG-D-001..005                                                                          |
| TITLE                  | Deliver T-30 access credential through a Demo provider abstraction                       |
| TYPE / SEVERITY        | MISSING_FEATURE / P0                                                                     |
| DEPENDENCIES           | W5-001; approved credential/data model                                                   |
| CURRENT_STATE          | On-demand signed access pass only                                                        |
| TARGET_STATE           | Persistent, readiness-gated, idempotent T-30 credential with safe outbox/revoke behavior |
| FILES/SERVICES         | database, booking/API, worker, contracts, booking detail UI                              |
| DB/API/FRONTEND IMPACT | Additive schema/API/job/UI                                                               |
| TESTS_REQUIRED         | Exact T-30, states, maintenance/readiness, duplicate worker, retry/revoke/redaction      |
| E2E_REQUIRED           | Confirmed-to-checkout credential lifecycle                                               |
| PRODUCTION_CANARY      | Demo-only until external provider security review                                        |
| ROLLBACK               | Disable issue job and revoke demo credentials; preserve booking state                    |
| ACCEPTANCE_CRITERIA    | No plaintext access code in logs or public contracts                                     |

## Wave 6 — catalog, property authority and pricing completion

### W6-001

| Field                  | Value                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- |
| TASK_ID                | W6-001                                                                            |
| SOURCE_REQUIREMENT_ID  | ORIG-E-001..005                                                                   |
| TITLE                  | Safely simplify catalog and room-class workflows                                  |
| TYPE / SEVERITY        | MISSING_FEATURE / P1                                                              |
| DEPENDENCIES           | W5-001                                                                            |
| CURRENT_STATE          | Normalized catalog exists; capacity/navigation/editing targets incomplete         |
| TARGET_STATE           | 2/4-compatible capacity and embedded amenity/class workflows without history loss |
| FILES/SERVICES         | database, catalog API/contracts, admin web                                        |
| DB/API/FRONTEND IMPACT | Compatibility migration and UI changes                                            |
| TESTS_REQUIRED         | Consumer audit, referenced-record and responsive/a11y tests                       |
| E2E_REQUIRED           | Admin catalog workflow                                                            |
| PRODUCTION_CANARY      | No                                                                                |
| ROLLBACK               | Keep old fields/routes until consumer audit and compatibility window close        |
| ACCEPTANCE_CRITERIA    | No amenity or referenced room-type history is deleted                             |

### W6-002

| Field                  | Value                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| TASK_ID                | W6-002                                                                          |
| SOURCE_REQUIREMENT_ID  | ORIG-F-001..006                                                                 |
| TITLE                  | Make multi-property context server-authoritative                                |
| TYPE / SEVERITY        | MISSING_FEATURE / P0                                                            |
| DEPENDENCIES           | W5-001, W6-001                                                                  |
| CURRENT_STATE          | Property-scoped data but singleton active-property selection                    |
| TARGET_STATE           | Membership-scoped context, backfill, composite safeguards and hostile-ID denial |
| FILES/SERVICES         | database, auth, API repositories/controllers, admin web                         |
| DB/API/FRONTEND IMPACT | Additive schema/backfill/API/UI                                                 |
| TESTS_REQUIRED         | Cross-property list/mutation/aggregate/concurrency tests                        |
| E2E_REQUIRED           | Two-property staff/admin scenario                                               |
| PRODUCTION_CANARY      | Later, read-only/synthetic only                                                 |
| ROLLBACK               | Preserve original property and 23-room inventory; no orphaning                  |
| ACCEPTANCE_CRITERIA    | Changing a client property UUID cannot escape server authorization              |

### W6-003

| Field                  | Value                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| TASK_ID                | W6-003                                                                                           |
| SOURCE_REQUIREMENT_ID  | ORIG-G-001..006                                                                                  |
| TITLE                  | Close original pricing optimizer acceptance and explanation gaps                                 |
| TYPE / SEVERITY        | VERIFICATION_GAP / P0                                                                            |
| DEPENDENCIES           | W6-002                                                                                           |
| CURRENT_STATE          | Versioned policy foundation exists; complete original boundary/explanation trace absent          |
| TARGET_STATE           | Lowest complete valid candidate, deterministic ties, alternatives and immutable snapshots proven |
| FILES/SERVICES         | pricing-policy, pricing API/contracts, admin web, tests                                          |
| DB/API/FRONTEND IMPACT | Only confirmed gaps; no V1 history rewrite                                                       |
| TESTS_REQUIRED         | All original time/date/coverage/tie/coupon cases                                                 |
| E2E_REQUIRED           | Quote explanation and policy-management scenarios                                                |
| PRODUCTION_CANARY      | No pricing activation                                                                            |
| ROLLBACK               | Existing V1/V2 snapshots remain readable; activation is reversible                               |
| ACCEPTANCE_CRITERIA    | 18:00-to-09:00 displays every eligible candidate and selects lowest valid total                  |

## Wave 7 — observability, backup and operational hardening

### W7-001

| Field                  | Value                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| TASK_ID                | W7-001                                                                           |
| SOURCE_REQUIREMENT_ID  | ORIG-B-004, ORIG-X-004, ORIG-H-002                                               |
| TITLE                  | Close audit redaction, lifecycle metrics and production-shaped recovery evidence |
| TYPE / SEVERITY        | OBSERVABILITY_GAP / P1                                                           |
| DEPENDENCIES           | W5-001, W5-002, W6-002                                                           |
| CURRENT_STATE          | Structured logs/audit/outbox exist; V3 metrics/event redaction is incomplete     |
| TARGET_STATE           | Safe lifecycle telemetry and synthetic recovery/rehearsal evidence               |
| FILES/SERVICES         | observability, audit, worker, release scripts, tests                             |
| DB/API/FRONTEND IMPACT | Metrics/events only where justified                                              |
| TESTS_REQUIRED         | Redaction, retry/dead-letter and recovery tests                                  |
| E2E_REQUIRED           | No                                                                               |
| PRODUCTION_CANARY      | No                                                                               |
| ROLLBACK               | Additive observability, no secret logging                                        |
| ACCEPTANCE_CRITERIA    | No raw request bodies, OTPs, tokens, payment secrets or access codes emitted     |

## Wave 8 — golden E2E and acceptance matrix

### W8-001

| Field                  | Value                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| TASK_ID                | W8-001                                                                                      |
| SOURCE_REQUIREMENT_ID  | ORIG-H-001, ORIG-H-004, ORIG-X-006                                                          |
| TITLE                  | Execute original acceptance and end-to-end lifecycle matrix                                 |
| TYPE / SEVERITY        | VERIFICATION_GAP / P0                                                                       |
| DEPENDENCIES           | W2–W7                                                                                       |
| CURRENT_STATE          | No end-to-end proof past T-30/housekeeping; hosted E2E currently fails once                 |
| TARGET_STATE           | Every original scenario has a deterministic executable result and exact-SHA hosted evidence |
| FILES/SERVICES         | tests, fixtures, docs, all lifecycle services                                               |
| DB/API/FRONTEND IMPACT | Test/fixture only unless defect confirmed                                                   |
| TESTS_REQUIRED         | Full local quality gate list                                                                |
| E2E_REQUIRED           | Yes, retries 0 for functional/authorization tests                                           |
| PRODUCTION_CANARY      | No                                                                                          |
| ROLLBACK               | No production mutation                                                                      |
| ACCEPTANCE_CRITERIA    | No mandatory hosted step skipped and no unclassified failure                                |

## Waves 9–10 — candidate, reconciliation and canary

### W9-001

| Field                  | Value                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| TASK_ID                | W9-001                                                                                              |
| SOURCE_REQUIREMENT_ID  | ORIG-H-003..005                                                                                     |
| TITLE                  | Produce exact-SHA release candidate and production reconciliation package                           |
| TYPE / SEVERITY        | OPERATIONS_GAP / P0                                                                                 |
| DEPENDENCIES           | W8-001 and human review                                                                             |
| CURRENT_STATE          | Local release rehearsal passes; production is mixed and unauthorized                                |
| TARGET_STATE           | Immutable candidate manifest, backup/preflight, full topology attestation and rollback instructions |
| FILES/SERVICES         | release scripts and stabilization docs                                                              |
| DB/API/FRONTEND IMPACT | None during planning                                                                                |
| TESTS_REQUIRED         | Release-integrity + rehearsal                                                                       |
| E2E_REQUIRED           | Candidate smoke only                                                                                |
| PRODUCTION_CANARY      | Plan only                                                                                           |
| ROLLBACK               | Complete retained immutable release                                                                 |
| ACCEPTANCE_CRITERIA    | One SHA/release ID/image digest set; no mutable tags or manual service recreation                   |

### W10-001

| Field                  | Value                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| TASK_ID                | W10-001                                                                          |
| SOURCE_REQUIREMENT_ID  | ORIG-H-005                                                                       |
| TITLE                  | Execute approved production canary and public enablement                         |
| TYPE / SEVERITY        | OPERATIONS_GAP / P0                                                              |
| DEPENDENCIES           | W9-001 and separate explicit human approval                                      |
| CURRENT_STATE          | Not authorized                                                                   |
| TARGET_STATE           | Approved, bounded, observable reconciliation/canary with rollback rehearsal      |
| FILES/SERVICES         | Production only under separate authorization                                     |
| DB/API/FRONTEND IMPACT | Potentially production; excluded from this task                                  |
| TESTS_REQUIRED         | Preflight, health, attestation, non-destructive acceptance                       |
| E2E_REQUIRED           | Approved canary only                                                             |
| PRODUCTION_CANARY      | Yes, only after approval                                                         |
| ROLLBACK               | Governed complete-release rollback                                               |
| ACCEPTANCE_CRITERIA    | Human-approved source SHA, immutable artifacts, no mixed authority, canary green |

## Parallel-safe work

- **PARALLEL_SAFE after domain contracts stabilize:** W6-001 catalog UX and
  W7-001 observability/audit work; documentation and test-matrix preparation.
- **SEQUENTIAL_REQUIRED:** W2-001 -> W3-001 -> W4-001 -> W5-001 -> W5-002 ->
  W6-002 -> W6-003 -> W8-001 -> W9-001 -> W10-001. Schema/authority changes
  precede APIs, then browser proof. No parallel task may invent a competing
  lifecycle or property model.
