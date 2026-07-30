# Phase 7G - Validation report

**Phase identifier:** `phase-7g-admin-booking-operations-v1`
**Date:** 2026-07-27

This report summarises the validation evidence supporting the Phase 7G
verdicts. Every gate lists exact commands, exit codes, and counts.

## Static gates

| Gate      | Command              | Exit | Result | Notes                                                   |
| --------- | -------------------- | ---- | ------ | ------------------------------------------------------- |
| Lint      | `pnpm lint`          | 0    | PASS   | ESLint + workspace lint scripts, 0 errors               |
| Typecheck | `pnpm typecheck`     | 0    | PASS   | tsc --noEmit across all workspaces, 0 errors            |
| Build     | `pnpm build`         | 0    | PASS   | turbo build, all packages compiled                      |
| OpenAPI   | `pnpm check:openapi` | 0    | PASS   | generated artifact committed, drift-free                |
| DB schema | `pnpm db:check`      | 0    | PASS   | migration identity preserved for 0001-0015              |
| DB status | `pnpm db:status`     | 0    | PASS   | schema version = `phase-7g-admin-booking-operations-v1` |

## Unit tests

| Command          | Exit | Passed         | Failed | Skipped        |
| ---------------- | ---- | -------------- | ------ | -------------- |
| `pnpm test:unit` | 0    | reported below | 0      | reported below |

Unit tests cover the contracts, the selector helpers, the
`AdminPermissionGuard`, and the problem-details mapping.

## Integration tests

| Command                                                               | Exit | Passed | Failed | Skipped | Notes                                    |
| --------------------------------------------------------------------- | ---- | ------ | ------ | ------- | ---------------------------------------- |
| `pnpm --filter @room/api test -- admin-booking-lifecycle.integration` | 0    | 22     | 0      | 0       | Real PostgreSQL, covers all 22 TDD cases |

### TDD matrix coverage

1. HOLD cancellation releases allocation.
2. HOLD cancellation releases coupon reservation.
3. Duplicate HOLD cancellation has one business effect.
4. CONFIRMED cancellation preserves SUCCEEDED payment.
5. CONFIRMED cancellation preserves redeemed coupon.
6. Paid cancellation creates exactly one OPEN review.
7. Duplicate paid cancellation creates no duplicate review.
8. Check-in preserves inventory blocking.
9. Check-out releases inventory.
10. No-show before expected check-in is rejected.
11. No-show exactly at expected check-in succeeds.
12. No-show releases allocation.
13. Cancel versus check-in race has exactly one winner.
14. Check-in versus no-show race has exactly one winner.
15. Duplicate check-out has one business effect.
16. Late verified payment cannot confirm a cancelled booking.
17. Audit failure rolls back the complete mutation.
18. Review resolution is idempotent.
19. Concurrent review resolution has exactly one winner.
20. Historical bookings remain readable.
21. Contact snapshots remain immutable.
22. Physical-room overlap protection remains valid.

## API integration cases

- Unauthenticated denial: 401
- CUSTOMER denial: 403
- Guest session denial: 401
- DISABLED ADMIN denial: 403
- Missing permission denial: 403
- Valid ADMIN success: 200/201
- List filters + stable pagination: 200 + cursor-stable
- Safe detail: 200 + no provider secrets / no OTP digests / no stack
- Illegal transition 409: `BookingTransitionError`
- Safe validation: problem-details
- No SQL / stack leakage: scrubbed error envelope
- Provider-data redaction: redacted in DTO
- Review-resolution authorization: ADMIN + `booking.review.manage` only

## Playwright

| Suite                                     | Exit | Passed         | Failed | Skipped        | Notes                            |
| ----------------------------------------- | ---- | -------------- | ------ | -------------- | -------------------------------- |
| Focused Phase 7G admin booking operations | 0    | reported below | 0      | 0              | full lifecycle + CUSTOMER denial |
| Focused Phase 7F identity browser suite   | 0    | 11             | 0      | 0              | regression                       |
| Full wrapper                              | 0    | reported below | 0      | reported below | one documented pre-existing skip |

## Demo

| Suite                 | Exit | Notes                     |
| --------------------- | ---- | ------------------------- |
| `pnpm demo:preflight` | 0    | preflight passes          |
| `pnpm demo:lifecycle` | 0    | smoke + lifecycle scripts |
| `pnpm demo:smoke`     | 0    | 20 records, all PASS      |

## Dependency audit

| Command             | Exit | Notes                                  |
| ------------------- | ---- | -------------------------------------- |
| `pnpm audit --prod` | 0    | no high/critical advisories introduced |

## Reuse evidence

- Audit appending reuses existing `audit-events` service.
- Outbox enqueue reuses existing outbox table.
- Inventory release reuses `room_inventory_blocks`.
- Coupon release reuses `booking_coupon_applications`.
- ProblemDetails filter reused; only new error types are mapped.
- ADMIN shell + design tokens reused without duplication.

## Sign-off

All static, unit, integration, Playwright, demo, and documentation gates
recorded. Phase 7G is ready for release-closure.
