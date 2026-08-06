# Lifecycle and state-transition test results

Evidence date: 2026-08-06, Asia/Bangkok

## Gate results

| Gate                          | Result                            | Evidence                                                                             |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| Unit suite                    | PASS                              | Forced-cache-independent Turbo unit run passed                                       |
| PostgreSQL database suite     | FAIL                              | 175/176 passed; one focused concurrent coupon test failed                            |
| API catalog integration       | FAIL                              | 146/158 passed; 12 failures in admin-booking-lifecycle/reporting fixture coverage    |
| Browser E2E                   | PARTIAL                           | 160/161 passed with one reversed-date readiness race                                 |
| Production lifecycle mutation | NOT_SAFE_FOR_PRODUCTION_EXECUTION | No production booking, payment, coupon, room, or maintenance mutation was authorized |

## Reproduced failures

### Coupon concurrent E3

The test holds a coupon row lock, starts an application INSERT and an ADMIN disable concurrently, then commits the lock-holder and unconditionally expects the application to win. PostgreSQL is free to grant the released row lock to either waiter. When the disable wins, the authoritative trigger re-reads the now-disabled coupon and correctly rejects the INSERT with SQLSTATE P0001. The migration trigger locks the parent row FOR UPDATE before validating status. This is a deterministic test-harness ordering defect, not evidence of a production trigger defect.

### Admin booking lifecycle

The helper inserts bookings without cancellation_policy_snapshot. The current transition service reads that immutable snapshot and intentionally rejects cancellation when it is absent, requiring operations review. The focused test fails at this guard before its intended inventory/coupon/payment assertions. This is stale fixture data after a contract change; fixture repair is required before lifecycle closure can be claimed.

### Reporting fixture

The reporting assertion expects paymentReviewCount 1. The development seed creates payment rows with SUCCEEDED, PENDING, and CANCELLED statuses, while the repository counts payment_status REVIEW_REQUIRED. The focused test therefore receives 0. The mismatch is in the synthetic seed/assertion pair and must be repaired and rerun.

### Reversed booking date E2E

The admin booking page initializes empty date state and hydrates URL state asynchronously. The test fills fields immediately after DOMContentLoaded; hydration resets the first field before submit, so the intended reversed-range validation does not run. The page’s validation branch exists and the server/local lifecycle date-boundary checks pass. The test must wait for the hydrated form state, then rerun the complete E2E gate.

## Production evidence

The production viewer read path was exercised without mutations. Login, role identity, allowed room/maintenance reads, restricted-read 403s, mutation denial, data minimization, redirect containment, and logout passed. Production booking lifecycle mutation was intentionally not attempted.

## Verdict

Lifecycle closure: FAIL pending fixture/test repair and full rerun. Production state integrity: PASS for the read-only evidence collected; mutation acceptance: NOT_SAFE_FOR_PRODUCTION_EXECUTION.
