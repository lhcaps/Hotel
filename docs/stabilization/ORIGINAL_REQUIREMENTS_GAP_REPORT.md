# Original requirements gap report

## Scope and authority

This is an audit only. It does not implement a missing feature, alter a
migration, change a production system, merge PR #10, or enable public
multi-night/pricing policy behavior. The full authoritative source is the
unique master-baseline equivalent recorded in
[`ORIGINAL_REQUIREMENTS_SUMMARY.txt`](../../ORIGINAL_REQUIREMENTS_SUMMARY.txt),
SHA-256 `ADC5A19BFFC76BE2D130EC1306972EFDE307DF50C5F8BDFB880054E1E66EA0C9`.

The branch audited is `codex/stabilize-release-integrity` at
`edbfdd49e52715bf521ab57f37ca2604d18982b4`. The default `main` checkout is
user-dirty and was not modified or used as release evidence.

## Hosted CI checkpoint

The Gitleaks blocker was already corrected in `edbfdd4` with a least-privilege
PR token path. Hosted run `31343502129` then executed the mandatory chain up to
E2E: install through Gitleaks, build, release integrity, Storybook, web unit
and Playwright install passed; E2E ran and failed one mobile public coupon/OTP
case after 167 passing tests. This is the first newly exposed hosted failure.

`FIRST_HOSTED_FAILING_GATE=E2E`

`FAIL-CI-E2E-001`: `phase6d-public-coupon.spec.ts`, mobile coupon flow. The
post-click assertion searches for a generic OTP acknowledgement that belongs to
the request form, while a fast successful request can replace that form with
the verification panel first. A focused local run passed, which is timing
evidence, not proof that the hosted failure is fixed. The root cause is not
closed and no source fix was made under this audit-only handoff.

## Completion calculation

The matrix denominator is 50 atomic original requirements. It counts an
independently deliverable behavior or mandated Phase A artifact exactly once;
it does not count files, test assertions, or later stabilization work twice.

| Metric                             | Calculation                                                                          | Result |
| ---------------------------------- | ------------------------------------------------------------------------------------ | -----: |
| Implementation completion          | 7 `IMPLEMENTED` / 50                                                                 |    14% |
| Automated-test completion          | 10 requirements with a direct `YES` in at least one unit/integration/E2E column / 50 |    20% |
| E2E completion                     | 0 requirements with full original-scenario E2E `YES` / 50                            |     0% |
| Production-verification completion | 0 requirements with `PRODUCTION=YES` / 50                                            |     0% |

`PARTIAL` does not contribute fractional completion to these strict figures:
30 requirements are partial and 13 are not started. This prevents broad
foundations from being misreported as delivered end-to-end behavior.

`ORIGINAL_REQUIREMENTS_FULLY_COMPLETE=NO`

## Phase assessment

| Phase | Status  | Reason                                                                                            |
| ----- | ------- | ------------------------------------------------------------------------------------------------- |
| A     | PARTIAL | Audit began, but the original 15-document Phase A design package does not exist.                  |
| B     | PARTIAL | Scheduling, profile and audit foundations exist; full V3 contracts/RBAC do not.                   |
| C     | PARTIAL | Room screens/read model exist; accountable checkout-to-ready task lifecycle does not.             |
| D     | PARTIAL | On-demand pass exists; persistent T-30 credential provider/worker lifecycle does not.             |
| E     | PARTIAL | Catalog is normalized; capacity and embedded management simplification are incomplete.            |
| F     | PARTIAL | Data is property-scoped; membership-authorized context and complete isolation are absent.         |
| G     | PARTIAL | Versioned policy infrastructure exists; all optimizer acceptance/explanation proof is incomplete. |
| H     | PARTIAL | Release tooling is exercised locally; connected lifecycle and all-green hosted CI are absent.     |

## Golden-flow result

`ORIGINAL_GOLDEN_FLOW_STATUS=PARTIAL`

`FIRST_MISSING_GOLDEN_FLOW_TRANSITION=CONFIRMED_AND_READY -> T-30_PERSISTED_ACCESS_CREDENTIAL`

The current system allocates a physical room at HOLD and has booking/payment
state foundations. It does not yet persist and issue a readiness-gated,
idempotent credential at T-30; subsequent checkout-to-dirty/assigned-cleaning
transitions are also incomplete.

## Priority inventory

| Priority class | Count | Meaning                                                                                       |
| -------------- | ----: | --------------------------------------------------------------------------------------------- |
| BLOCKER_PUBLIC |     1 | Hosted E2E failure blocks trust in the public OTP/coupon flow.                                |
| MUST_HAVE      |    22 | Lifecycle, access, property authority, pricing correctness, RBAC, audit and release evidence. |
| SHOULD_HAVE    |    17 | Catalog/IA simplification, operator ergonomics, broader test/observability proof.             |
| LATER          |    10 | External smart-lock and production execution items requiring separate authorization.          |

## Material technical-debt classifications

| Area                             | Classification                 | Evidence-led conclusion                                                                                |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Guest OTP mobile acknowledgement | FRAGILE / TEST_GAP             | Hosted failure and local pass identify a state-transition observation race; no fix made.               |
| Housekeeping                     | PARTIAL / TEST_GAP             | Existing scheduler/task model is not the original auditable workforce lifecycle.                       |
| Access                           | MISSING_FEATURE / SECURITY_GAP | On-demand pass is not a durable provider credential, and T-30 readiness/revocation workflow is absent. |
| Property context                 | SECURITY_GAP                   | Selecting the first active property is not membership authorization.                                   |
| Pricing                          | TEST_GAP                       | Robust V2 foundation exists, but original exhaustive explanations/acceptance matrix is not complete.   |
| Production release               | OPERATIONS_GAP                 | Local release tooling is strong; live release authorities are mixed and reconciliation is unapproved.  |

## Original acceptance-scenario trace

The original source's required-test section is grouped below without adding
scenarios. A group is `PARTIAL` only where an existing suite provides related
evidence but does not directly prove every stated original condition.

| SCENARIO                                                                                                                                                                | TEST_FILE                                        | LOCAL_STATUS | E2E_STATUS | PRODUCTION_STATUS |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------ | ---------- | ----------------- |
| Housekeeping: display priority; invalid transitions; assignment/reassignment; start; complete; verify; reopen; repeated completion; verification modes                  | No one-to-one V3 suite traced                    | NO           | NO         | NO                |
| Housekeeping DB: one active task; concurrent assignment; version conflict; atomic checkout; audit rollback; cross-property assignment; repeat checkout                  | No one-to-one V3 suite traced                    | NO           | NO         | NO                |
| Access: exact T-30; confirmed/HOLD/cancelled/expired; maintenance/readiness/assignment denial; duplicate/retry/revoke/late/redaction                                    | Existing access-pass tests are related only      | PARTIAL      | PARTIAL    | NO                |
| Multi-property: member/read/mutation/list/aggregate scope; UUID substitution; viewer; super-admin; customer ownership; 23-room baseline                                 | Existing property/catalog tests are related only | PARTIAL      | NO         | NO                |
| Pricing: original 11:00, 14:45, 18:00–09:00, 20:00–09:00, 21:00–09:00, 23:00–03:00, duration, date-boundary, leap-day, coverage/tie/coupon/snapshot/client-amount cases | pricing-policy and Phase 8 audit suites          | PARTIAL      | PARTIAL    | NO                |
| RBAC: each profile navigation/read/restricted route/API/mutation/prefetch/flash/minimization/session/audit                                                              | `room-status-viewer.spec.ts`, admin auth suites  | PARTIAL      | PARTIAL    | PARTIAL           |
| UI: 390×844, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080; overflow/actions/sheets/status/focus/keyboard/i18n/states/pagination/motion/flash                       | Admin V2 responsive/a11y/visual suites           | PARTIAL      | PARTIAL    | NO                |

## Recommended next boundary

The first implementation work, only after human review, is W2-001 in
[`ORIGINAL_REQUIREMENTS_COMPLETION_PLAN.md`](ORIGINAL_REQUIREMENTS_COMPLETION_PLAN.md):
close the hosted mobile OTP/coupon failure through a causal, tested behavior
change. No later wave should begin before that exact hosted E2E gate is green.
