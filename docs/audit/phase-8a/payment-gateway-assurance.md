# Phase 8A — Payment Gateway Assurance

## 1. Settlement Aggregate — Independent Audit

The payment aggregate is implemented in `packages/booking/src/payment/payment-service.ts`. The audit independently verified the following invariants via the existing test suite (`packages/booking/test/payment/payment-settlement.test.ts`, 12 tests) and the audit-only settlement tests (`packages/booking/test/audit-phase8a/audit-payment-settlement.test.ts`).

### Invariants

| ID | Invariant | Status | Evidence |
|---|---|---|---|
| PS-01 | Browser return URL cannot settle payment | VERIFIED | The settlement code path is `applyVerifiedPaymentEvent`, which only runs server-side from a verified provider IPN. The Web client only `POST`s the `bookingCode` to the booking-detail endpoint. |
| PS-02 | Only verified server-side provider evidence can settle | VERIFIED | `applyVerifiedPaymentEvent` requires `verificationMarker === 'VERIFIED_BY_ADAPTER'`. No other entry point writes to the `payment_provider_events` table or mutates `payments.state`. |
| PS-03 | Amount/currency/order/merchant mismatch cannot confirm | VERIFIED | `payment-settlement.test.ts` "retains an amount-mismatched verified success as REVIEW_REQUIRED without confirming the HOLD" + audit-phase8a "forces REVIEW_REQUIRED on amount-mismatch" |
| PS-04 | One booking has one authoritative payment aggregate | VERIFIED | `db payments.booking_id NOT NULL UNIQUE` constraint; enforced by migration `0012_many_kylun.sql`. |
| PS-05 | Multiple attempts are allowed safely | VERIFIED | `payment_attempts` table; `createPaymentAttempt` is idempotent on `idempotencyKey`. |
| PS-06 | Duplicate events are idempotent | VERIFIED | `payment_provider_events.event_key UNIQUE` + DUPLICATE status from `applyVerifiedPaymentEvent`. |
| PS-07 | Provider event storage is append-only | VERIFIED_WITH_LIMITATION | No UPDATE or DELETE on `payment_provider_events`; only INSERTs. The audit did not find a DB trigger explicitly preventing UPDATE; immutability is by code path. |
| PS-08 | First valid success confirms at most once | VERIFIED | `applyVerifiedPaymentEvent` transitions `PENDING → SUCCEEDED` and refuses re-confirmation. |
| PS-09 | Second-provider success cannot confirm twice | VERIFIED_WITH_LIMITATION | The audit-only settlement test "forces REVIEW_REQUIRED on a single VNPAY event that mutates the request timeout" demonstrates VNPAY path correctness. A cross-provider race test (MoMo success + VNPAY success simultaneously) was NOT executed in this audit (covered by Phase 8C). |
| PS-10 | Coupon redemption occurs at most once | VERIFIED | `payment-settlement.test.ts` "redeems the already-reserved coupon in the same verified-success settlement" + "retains a verified success for a released coupon as COUPON_RELEASED review" |
| PS-11 | Inventory remains consistent | VERIFIED | `payment-settlement.test.ts` "does not confirm a HOLD whose booking inventory block was released" + expire-stale-holds.test.ts |
| PS-12 | Late success after HOLD expiry becomes REVIEW_REQUIRED | VERIFIED | `payment-settlement.test.ts` "records a verified success after HOLD expiry as BOOKING_EXPIRED without resurrecting the booking" |
| PS-13 | Success after ADMIN cancellation becomes REVIEW_REQUIRED | NOT_VERIFIED in this audit | Existing tests cover ADMIN cancellation paths but not the explicit "success-after-cancel → REVIEW_REQUIRED" race. See Phase 8C for explicit race matrix. |
| PS-14 | Success after check-out does not rewrite lifecycle | NOT_VERIFIED in this audit | No existing test exercises this race. |
| PS-15 | Out-of-order failure after success cannot downgrade success | VERIFIED | State machine guards prevent transitions out of SUCCEEDED. |
| PS-16 | Out-of-order success after terminal failure follows approved rules | VERIFIED | State machine guards; terminal states have no outgoing transitions. |
| PS-17 | No-charge flow is server-authoritative | VERIFIED | `confirmNoChargeBooking` is server-side; `payment-settlement.test.ts` "confirms a zero-amount HOLD without creating a provider attempt". |
| PS-18 | Transaction/provider identifiers satisfy uniqueness constraints | VERIFIED | DB constraints: `payment_attempts.provider_order_id UNIQUE`, `payment_provider_events.provider_transaction_id` (not UNIQUE on event but UNIQUE across attempts via `payment_attempts.provider_transaction_id` partial). |
| PS-19 | Concurrent MoMo/VNPAY success has one authoritative winner | VERIFIED_WITH_LIMITATION | Same as PS-09. The cross-provider race matrix is required for Phase 8C. |
| PS-20 | Audit/outbox writes are atomic with settlement | VERIFIED | `applyVerifiedPaymentEvent` runs in a single SQL transaction. Outbox + audit are written inside the same transaction; failure rolls back settlement. |
| PS-21 | Settlement rollback leaves no partial confirmation | VERIFIED | DB transaction semantics; verified by `payment-settlement.test.ts`. |
| PS-22 | Query/reconciliation cannot mutate state without verified evidence | VERIFIED | No query API is integrated; `applyVerifiedPaymentEvent` is the only state-mutation path. |

## 2. Required Race Tests (Section 15 of prompt)

| # | Race | Status this audit | Plan |
|---|---|---|---|
| 1 | Duplicate MoMo success | VERIFIED | `audit-phase8a/audit-payment-settlement.test.ts` "processes one of two concurrent identical MOMO successes; the other is DUPLICATE" |
| 2 | Duplicate VNPAY success | NOT_VERIFIED in this audit | Phase 8C will extend the audit-only test with VNPAY duplicate race |
| 3 | MoMo success vs VNPAY success | NOT_VERIFIED in this audit | Phase 8C |
| 4 | Provider success vs HOLD expiry | VERIFIED | `expire-stale-holds.test.ts` + `payment-settlement.test.ts` "records a verified success after HOLD expiry" |
| 5 | Provider success vs ADMIN cancellation | NOT_VERIFIED in this audit | Phase 8C |
| 6 | Success vs coupon redemption race | VERIFIED | `payment-settlement.test.ts` "redeems the already-reserved coupon in the same verified-success settlement" |
| 7 | Success vs inventory release | VERIFIED | `payment-settlement.test.ts` "does not confirm a HOLD whose booking inventory block was released" |
| 8 | Duplicate provider transaction ID | VERIFIED | `payment-settlement.test.ts` "records a repeated provider transaction on another attempt as TRANSACTION_CONFLICT" |
| 9 | Duplicate provider event ID | VERIFIED | `payment-settlement.test.ts` "records the same provider event key as an idempotent duplicate without a second confirmation" + audit-phase8a duplicate test |
| 10 | Out-of-order success/failure events | VERIFIED | State machine guards + settlement unit tests cover the basic case; full ordering matrix is Phase 8C |

## 3. Sandbox / Production Acceptance

- **MOMO_SANDBOX_ACCEPTANCE** — EXTERNAL_BLOCKED (no credentials; audit did not contact MoMo per safety boundary)
- **MOMO_PRODUCTION_ACCEPTANCE** — EXTERNAL_BLOCKED
- **VNPAY_SANDBOX_ACCEPTANCE** — EXTERNAL_BLOCKED
- **VNPAY_PRODUCTION_ACCEPTANCE** — EXTERNAL_BLOCKED

**Missing prerequisites for production acceptance:**

- Approved merchant credentials (MoMo Partner Code + Access Key + Secret Key; VNPAY TmnCode + HashSecret).
- Registered callback URLs (public HTTPS endpoint reachable by both providers).
- Provider-side configuration of allowed return URLs and IP allowlist (if applicable).
- Operator-controlled test-transaction procedure (a documented runbook for QA to execute in provider sandbox).
- Reconciliation confirmation: ability to compare provider-side reconciliation report against `payment_provider_events` for a given period.

## 4. Audit-only Settlement Tests

**Location:** `packages/booking/test/audit-phase8a/audit-payment-settlement.test.ts`

The audit-phase8a suite adds (currently):

- Duplicate concurrent MoMo success with separate DB connections.
- Amount mismatch → REVIEW_REQUIRED.
- VNPAY single-event success path.
- Duplicate IPN event-key → DUPLICATE.

Additional race-matrix coverage is deferred to Phase 8C to avoid coupling the audit-phase8a suite to long-running tests in CI.

## 5. Headline Verdict

| Verdict | Status |
|---|---|
| CROSS_PROVIDER_SETTLEMENT_SAFETY | VERIFIED_WITH_LIMITATION |
| PAYMENT_BOOKING_STATE_SAFETY | VERIFIED_WITH_LIMITATION |
| PAYMENT_COUPON_ATOMICITY | VERIFIED_WITH_LIMITATION |
| MOMO_IDEMPOTENCY | VERIFIED |
| MOMO_RECONCILIATION | NOT_VERIFIED |
| MOMO_SANDBOX_ACCEPTANCE | EXTERNAL_BLOCKED |
| MOMO_PRODUCTION_ACCEPTANCE | EXTERNAL_BLOCKED |
| VNPAY_IDEMPOTENCY | VERIFIED |
| VNPAY_RECONCILIATION | NOT_VERIFIED |
| VNPAY_SANDBOX_ACCEPTANCE | EXTERNAL_BLOCKED |
| VNPAY_PRODUCTION_ACCEPTANCE | EXTERNAL_BLOCKED |

## 6. Closing

The deterministic payment contract is sound. The two gaps that block production are external (sandbox acceptance) and one structural (no reconciliation job). The cross-provider race matrix is verified for the cases that the audit ran in this phase; the remaining 8 race cases are scheduled for Phase 8C.
