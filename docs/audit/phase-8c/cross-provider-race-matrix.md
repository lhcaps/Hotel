# Phase 8C — Cross-Provider Race Matrix

This document is the catalogue of race scenarios that Phase 8C
closes against the live PostgreSQL settlement core. It enumerates
10 scenarios that were deferred from Phase 8A
(`docs/audit/phase-8a/payment-gateway-assurance.md` Section 2) and
records the expected outcome for each scenario. Live sandbox
acceptance remains `EXTERNAL_BLOCKED`; the scenarios below are
exercised against the deterministic settlement core on a disposable
database.

The fixture file paths are:

- `packages/booking/test/audit-phase8a/audit-payment-settlement.test.ts`
  (Phase 8A audit-only race matrix; carries scenarios 1, 4, 6, 7,
  8, 9, 10).
- `packages/database/test/integration/phase8c-payment-reconciliation.test.ts`
  (Phase 8C integration; carries the migration safety cases and
  the index/constraint catalogue).
- `packages/booking/src/payment/reconciliation.ts` — the new
  reconciliation module that drives the canonical settlement core
  from non-canonical status-query evidence.

Per-scenario run output is **`pending — awaiting command evidence`**.

## Scenario 1 — Duplicate MoMo success

- **Setup.** Two `applyVerifiedPaymentEvent` calls with the same
  MoMo `event_key` (same `provider_order_id`, same `transId`,
  same `amountVnd`, same `resultCode`).
- **Expected outcome.** Exactly one `SUCCEEDED`; the other returns
  `DUPLICATE` from the `payment_provider_events.event_key UNIQUE`
  constraint.
- **Fixture.** `audit-payment-settlement.test.ts` "duplicate
  MoMo success with separate DB connections".

## Scenario 2 — Duplicate VNPAY success

- **Setup.** Two `applyVerifiedPaymentEvent` calls with the same
  VNPAY `event_key` (same `provider_order_id`, same
  `vnp_TransactionNo`, same `vnp_Amount`, same `vnp_ResponseCode`).
- **Expected outcome.** Exactly one `SUCCEEDED`; the other returns
  `DUPLICATE`.
- **Fixture.** `audit-payment-settlement.test.ts` "duplicate VNPAY
  success with separate DB connections" (added by Phase 8C).

## Scenario 3 — MoMo success vs VNPAY success

- **Setup.** Two distinct payment attempts for the same booking.
  Attempt A is MOMO; Attempt B is VNPAY. Both attempt
  settlements race against the same booking.
- **Expected outcome.** Exactly one `SUCCEEDED`; the other becomes
  `REVIEW_REQUIRED` with category
  `CROSS_PROVIDER_TRANSACTION_CONFLICT` because of the new
  `payments_property_booking_uq` unique constraint and the
  settlement lock order
  (`booking → payment → payment_attempt → inventory_block →
  coupon_application`).
- **Fixture.** `audit-payment-settlement.test.ts` "MoMo vs VNPAY
  concurrent settlement on the same booking" (added by Phase 8C).

## Scenario 4 — Provider success vs HOLD expiry

- **Setup.** A booking in `HOLD` has its HOLD expiry
  (`hold_expires_at`) advance past `now()`. The expiry worker is
  in flight; the IPN arrives at the same time.
- **Expected outcome.** Settlement lock order rules: if the IPN
  commits first, the booking moves to `CONFIRMED`. If the expiry
  worker commits first, the booking moves to `EXPIRED` and the
  IPN becomes `REVIEW_REQUIRED` with category
  `BOOKING_EXPIRED`.
- **Fixture.** `expire-stale-holds.test.ts` +
  `audit-payment-settlement.test.ts` "records a verified success
  after HOLD expiry".

## Scenario 5 — Provider success vs ADMIN cancellation

- **Setup.** ADMIN cancels a booking that is currently `HOLD` (or
  `CONFIRMED` if a successful IPN already committed). The
  cancellation transaction and the IPN settlement transaction race.
- **Expected outcome.** If the cancellation commits first and the
  booking is now `CANCELLED`, the IPN becomes
  `REVIEW_REQUIRED` with category `PAID_CANCELLATION`. If the IPN
  commits first and the booking is now `CONFIRMED`, the
  cancellation opens an operational review with category
  `PAID_CANCELLATION` and does not rewrite the booking state.
- **Fixture.** `audit-payment-settlement.test.ts` "success after
  ADMIN cancellation" (added by Phase 8C).

## Scenario 6 — Success vs coupon redemption race

- **Setup.** The booking has a coupon reservation. The IPN
  settlement and the coupon-release worker race.
- **Expected outcome.** Coupon redeem at most once. If the IPN
  commits first, the coupon reservation moves to `REDEEMED` and
  the release worker is a no-op (idempotent). If the release
  worker commits first, the IPN becomes `REVIEW_REQUIRED` with
  category `COUPON_RELEASED`.
- **Fixture.** `payment-settlement.test.ts` "redeems the
  already-reserved coupon in the same verified-success settlement"
  + "retains a verified success for a released coupon as
  COUPON_RELEASED review".

## Scenario 7 — Success vs inventory release

- **Setup.** The booking's inventory block is released by the
  expiry worker or an ADMIN operation. The IPN settlement and
  the release transaction race.
- **Expected outcome.** If the release commits first, the IPN
  becomes `REVIEW_REQUIRED` with category
  `INVENTORY_RELEASED`. If the IPN commits first, the inventory
  block is preserved (no double-release).
- **Fixture.** `payment-settlement.test.ts` "does not confirm a
  HOLD whose booking inventory block was released".

## Scenario 8 — Duplicate provider transaction ID

- **Setup.** Two distinct payment attempts carry the same
  `provider_transaction_id` for the same provider.
- **Expected outcome.** The second settlement attempt returns
  `TRANSACTION_CONFLICT` from the
  `payment_attempts_provider_transaction_uq` partial unique index.
  The first attempt settles normally.
- **Fixture.** `payment-settlement.test.ts` "records a repeated
  provider transaction on another attempt as
  TRANSACTION_CONFLICT".

## Scenario 9 — Duplicate provider event ID

- **Setup.** Two distinct settlements carry the same
  `payment_provider_events.event_key` (same provider, same
  provider event id).
- **Expected outcome.** The second settlement returns `DUPLICATE`
  from the `payment_provider_events.event_key UNIQUE`
  constraint. The first attempt settles normally.
- **Fixture.** `payment-settlement.test.ts` "records the same
  provider event key as an idempotent duplicate without a second
  confirmation" + audit-phase8a duplicate test.

## Scenario 10 — Reconciliation cycle drives a verified event

- **Setup.** A payment attempt has `status = 'PENDING'` and
  `next_reconciliation_at <= now()`. The reconciliation worker
  claims the attempt with `FOR UPDATE SKIP LOCKED`, queries the
  provider, and the provider returns `SUCCEEDED` with matching
  `amountVnd` / `providerTransactionId`.
- **Expected outcome.** The reconciliation cycle feeds
  `applyVerifiedPaymentEvent` with a synthetic
  `VERIFIED_BY_ADAPTER` marker. The settlement transaction runs
  once: bookings `HOLD -> CONFIRMED`, payments
  `PENDING -> SUCCEEDED`, coupon reservation
  `RESERVED -> REDEEMED`, audit and outbox writes atomic. Lease
  cleared; `last_reconciled_at` advanced.
- **Fixture.** `packages/booking/src/payment/reconciliation.ts`
  `reconcilePaymentAttempt` +
  `packages/database/test/integration/phase8c-payment-reconciliation.test.ts`.

## Race-matrix summary table

| # | Scenario | Expected | Phase 8A status | Phase 8C status | Run output |
| --- | --- | --- | --- | --- | --- |
| 1 | Duplicate MoMo success | 1 `SUCCEEDED`, 1 `DUPLICATE` | VERIFIED | closed | pending — awaiting command evidence |
| 2 | Duplicate VNPAY success | 1 `SUCCEEDED`, 1 `DUPLICATE` | NOT_VERIFIED | closed | pending — awaiting command evidence |
| 3 | MoMo vs VNPAY race | 1 `SUCCEEDED`, 1 `REVIEW_REQUIRED` | NOT_VERIFIED | closed | pending — awaiting command evidence |
| 4 | Success vs HOLD expiry | `REVIEW_REQUIRED` if expiry wins | VERIFIED | closed | pending — awaiting command evidence |
| 5 | Success vs ADMIN cancel | `REVIEW_REQUIRED` if cancel wins | NOT_VERIFIED | closed | pending — awaiting command evidence |
| 6 | Success vs coupon redeem | Coupon redeem at most once | VERIFIED | closed | pending — awaiting command evidence |
| 7 | Success vs inventory release | `REVIEW_REQUIRED` if release wins | VERIFIED | closed | pending — awaiting command evidence |
| 8 | Duplicate provider transaction ID | `TRANSACTION_CONFLICT` | VERIFIED | closed | pending — awaiting command evidence |
| 9 | Duplicate provider event ID | `DUPLICATE` | VERIFIED | closed | pending — awaiting command evidence |
| 10 | Reconciliation drives a verified event | 1 `SUCCEEDED` through canonical core | NOT_VERIFIED (no reconciliation job in Phase 8A) | closed | pending — awaiting command evidence |

## Closing

All 10 scenarios are documented with expected outcomes, fixture
paths, and the Phase 8C status. Per-scenario run output is
`pending — awaiting command evidence` because this is the
documentation phase; the next validation cycle will exercise them
on a disposable PostgreSQL database and record the exact pass/fail
counts. Live sandbox acceptance remains `EXTERNAL_BLOCKED`.