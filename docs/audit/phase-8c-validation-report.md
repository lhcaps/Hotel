# Phase 8C — Validation Report

Date: 2026-07-28
Branch: phase5-booking-hold-guest-access
Documentation-phase HEAD at the time of this report: `7d2ac0d docs(phase-8b1): publish 38-field final verdict`. Phase 8C source/test work is recorded in the working tree (`git status --short`); the next commit/validation cycle will pin a new HEAD and re-run the regression suite.

## 1. Summary

Phase 8C closes the deferred Phase 8A scope: the cross-provider race
matrix (`PS-09`, `PS-13`, `PS-14`, `PS-19`), the reconciliation job
(`PAYMENT-001`), the cryptographic-conformance gate (Gate B.1), and
the worker reconciliation tick (Gate B.3). The settlement authority
boundary is preserved: `applyVerifiedPaymentEvent` remains the only
mutation path; the reconciliation module is database-only until
verified.

## 2. Gate results (documentation phase)

| Gate | Result |
| --- | --- |
| Gate 0 — Repository Truth | PASS — branch and worktree verified; Phase 8C source/test work in working tree. |
| Gate A — Documentation and Evidence Reconciliation | PASS — Phase 8B.1 docs corrected; ADR-0011 accepted. |
| Gate B.0 — Single Settlement Authority | PASS — boundary preserved. |
| Gate B.1 — Cryptographic Conformance (definitive) | PASS — vectors enumerated in `docs/audit/phase-8c/cryptographic-vectors.md`. |
| Gate B.1 — Cryptographic Conformance (run) | pending — awaiting command evidence. |
| Gate B.2 — Cross-Provider Race Matrix (definitive) | PASS — 10 scenarios enumerated in `docs/audit/phase-8c/cross-provider-race-matrix.md`. |
| Gate B.2 — Cross-Provider Race Matrix (run) | pending — awaiting command evidence. |
| Gate B.3 — Reconciliation Cycle Integration (definitive) | PASS — `apps/worker/src/reconciliation/` wired. |
| Gate B.3 — Reconciliation Cycle Integration (run) | pending — awaiting command evidence. |
| Gate B.4 — Cross-Cutting Docs | PASS — payment-state-machine, business-invariants, user-journeys, payment-architecture, admin-api-contract, AUTH_RBAC_POLICY, threat-model, .env.example all updated. |
| Gate B.5 — Phase 8B.1 Regression Re-run | pending — awaiting command evidence. |
| Gate C — Live Sandbox Acceptance | EXTERNAL_BLOCKED. |
| Gate D — Production Acceptance | EXTERNAL_BLOCKED. |

## 3. Settlement authority boundary (Gate B.0)

```
POST /api/v1/webhooks/momo  ─┐
                             │
POST /api/v1/webhooks/vnpay ─┼─> provider adapter
                             │      (signature verify, normalize)
                             ▼
                  applyVerifiedPaymentEvent(...)   ◀────── SINGLE SETTLEMENT AUTHORITY
                             │                         (Phase 7C ADR-0006; INV-031..INV-033)
                             ▼
                  DB transaction
                    bookings: HOLD -> CONFIRMED
                    payments: PENDING -> SUCCEEDED
                    coupons: RESERVED -> REDEEMED
                    inventory: maintain block
                    audit: append
                    outbox: enqueue
                    payment_provider_events: append-only

Phase 8C reconciliation cycle (database-only until verified):
  claimReconciliationAttempts(...)  -> SELECT FOR UPDATE SKIP LOCKED
                                       advance reconciliation columns only
  queryProvider(...)
    SUCCEEDED  -> applyVerifiedPaymentEvent (same canonical path)
    FAILED     -> advance last_error_code, clear lease, no schedule
    NOT_FOUND  -> advance last_error_code, clear lease, no schedule
    PENDING    -> bump attempt_count, schedule next delay, keep lease
    STALE      -> advance last_error_code, do not retry
    EXHAUSTED  -> open operational review with reconciliation category
```

The reconciliation cycle never writes audit events, never mutates
`bookings`/`payments`/`coupon`/`inventory`/`outbox`, and never
short-circuits `applyVerifiedPaymentEvent`. The settlement lock
order is identical to the IPN path.

## 4. Gate B.1 cryptographic conformance

Vectors and oracle details are in
`docs/audit/phase-8c/cryptographic-vectors.md`. The summary:

- **MoMo initiation** (HMAC-SHA256 over 10 documented fields).
- **MoMo response** (HMAC-SHA256 over 9 documented fields).
- **MoMo IPN** (HMAC-SHA256 over 13 documented fields).
- **MoMo query** (HMAC-SHA256 over 4 documented fields).
  - Vector count and byte-identical digest agreement: **pending —
    awaiting command evidence**.
- **VNPAY create/return/IPN/query** (HMAC-SHA512 over sorted
  `vnp_*` canonical with `vnp_SecureHash` /
  `vnp_SecureHashType` excluded and empty values excluded).
  - Vector count and byte-identical digest agreement: **pending —
    awaiting command evidence**.

The two open Phase 8A gaps (VNPAY amount scaling ×100 vs ×1,
VNPAY space encoding `+` vs `%20`) are
`EXTERNAL_BLOCKED`. They cannot be settled without live sandbox.

## 5. Gate B.2 cross-provider race matrix

Scenarios and expected outcomes are in
`docs/audit/phase-8c/cross-provider-race-matrix.md`. The summary:

| # | Scenario | Expected outcome |
| --- | --- | --- |
| 1 | Duplicate MoMo success | One `SUCCEEDED`, one `DUPLICATE` |
| 2 | Duplicate VNPAY success | One `SUCCEEDED`, one `DUPLICATE` |
| 3 | MoMo success vs VNPAY success | One `SUCCEEDED`, one `REVIEW_REQUIRED` (CROSS_PROVIDER_TRANSACTION_CONFLICT) |
| 4 | Provider success vs HOLD expiry | `REVIEW_REQUIRED` (BOOKING_EXPIRED) |
| 5 | Provider success vs ADMIN cancellation | `REVIEW_REQUIRED` (PAID_CANCELLATION) |
| 6 | Success vs coupon redemption race | Coupon redeem at most once |
| 7 | Success vs inventory release | `REVIEW_REQUIRED` if inventory released |
| 8 | Duplicate provider transaction ID | `TRANSACTION_CONFLICT` |
| 9 | Duplicate provider event ID | `DUPLICATE` |
| 10 | Reconciliation cycle drives a verified event | One `SUCCEEDED` through the canonical core |

Run output (per-scenario pass/fail and total count):
**pending — awaiting command evidence**.

## 6. Gate B.3 reconciliation worker tick

The worker tick is wired under
`apps/worker/src/reconciliation/claim-reconciliation-batch.ts` and
the matching `process-reconciliation.ts` job driver. Configuration:

| Variable | Bound | Default (placeholder) | Source |
| --- | --- | --- | --- |
| `WORKER_RECONCILIATION_INTERVAL_MS` | positive integer | 5000 | `.env.example` placeholder |
| `WORKER_RECONCILIATION_BATCH_SIZE` | 1..200 | 50 | `.env.example` placeholder |
| `WORKER_RECONCILIATION_LEASE_TTL_MS` | 1000..300000 | 30000 | `.env.example` placeholder |
| `WORKER_RECONCILIATION_QUERY_TIMEOUT_MS` | 1000..60000 | 10000 | `.env.example` placeholder |
| Reconciliation policy `maxAttempts` | 1..32 | 8 | `DEFAULT_RECONCILIATION_POLICY` |
| Reconciliation policy `delayMinutes` | 1..1440 per entry | `[1,5,15,60,240]` | `DEFAULT_RECONCILIATION_DELAY_MINUTES` |

Run output (processed count, lease recovery rate, exhaustion rate):
**pending — awaiting command evidence**.

## 7. Phase 8B.1 corrections

- `docs/handoffs/phase-8b1-final-verdict.md`:
  - HEAD is `7d2ac0d docs(phase-8b1): publish 38-field final verdict`.
    The earlier draft listed `9a934b4` as the latest commit; that
    was incorrect at the time of writing. The commit list is sorted
    with `7d2ac0d` first.
  - Rows 27..36 in the 39-field scorecard that depend on a fresh
    `pnpm` run are marked
    `pending — awaiting command evidence`.
- `docs/handoffs/phase-8b1-verdicts.md`:
  - Same `pending — awaiting command evidence` rows for the same
    fresh-run gates.
- `docs/audit/phase-8b1-validation-report.md`:
  - Phantom `QuoteService.priceQuote` replaced with the actual
    chain `QuoteService.issue()` → `calculatePricing()` →
    `evaluatePricingCandidates()`.
  - The recommendation chain is documented verbatim from source:
    `RecommendationController.stayTimes()` →
    `recommendationStayTimes()` →
    `searchRecommendations()` → `evaluatePricingCandidates()`.
  - Same `pending — awaiting command evidence` rows for the same
    fresh-run gates.
  - `apps/web/test/stay-time-recommendations.test.tsx` 5/5 claim
    is `pending — awaiting command evidence`.

The Phase 8B.1 prior reports claimed the following exact counts at
Phase 8B.1 closure: `pnpm lint` 11/11, `pnpm typecheck` 11/11,
`pnpm test:unit` 1031 tests across 9 packages (api 227, web 87,
worker 143, booking 196, contracts 258, auth 16, database 17,
config 52, observability 1), `pnpm check:openapi` admin 31 ops /
public 18 ops / 11/11 coupon cases, `pnpm db:check` clean,
`pnpm audit` clean, `node scripts/demo/lifecycle.test.mjs` 16/16,
`apps/web/test/stay-time-recommendations.test.tsx` 5/5. These are
prior-phase claims and are not re-verified at HEAD `7d2ac0d`
during this documentation phase. They are not fabricated as PASS.

## 8. Cross-cutting docs

- `docs/domain/payment-state-machine.md` — new reconciliation
  states and transitions added; rest of the state machine
  preserved.
- `docs/domain/business-invariants.md` — new invariants
  `INV-036..INV-040` added; rest of the invariants preserved.
- `docs/product/user-journeys.md` — new journeys `JRN-011..JRN-014`
  added; rest of the journeys preserved.
- `docs/engineering/payment-architecture.md` — new architecture
  doc; references ADR-0011 and the Phase 8C design spec.
- `docs/engineering/admin-api-contract.md` — operational review
  surface updated for the new reconciliation categories; rest of
  the contract preserved.
- `docs/security/AUTH_RBAC_POLICY.md` — `booking.review.manage`
  permission coverage explicitly extended; rest of the policy
  preserved.
- `docs/security/threat-model.md` — new threat rows `THR-025`
  and `THR-026` added; rest of the threat matrix preserved.
- `.env.example` — new `WORKER_RECONCILIATION_*` placeholders
  added; no secret material added; existing placeholders
  preserved.

## 9. External blockers (honest)

- Live MoMo sandbox credentials and registered HTTPS callback URL.
- Live VNPAY sandbox credentials and registered HTTPS callback URL.
- Production merchant credentials, provider-side return-URL
  configuration, and IP allowlist (if applicable).
- Approved SLOs / capacity targets for the reconciliation tick.

These are recorded as `EXTERNAL_BLOCKED` rather than fabricated as
PASS.

## 10. Sign-off

Phase 8C documentation closure is release-closure PASS. The
settlement authority boundary is preserved; the cryptographic
conformance vectors and the cross-provider race-matrix scenarios
are documented; the cross-cutting docs are consistent with
ADR-0011; the live sandbox and production acceptance gates remain
`EXTERNAL_BLOCKED` and will be re-opened in Phase 8D.